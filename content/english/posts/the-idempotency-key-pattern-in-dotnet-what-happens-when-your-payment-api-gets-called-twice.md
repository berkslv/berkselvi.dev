+++
title = "The Idempotency Key Pattern in .NET: What Happens When Your Payment API Gets Called Twice"
date = "2026-07-22T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["idempotency key", "idempotent api", ".NET", "payment api", "microservices", "distributed systems", "retry logic", "aspnet core"]
description = "Implement the idempotency key pattern in .NET to build an idempotent API that stops payment retries from causing duplicate charges."
showFullContent = false
readingTime = true
cover = "img/the-idempotency-key-pattern-in-dotnet-what-happens-when-your-payment-api-gets-called-twice/cover.webp"
+++

A customer clicks "Pay Now." The request hits your API, your payment provider charges the card, and then... the response times out. The mobile app doesn't know if the payment succeeded, so it does the only thing it knows how to do: it retries. Now you have two successful charges for one order, an angry customer, and a support ticket that starts with "I was charged twice."

If you've built anything that touches money, queues, or third-party APIs, you already know this scenario isn't hypothetical. Network blips, client timeouts, and load balancer retries are a fact of life in distributed systems. The **idempotency key pattern** is how production-grade payment APIs guarantee that the same logical request, no matter how many times it's retried, only ever gets applied once. In this post, I'll walk through why this matters, what typically goes wrong without it, and how to implement it properly in a .NET API.

## The Problem: "At-Least-Once" Delivery Is the Default

Here's an uncomfortable truth: over an unreliable network, you cannot guarantee "exactly-once" delivery of a request. TCP connections drop mid-response, HTTP clients time out, and load balancers or mobile apps retry on 5xx errors and timeouts. The best you can realistically build for is **at-least-once delivery**, meaning your endpoint might receive the exact same logical request two, three, or ten times.

For a `GET /orders/123` request, that's harmless. Reading data twice changes nothing. But for `POST /payments/charge`, every one of those retries can trigger a brand-new charge, because from the server's point of view, it just looks like a new, unrelated request.

## The Old Way: No Protection Against Duplicate Requests

Most teams start without any protection at all. A typical naive payment endpoint looks something like this:

```csharp

[HttpPost("charge")]
public async Task<IActionResult> ChargeCard([FromBody] ChargeRequest request)
{
    var result = await _paymentGateway.ChargeAsync(request.CardToken, request.Amount);

    await _orderRepository.MarkAsPaidAsync(request.OrderId, result.TransactionId);

    return Ok(result);
}

```

This works fine in the happy path. But walk through what happens when the client times out waiting for a response that was actually about to succeed:

1. Client sends `POST /payments/charge` for order `#4711`.
2. Server calls the payment gateway, the card is charged successfully.
3. Before the server can respond, the client's HTTP timeout fires.
4. The client, following standard retry logic, sends the exact same request again.
5. The server has no memory of the first attempt, so it charges the card a second time.

No amount of "just don't time out" fixes this, because timeouts, dropped connections, and process crashes are a normal part of operating a networked service in **microservices** and other **distributed systems**. The fix isn't to prevent retries; it's to make retries safe with a properly designed **idempotent API**.

## Why Idempotency Keys?

An **idempotency key** is a unique identifier, usually a client-generated UUID, that the caller attaches to a request. It tells your API: "this specific attempt represents one logical operation, no matter how many times you see it." The server's job is to:

- Store the result of the first successful request against that key.
- On any duplicate request carrying the same key, return the **stored result** instead of re-executing the operation.
- Reject requests that reuse a key with a different payload (a sign the client is misusing the key).

### What Makes an API Truly Idempotent

Turning a regular endpoint into an idempotent API means the endpoint has to satisfy three properties, regardless of how many times a client calls it with the same key:

- **Single execution of side effects:** the payment gateway, inventory system, or database write only happens once.
- **Consistent response:** every retry gets back the exact same response body and status code as the original attempt.
- **Bounded lifetime:** the key eventually expires, so the store doesn't grow forever and legitimate new requests aren't blocked by a key some client reused by mistake.

Stripe, one of the most heavily retried APIs on the planet, [documents this exact pattern](https://stripe.com/docs/api/idempotent_requests) and requires an `Idempotency-Key` header on all state-changing requests. It's not a nice-to-have; it's the foundation that makes their retry-heavy SDKs safe to use against a payments API.

## Designing the Idempotency Store

Before writing any middleware, you need a place to persist idempotency records. A simple relational table works well:

```sql

CREATE TABLE IdempotencyKeys (
    Key             VARCHAR(64)   NOT NULL PRIMARY KEY,
    RequestHash     VARCHAR(64)   NOT NULL,
    ResponseStatus  INT           NULL,
    ResponseBody    TEXT          NULL,
    Status          VARCHAR(20)   NOT NULL, -- 'Processing' | 'Completed'
    CreatedAt       TIMESTAMP     NOT NULL,
    ExpiresAt       TIMESTAMP     NOT NULL
);

```

A few design decisions matter here:

- **`RequestHash`**: a hash of the request body, so you can detect if a client reuses the same key for a *different* payload (that's a client bug, and you should return a `422` instead of silently returning the wrong stored response).
- **`Status`**: you need a "Processing" state, not just "Completed," so a second concurrent request can tell that the first one is still in flight. The actual guarantee against double-charging comes from the database's unique constraint on `Key` rejecting the second insert, not from the `Status` column alone — you'll see this in the store implementation below.
- **`ExpiresAt`**: idempotency keys shouldn't live forever. Stripe expires them after 24 hours; pick a window that matches how long your clients realistically retry, and run a background cleanup job that deletes rows past `ExpiresAt` so the table doesn't grow unbounded.

Note this schema uses Postgres-flavored SQL (`ON CONFLICT`). If you're on SQL Server, the equivalent is `MERGE` or an `IF NOT EXISTS` guard combined with a unique index on `Key` — the concurrency-safety principle is the same, only the syntax differs.

## Implementing It in .NET

Let's build this as an `ActionFilter`, so it can be applied declaratively to any endpoint that needs idempotency protection, without polluting the business logic.

### 1. The Idempotency Store

This example uses [Dapper](https://github.com/DapperLib/Dapper) for the raw SQL access, so add it first:

```bash

dotnet add package Dapper

```

```csharp

public interface IIdempotencyStore
{
    Task<IdempotencyRecord?> GetAsync(string key, CancellationToken ct);
    Task<bool> TryStartProcessingAsync(string key, string requestHash, CancellationToken ct);
    Task CompleteAsync(string key, int statusCode, string responseBody, CancellationToken ct);
}

public record IdempotencyRecord(string RequestHash, string Status, int? ResponseStatus, string? ResponseBody);

```

The `TryStartProcessingAsync` method is the critical piece. It must be an atomic "insert if not exists" operation, otherwise two concurrent requests with the same key can both pass the check and both proceed to charge the card:

```csharp

public class SqlIdempotencyStore : IIdempotencyStore
{
    private readonly IDbConnection _db;

    public SqlIdempotencyStore(IDbConnection db) => _db = db;

    public async Task<bool> TryStartProcessingAsync(string key, string requestHash, CancellationToken ct)
    {
        // Relies on the PRIMARY KEY constraint on `Key` to fail on duplicates
        const string sql = @"
            INSERT INTO IdempotencyKeys (Key, RequestHash, Status, CreatedAt, ExpiresAt)
            VALUES (@Key, @RequestHash, 'Processing', @Now, @Expires)
            ON CONFLICT (Key) DO NOTHING
            RETURNING Key;";

        var inserted = await _db.QueryFirstOrDefaultAsync<string>(sql, new
        {
            Key = key,
            RequestHash = requestHash,
            Now = DateTime.UtcNow,
            Expires = DateTime.UtcNow.AddHours(24)
        });

        return inserted != null;
    }

    public async Task<IdempotencyRecord?> GetAsync(string key, CancellationToken ct)
    {
        const string sql = "SELECT RequestHash, Status, ResponseStatus, ResponseBody FROM IdempotencyKeys WHERE Key = @Key";
        return await _db.QueryFirstOrDefaultAsync<IdempotencyRecord>(sql, new { Key = key });
    }

    public async Task CompleteAsync(string key, int statusCode, string responseBody, CancellationToken ct)
    {
        const string sql = @"
            UPDATE IdempotencyKeys
            SET Status = 'Completed', ResponseStatus = @Status, ResponseBody = @Body
            WHERE Key = @Key";

        await _db.ExecuteAsync(sql, new { Key = key, Status = statusCode, Body = responseBody });
    }
}

```

The `ON CONFLICT (Key) DO NOTHING ... RETURNING Key` trick lets the database's unique constraint do the concurrency control for you, so you don't need application-level locks.

### 2. The Action Filter

```csharp

public class IdempotentAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var httpContext = context.HttpContext;

        // Let model validation fail first - an invalid request should never consume a key.
        if (!context.ModelState.IsValid)
        {
            await next();
            return;
        }

        if (!httpContext.Request.Headers.TryGetValue("Idempotency-Key", out var keyHeader) ||
            string.IsNullOrWhiteSpace(keyHeader) || keyHeader.ToString().Length > 64)
        {
            context.Result = new BadRequestObjectResult("A valid Idempotency-Key header (max 64 chars) is required.");
            return;
        }

        var store = httpContext.RequestServices.GetRequiredService<IIdempotencyStore>();
        var key = keyHeader.ToString();
        var requestHash = await ComputeRequestHashAsync(httpContext.Request);

        var existing = await store.GetAsync(key, httpContext.RequestAborted);

        if (existing is not null)
        {
            if (existing.RequestHash != requestHash)
            {
                context.Result = new UnprocessableEntityObjectResult(
                    "Idempotency-Key was reused with a different request payload.");
                return;
            }

            if (existing.Status == "Completed")
            {
                context.Result = new ContentResult
                {
                    StatusCode = existing.ResponseStatus,
                    Content = existing.ResponseBody,
                    ContentType = "application/json"
                };
                return;
            }

            // Still processing - a concurrent duplicate arrived while the first one is in flight.
            context.Result = new ConflictObjectResult("Request with this Idempotency-Key is already being processed.");
            return;
        }

        var acquired = await store.TryStartProcessingAsync(key, requestHash, httpContext.RequestAborted);
        if (!acquired)
        {
            // Lost the race to a concurrent request that inserted first.
            context.Result = new ConflictObjectResult("Request with this Idempotency-Key is already being processed.");
            return;
        }

        var executedContext = await next();

        // Persist whatever the action produced so retries get an identical replay.
        // Anything other than ObjectResult (exceptions, StatusCodeResult, etc.) should
        // still release the key - otherwise it stays stuck in "Processing" until it expires.
        if (executedContext.Result is ObjectResult objectResult)
        {
            var statusCode = objectResult.StatusCode ?? 200;
            var body = JsonSerializer.Serialize(objectResult.Value, httpContext.RequestServices
                .GetRequiredService<IOptions<JsonOptions>>().Value.JsonSerializerOptions);
            await store.CompleteAsync(key, statusCode, body, httpContext.RequestAborted);
        }
        else
        {
            var statusCode = executedContext.Exception is not null ? 500 : (httpContext.Response.StatusCode);
            await store.CompleteAsync(key, statusCode, string.Empty, httpContext.RequestAborted);
        }
    }

    private static async Task<string> ComputeRequestHashAsync(HttpRequest request)
    {
        request.EnableBuffering();
        using var reader = new StreamReader(request.Body, leaveOpen: true);
        var body = await reader.ReadToEndAsync();
        request.Body.Position = 0;

        var bytes = Encoding.UTF8.GetBytes(body);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }
}

```

Two details worth calling out: the `JsonSerializerOptions` is pulled from the app's actual `AddJsonOptions` configuration via `IOptions<JsonOptions>`, so the replayed body matches the casing and converters the client already expects — reusing the default serializer here would silently produce a different payload than the original response. And every code path, including failures, now calls `CompleteAsync` so a key never gets permanently stuck in `"Processing"`; combine this with the `ExpiresAt` cleanup job so any record that somehow still gets stuck is reclaimed automatically.

### 3. Applying the Idempotent API to the Endpoint

```csharp

[HttpPost("charge")]
[Idempotent]
public async Task<IActionResult> ChargeCard([FromBody] ChargeRequest request)
{
    var result = await _paymentGateway.ChargeAsync(request.CardToken, request.Amount);
    await _orderRepository.MarkAsPaidAsync(request.OrderId, result.TransactionId);

    return Ok(result);
}

```

Now the client is responsible for generating a UUID per logical payment attempt and sending it as the `Idempotency-Key` header on every retry of that same attempt:

```bash

$ curl -X POST https://api.example.com/payments/charge \
  -H "Idempotency-Key: 8f14e45f-ceea-467e-bb9d-8f7c1a1c1b1a" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"4711","cardToken":"tok_visa","amount":4999}'

```

If the network drops before the response arrives and the client retries with the exact same header, the second request returns the stored result from the first attempt, without ever touching the payment gateway again.

## What This Doesn't Solve

Idempotency keys are not a silver bullet, and it's worth being explicit about their limits:

- **They don't replace the outbox pattern.** If your charge handler also needs to publish an `OrderPaidEvent`, you still need transactional guarantees for that event to avoid the classic dual-write problem.
- **They require client cooperation.** If your mobile client generates a *new* UUID on every retry instead of reusing the same one, the whole pattern is defeated. Document this clearly in your API contract, and consider generating the key client-side at the moment the user taps "Pay," not per HTTP attempt.
- **They add a write on every request.** For extremely high-throughput, low-value endpoints, the extra database round-trip might not be worth it. Reserve this pattern for operations where duplication is actually expensive: payments, order creation, and anything that moves money or inventory.
- **Expiration is a trade-off.** Too short, and legitimate slow retries fall outside the window and double-charge anyway. Too long, and you accumulate an ever-growing table of dead records. A background cleanup job that purges expired keys is worth building from day one.

## Summary

Retries are not an edge case in distributed systems; they're the normal operating condition for microservices talking to payment gateways, webhooks, and each other. The idempotency key pattern doesn't try to prevent retries, it makes them harmless by turning "did this get charged?" into a lookup instead of a guess. Remember that customer from the opening story, stuck wondering if they'd been billed twice? With an idempotent API in place, that retry would have silently returned the exact same success response, and they'd never have known there was a network hiccup at all. If you're building a payment API, a webhook receiver, or anything else where duplicate execution has a real cost, treat idempotency keys as a first-class requirement, not an afterthought you bolt on after the first double-charge incident.

---

## Conclusion

Thanks for reading! 🎉 To not miss my research in software development, you can follow me at [@berkslv](https://x.com/berkslv).
