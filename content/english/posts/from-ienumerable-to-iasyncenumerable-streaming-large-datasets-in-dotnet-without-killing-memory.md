+++
title = "From IEnumerable to IAsyncEnumerable: Streaming Large Datasets in .NET Without Killing Memory"
date = "2026-08-02T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["IAsyncEnumerable", "IEnumerable", ".NET", "C#", "streaming large datasets", "EF Core", "yield return", "ASP.NET Core", "cancellation token"]
description = "IAsyncEnumerable in .NET streams large datasets record by record with EF Core, cutting memory use compared to loading everything into a List with ToListAsync."
showFullContent = false
readingTime = true
cover = "img/from-ienumerable-to-iasyncenumerable-streaming-large-datasets-in-dotnet-without-killing-memory/cover.webp"
+++

A few months ago, one of our nightly export jobs started throwing `OutOfMemoryException`. Nothing in the code had changed. What had changed was the size of the table it was reading from—it had quietly grown from 200K rows to 4 million. The job was doing exactly what we told it to do: `.ToListAsync()` the whole thing, then loop over it. It just took the whole database table into RAM first, and RAM lost.

This is a trap almost every .NET developer falls into at some point: reaching for `IEnumerable<T>` (or its async cousin `Task<List<T>>`) when what you actually need is `IAsyncEnumerable<T>` streaming large datasets record by record. `IEnumerable<T>` and `IAsyncEnumerable<T>` look similar on the surface, but they solve very different problems, and picking the wrong one is exactly how you end up paging through a 4-million-row table in memory at 2am.

## IEnumerable vs IAsyncEnumerable at a Glance

| Aspect | `IEnumerable<T>` / `List<T>` | `IAsyncEnumerable<T>` |
| --- | --- | --- |
| **Materialization** | Fully realized before iteration starts | Pulled one item at a time, on demand |
| **Memory footprint** | Grows with result set size | Roughly constant, regardless of size |
| **Time to first item** | Waits for the entire query/collection | First item available as soon as it's ready |
| **Cancellation** | Only stops your loop; work already done stays done | Can stop the underlying query mid-stream |
| **Iteration** | Repeatable, indexable | Forward-only, single-pass |
| **Typical use** | Small, bounded collections | Exports, ETL, paginated APIs, log processing |

## The Old Way: Load Everything, Then Iterate

Here's the pattern that got us into trouble. A typical .NET service reading orders to export them:

```csharp

public async Task<List<Order>> GetAllOrdersAsync()
{
    return await _dbContext.Orders
        .AsNoTracking()
        .ToListAsync();
}

public async Task ExportOrdersAsync()
{
    var orders = await GetAllOrdersAsync();

    foreach (var order in orders)
    {
        await _exportWriter.WriteLineAsync(order.ToCsvRow());
    }
}

```

This looks perfectly reasonable, and for small tables it is. But look closely at what `ToListAsync()` actually does: it materializes **every single row** returned by the query into a `List<Order>` sitting in memory before your code ever touches the first item. If the query returns 4 million rows, you need enough memory to hold 4 million `Order` objects simultaneously, even though you only ever process one row at a time in the `foreach` loop.

The symptoms creep up slowly:

- **Memory spikes:** GC pressure increases, the process's working set balloons, and container memory limits get hit in Kubernetes.
- **Latency before the first result:** The caller waits for the *entire* query to complete before seeing a single row, even if all they wanted was to stream results to a client.
- **Wasted work on cancellation:** If the caller aborts halfway through, you've already paid the full cost of loading everything.
- **No backpressure:** There's no way to say "slow down, I'm still processing the last batch"—the database just keeps producing rows as fast as the driver can buffer them.

For a background job doing an export, an API endpoint streaming a CSV, or a data migration script, this pattern doesn't scale. It works in local development with your 50-row seed dataset, and quietly breaks in production.

## Why IAsyncEnumerable?

.NET Core 3.0 introduced `IAsyncEnumerable<T>`, paired with the `await foreach` syntax, specifically to solve this class of problem. Instead of a method returning a fully realized collection, it returns a sequence that is **pulled** one item at a time, asynchronously, as the consumer asks for the next element.

The mental model shift is important:

- **`Task<List<T>>`** means "wait for everything to be ready, then give me the whole thing."
- **`IAsyncEnumerable<T>`** means "give me an item whenever I ask for the next one, and let me `await` if it's not ready yet."

This unlocks:

- **Constant memory usage:** Only one item (or a small buffer) needs to be in memory at any given time, regardless of whether the source has 10 rows or 10 million.
- **Time-to-first-byte improvements:** A consumer can start processing (or an HTTP client can start receiving) data as soon as the first row is available, instead of waiting for the full result set.
- **Natural cancellation support:** `IAsyncEnumerable<T>` composes with `CancellationToken` via `WithCancellation`, so aborting a stream actually stops the underlying query instead of just discarding an already-loaded list.
- **Composability with LINQ:** With the `System.Linq.Async` package, you get `Select`, `Where`, and friends over async streams, so you don't lose the expressiveness you're used to with `IEnumerable<T>`.

The trade-off is that you give up random access and the ability to know the count upfront without a separate query—`IAsyncEnumerable<T>` is forward-only, single-pass, by design. For streaming scenarios, that's exactly the right constraint.

## Producing an IAsyncEnumerable with yield return

The simplest way to produce an `IAsyncEnumerable<T>` is with `yield return` inside an `async` method. Here's a hand-rolled example that streams numbers with a simulated I/O delay, useful for understanding the mechanics before we bring EF Core into the picture:

```csharp

public async IAsyncEnumerable<int> GenerateNumbersAsync(
    int count,
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    for (int i = 0; i < count; i++)
    {
        cancellationToken.ThrowIfCancellationRequested();

        // Simulate an async I/O operation, e.g. a network call per item
        await Task.Delay(10, cancellationToken);

        yield return i;
    }
}

```

The `[EnumeratorCancellation]` attribute is easy to miss but important: without it, a `CancellationToken` passed to `WithCancellation` won't actually flow into the method body, and `ThrowIfCancellationRequested` becomes a no-op against the caller's token.

Consuming it looks like this:

```csharp

await foreach (var number in GenerateNumbersAsync(1000, cts.Token))
{
    Console.WriteLine(number);
}

```

Notice what's *not* happening here: there's no intermediate `List<int>` holding all 1000 numbers. Each `number` is produced, consumed, and can be garbage collected before the next one is even generated.

## Real-life Example: Streaming EF Core Query Results

Let's go back to the export job that paged 4 million `Order` rows into memory at 2am and fix it properly. Entity Framework Core exposes `IAsyncEnumerable<T>` directly on `DbSet<T>` and `IQueryable<T>` via `AsAsyncEnumerable()`, so you don't need to write your own `yield return` wrapper for database queries:

```csharp

public IAsyncEnumerable<Order> StreamOrdersAsync(CancellationToken cancellationToken)
{
    return _dbContext.Orders
        .AsNoTracking()
        .OrderBy(o => o.Id)
        .AsAsyncEnumerable();
}

public async Task ExportOrdersAsync(CancellationToken cancellationToken)
{
    await foreach (var order in StreamOrdersAsync(cancellationToken).WithCancellation(cancellationToken))
    {
        await _exportWriter.WriteLineAsync(order.ToCsvRow());
    }
}

```

The difference is subtle in the code but massive at runtime. Instead of the query executing fully and buffering 4 million `Order` rows into a `List<Order>`, EF Core keeps the underlying `DbDataReader` open and streams rows from the database connection as the `await foreach` loop asks for them. Memory usage for the query itself stays roughly flat regardless of table size—you're paying for one row (plus a small internal buffer) at a time, not the whole result set.

Two details matter here that are easy to miss. First, `.AsNoTracking()` isn't decorative—without it, EF Core's change tracker keeps a snapshot of every entity it hands you for the lifetime of the `DbContext`, which quietly reintroduces the exact memory growth you're trying to eliminate, even though the query itself is streaming. Second, unlike the hand-rolled `yield return` example above, `AsAsyncEnumerable()` doesn't require you to add `[EnumeratorCancellation]` anywhere in your own code—EF Core wires the `CancellationToken` you pass to `WithCancellation` into its own query pipeline internally. The attribute only matters when you're writing the `async IAsyncEnumerable<T>` method yourself.

This also composes cleanly with ASP.NET Core. If you expose this as a minimal API endpoint, the framework will serialize the stream directly to the response body as items become available, instead of buffering the whole JSON array server-side first:

```csharp

app.MapGet("/orders/stream", (AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    return dbContext.Orders
        .AsNoTracking()
        .OrderBy(o => o.Id)
        .AsAsyncEnumerable();
});

```

Since .NET 6, ASP.NET Core's minimal APIs detect the `IAsyncEnumerable<T>` return type and stream the JSON array chunk by chunk as the underlying enumerable produces items, rather than requiring you to materialize the full list before returning it. One gotcha worth knowing: if response compression middleware sits in front of the endpoint, it can end up buffering the response internally to compress it effectively, quietly defeating the streaming behavior you just wired up—worth checking with a real client and `Transfer-Encoding: chunked` before assuming it's working end to end.

### A Note on Batching

Streaming one row at a time from EF Core is memory-friendly, but if you're writing each row to an external system (an HTTP call, a message queue, a second database), doing that per-row can be slow due to per-item overhead. A common middle ground is to batch the stream into chunks:

```csharp

public static async IAsyncEnumerable<List<T>> ChunkAsync<T>(
    this IAsyncEnumerable<T> source,
    int chunkSize,
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    var buffer = new List<T>(chunkSize);

    await foreach (var item in source.WithCancellation(cancellationToken))
    {
        buffer.Add(item);

        if (buffer.Count == chunkSize)
        {
            yield return buffer;
            buffer = new List<T>(chunkSize);
        }
    }

    if (buffer.Count > 0)
    {
        yield return buffer;
    }
}

```

Used like this:

```csharp

await foreach (var batch in StreamOrdersAsync(cancellationToken).ChunkAsync(500, cancellationToken))
{
    await _messageBus.PublishBatchAsync(batch);
}

```

You still keep memory bounded—only 500 orders in flight at a time instead of 4 million—while amortizing the per-call overhead of the downstream system across a batch.

## When IAsyncEnumerable Isn't the Right Tool

`IAsyncEnumerable<T>` isn't a universal replacement for `List<T>` or `IEnumerable<T>`. It's the wrong choice when:

- You need the count, need to sort after loading, or need random access (e.g., `orders[42]`)—those require materializing the data anyway.
- The dataset is genuinely small and bounded (a dropdown list of 20 categories doesn't need streaming semantics).
- You need to iterate the same sequence multiple times—`IAsyncEnumerable<T>` is single-pass by convention; re-enumerating typically re-runs the underlying query.
- You're doing in-memory transformations that need the whole collection anyway (e.g., computing a median), in which case streaming just adds `await` overhead without reducing memory.

Use it specifically when the shape of the problem is "process a potentially large sequence, one item (or small batch) at a time, without needing to hold it all at once." Exports, ETL pipelines, paginated API results, log processing, and large report generation are the classic cases.

## Summary

The `OutOfMemoryException` that started this whole investigation for us wasn't a bug in the traditional sense—the code was doing exactly what `ToListAsync()` promises to do. The real fix wasn't a smarter allocation strategy or a bigger container memory limit; it was recognizing that the job never needed a `List<Order>` sitting in memory in the first place. It needed a stream. Once we swapped `ToListAsync()` for `AsAsyncEnumerable()` on that export job, the same 4-million-row table processed with flat, predictable memory usage, and the `OutOfMemoryException` never came back.

Streaming large datasets with `IAsyncEnumerable<T>` won't make every query faster, and it does add complexity—cancellation tokens, `[EnumeratorCancellation]`, and the loss of random access and repeatable iteration aren't free. But when your problem is genuinely "read a lot of data and process it sequentially," `IAsyncEnumerable<T>` turns an unbounded memory problem into a constant one. The next time you write `.ToListAsync()` out of habit on a query that could return more rows than you expect, it's worth pausing and asking whether you actually need the list, or whether you just need the next item.

## Conclusion

Thanks for reading! 🎉 To not miss my research in software development, you can follow me at [@berkslv](https://x.com/berkslv).
</content>
