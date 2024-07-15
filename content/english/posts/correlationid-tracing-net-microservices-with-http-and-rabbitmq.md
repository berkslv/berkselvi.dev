+++
title = "CorrelationId Tracing in .NET Microservices with HTTP and MassTransit"
date = "2024-07-14T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["microservices", "correlationId", "distributed tracing", "middleware", "AsyncLocal"]
description = "In this article on .NET microservice architecture, we will explore how to use CorrelationId with HTTP and RabbitMQ requests to enhance distributed traceability. We will examine how to propagate the CorrelationId value across different services, manipulate header values in incoming and outgoing requests using Middleware and Filter structures, and log contexts using Serilog's LogContext framework."
showFullContent = false
readingTime = true
cover = "img/correlationid-tracing-net-microservices-with-http-and-rabbitmq/cover.webp"
+++

CorrelationId has a very important place under the title of Distributed Tracing in order to be able to trace the ongoing process during the communication between applications running distributed in the microservice architecture and to understand which steps came to this point if there is a performance-related or flow problem in a service.

CorrelationId must be carried throughout the entire lifecycle of a request, ensuring the correlation between different services. In this article, we will examine how to navigate the CorrelationId value using HTTP and RabbitMQ requests in a .NET based microservice architecture. This solution was designed to be a clear answer to our problem, but it is open to any comments and improvements, if you have a better solution in mind, please contact me.

<img src="/img/correlationid-tracing-net-microservices-with-http-and-rabbitmq/big-picture.png" alt="Big picture" loading="lazy" />
<p class="image-sub-title">Big picture</p>

We will manipulate the CorrelationId value between services by manipulating the header values ​​by intervening in incoming and outgoing requests with Middleware and Filter structures during communication between services using HTTP and MassTransit. During this travel between services, we will use the LogContext class provided by Serilog to log the contexts initiated by incoming requests with the given CorrelationId value. You can access all examples from the repo below.

[GitHub - berkslv/lecture-correlation-id-microservices](https://github.com/berkslv/lecture-correlation-id-microservices)

We can use our Correlation class, which we could define as Scoped, to send the CorrelationId value we receive in incoming requests to our service in outgoing requests. However, in this way, our state value, which we move between classes with Dependency Injection methods, becomes inaccessible in a special case in our request that proceeds asynchronously: Since our `CorrelationHeaderHandler` class, which will intervene in the requests we make with the HttpClient using the DelegatingHandler class, will work in a separate DI scope from our application, the value of our Correlation class, which we could define as Scoped, becomes inaccessible in a this special case. This issue is also explained in Microsoft's own documentation as follows:

> When IHttpClientFactory creates a new delegating handler, it uses DI to fulfill the handler's constructor parameters. IHttpClientFactory creates a separate DI scope for each handler, which can lead to surprising behavior when a handler consumes a scoped service.

As a solution to this problem, we will create a class called `AsyncStorage` and use the `AsyncLocal` class provided by Microsoft to create a structure that we can access at any time within the same thread in our async request to set the CorrelationId value:

```csharp

namespace Order.API.Filters.Correlation;

/// <summary>
/// Stores and retrieves values in an async context.
/// </summary>
/// <typeparam name="T">What should be stored</typeparam>
public static class AsyncStorage<T> where T : new()
{
    private static readonly AsyncLocal<T> _asyncLocal = new AsyncLocal<T>();
    
    public static T Store(T val)
    {
        _asyncLocal.Value = val;
        return _asyncLocal.Value;
    }

    public static T? Retrieve()
    {
        return _asyncLocal.Value;
    }
}

```

We will define the Correlation class, which we will provide as a type to the AsyncStorage class, as shown below. The Id property will contain the CorrelationId value.

```csharp

namespace Order.API.Filters.Correlation;

/// <summary>
/// It holds the CorrelationId value that comes with HTTP requests and events handled via MassTransit.
/// </summary>
public class Correlation
{
    public Guid Id { get; init; }
}

```

Since we are storing the CorrelationId value in a location that is accessible throughout the request, let's now intercept incoming requests and extract the CorrelationId value from the headers. In microservice architecture, applications communicate between services not only via HTTP but also through event-based methods. However, in such initiated requests, we will carry the CorrelationId value in the headers provided by MassTransit, not in the HTTP headers.

<img src="/img/correlationid-tracing-net-microservices-with-http-and-rabbitmq/filters-for-correlationid.png" alt="Filters for CorrelationId" loading="lazy" />
<p class="image-sub-title">Filters for CorrelationId</p>


# CorrelationMiddleware

We define our CorrelationMiddleware class, which will intercept incoming HTTP requests and get the value from the CorrelationId HTTP header, as follows. If there is a value in the header, we first enrich it by putting this value as a separate field in the `LogContext` class provided by Serilog. Then, we store the CorrelationId value by giving the Correlation class to our `AsyncStorage` class. In this way, we will be able to get the CorrelationId value in incoming requests and use this value in outgoing requests.

```csharp

namespace Order.API.Filters.Correlation;

/// <summary>
/// When the Http request is made, it takes the CorrelationId value from the HttpContext Header and sets the Correlation.Id value.
/// </summary>
public class CorrelationMiddleware
{
    private readonly RequestDelegate _next;

    public CorrelationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, Correlation correlation)
    {
        var correlationIdHeader = context.Request.Headers["CorrelationId"];

        if (!string.IsNullOrWhiteSpace(correlationIdHeader))
        {
            var correlationId = Guid.Parse(correlationIdHeader.ToString());

            LogContext.PushProperty("CorrelationId", new ScalarValue(correlationId));
            
            AsyncStorage<Correlation>.Store(new Correlation
            {
                Id = correlationId
            });
        }

        await _next(context);
    }
}

```

To add this middleware to our application, we edit Program.cs as follows.

```csharp

var builder = WebApplication.CreateBuilder(args);

//...

var app = builder.Build();

app.UseMiddleware<CorrelationMiddleware>();

//...

app.Run();

```


# CorrelationConsumeFilter

If the request coming to our service is not HTTP, but a request triggered by an event, there will not be an HTTP header. For this reason, we define our CorrelationConsumeFilter class as follows to get the CorrelationId value from the header values ​​provided by MassTransit. In this class, before consuming the classes signed with IConsumer, we intercept the incoming events and get the CorrelationId value and add it to `LogContext` and `AsyncStorage<Correlation>`.

```csharp

namespace Order.API.Filters.Correlation;

/// <summary>
/// It is triggered when there is an event consumed by MassTransit and sets the CorrelationId value to the Correlation class.
/// </summary>
public class CorrelationConsumeFilter<T> : IFilter<ConsumeContext<T>> where T : class
{
    public Task Send(ConsumeContext<T> context, IPipe<ConsumeContext<T>> next)
    {
        var correlationIdHeader = context.CorrelationId;

        if (correlationIdHeader.HasValue)
        {
            var correlationId = correlationIdHeader.Value;
            
            LogContext.PushProperty("CorrelationId", new ScalarValue(correlationId));
            
            AsyncStorage<Correlation>.Store(new Correlation
            {
                Id = correlationId
            });
        }

        return next.Send(context);
    }

    public void Probe(ProbeContext context)
    {
    }
}

```

Let's examine what we can do to add the Correlation value, which we store in `AsyncStorage<Correlation>`, to the relevant header fields in the event requests.

# CorrelationPublishFilter

We define our `CorrelationPublishFilter` class, which will intercept events published with MassTransit's `IPublishEndpoint`, as follows. This class intercepts published events, retrieves the CorrelationId value from `AsyncStorage<Correlation>`, and adds it to MassTransit's CorrelationId header.

```csharp

namespace Order.API.Filters.Correlation;

/// <summary>
/// Sets the CorrelationId value of events published via MassTransit.
/// </summary>
public class CorrelationPublishFilter<T> : IFilter<PublishContext<T>> where T : class
{

    public Task Send(PublishContext<T> context, IPipe<PublishContext<T>> next)
    {
        var correlation = AsyncStorage<Correlation>.Retrieve();

        if (correlation is not null)
        {
            context.CorrelationId = Guid.Parse(correlation.Id.ToString()!);
        }

        return next.Send(context);
    }

    public void Probe(ProbeContext context)
    {
    }
}

```

# CorrelationSendFilter

If the event sent to MassTransit is not published and is sent using `IRequestClient<T>` with the request/response pattern, our `CorrelationSendFilter` class will intervene, not `CorrelationPublishFilter`. In this class, we intervene in the sent events, get the CorrelationId value from `AsyncStorage<Correlation>` and add it to the CorrelationId header value of MassTransit.

```csharp

namespace Order.API.Filters.Correlation;

/// <summary>
/// Sets the CorrelationId value of events sent via MassTransit.
/// </summary>
public class CorrelationSendFilter<T> : IFilter<SendContext<T>> where T : class
{
    public Task Send(SendContext<T> context, IPipe<SendContext<T>> next)
    {
        var correlation = AsyncStorage<Correlation>.Retrieve();

        if (correlation is not null)
        {
            context.CorrelationId = Guid.Parse(correlation.Id.ToString());
        }

        return next.Send(context);
    }

    public void Probe(ProbeContext context)
    {
    }
}

```

To add our `CorrelationConsumeFilter`, `CorrelationPublishFilter` and `CorrelationSendFilter` classes to our application, we define our ConfigureServices class as follows and use this method in Program.cs.

```csharp

public static class ConfigureServices
{
    public static WebApplicationBuilder AddMassTransit(this WebApplicationBuilder builder, IConfiguration configuration)
    {
        var messageBroker = builder.Configuration.GetSection("MessageBroker");
        builder.Services.AddMassTransit(cfg =>
        {
            cfg.SetKebabCaseEndpointNameFormatter();
            
            cfg.AddConsumers(Assembly.GetExecutingAssembly());

            cfg.UsingRabbitMq((context, config) =>
            {
                config.UseSendFilter(typeof(CorrelationSendFilter<>), context);
                config.UsePublishFilter(typeof(CorrelationPublishFilter<>), context);
                config.UseConsumeFilter(typeof(CorrelationConsumeFilter<>), context);

                config.Host(messageBroker["Host"], messageBroker["VirtualHost"], h =>
                {
                    h.Username(messageBroker["Username"]!);
                    h.Password(messageBroker["Password"]!);
                });

                config.ConfigureEndpoints(context);
            });
        });

        return builder;
    }
}

```

```csharp

var builder = WebApplication.CreateBuilder(args);

builder.AddMassTransit(builder.Configuration);

// ...

var app = builder.Build();

// ...

app.Run();

```


# CorrelationHeaderHandler

If the request made from our service is an HTTP request, not an event, we define our `CorrelationHeaderHandler` class, which will intervene in the requests we make from our HttpClient class, which we will create with `IHttpClientFactory`, as follows. In this class, we intervene in HTTP requests made from our application, get the CorrelationId value from `AsyncStorage<Correlation>` and add it as a HTTP header.

```csharp

/// <summary>
/// Middleware to be used in requests made with HttpClient. Adds the CorrelationId header to the requests made.
/// </summary>
public class CorrelationHeaderHandler : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var correlation = AsyncStorage<Correlation>.Retrieve();
        
        if (correlation is not null)
        {
            request.Headers.Add("CorrelationId", correlation.Id.ToString());
        }

        return await base.SendAsync(request, cancellationToken);
    }
}

```

To add this middleware to our application, we define Named Http Client in Progam.cs as follows and add the middleware that will intervene in requests made with `AddHttpMessageHandler`.

```csharp

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddTransient<CorrelationHeaderHandler>();

builder.Services.AddHttpClient("Inventory", c =>
    {
        c.BaseAddress = new Uri("http://localhost:5053");
    })
    .AddHttpMessageHandler<CorrelationHeaderHandler>();;

// ...

var app = builder.Build();

// ...

app.Run();

```

We use the Named Http Client we created as follows. If the requests we make here are not asynchronous, the middleware cannot intervene.

```csharp

public class InventoryService : IInventoryService
{
    private readonly IHttpClientFactory _httpClientFactory;
    
    public InventoryService(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }
    
    public async Task RemoveStockAsync(string productId, int quantity)
    {
        var httpClient = _httpClientFactory.CreateClient("Inventory");
        
        var response = await httpClient.PostAsync($"remove-stock/{productId}/{quantity}", null);
        
        response.EnsureSuccessStatusCode();
    }
}

```

In this article, we explored how to effectively use CorrelationId to enhance distributed traceability in a .NET microservice architecture using HTTP and RabbitMQ. By leveraging Middleware and Filter structures, we were able to manipulate header values and propagate the CorrelationId across different services, ensuring comprehensive logging and monitoring with Serilog's LogContext framework.

We demonstrated how to handle CorrelationId in both HTTP requests and event-driven communication facilitated by MassTransit. By implementing `CorrelationMiddleware` and `CorrelationHeaderHandler` for HTTP; `CorrelationConsumeFilter`, `CorrelationPublishFilter`, and `CorrelationSendFilter` for event-driven communication. We ensured that the CorrelationId is consistently carried through the entire lifecycle of a request, providing a clear trace of the process flow and helping to identify performance or flow issues.

The use of `AsyncStorage<Correlation>` with the `AsyncLocal` class provided a reliable way to store and retrieve the CorrelationId value across different scopes, addressing challenges related to Dependency Injection and asynchronous processing.

I hope this guide helps you implement a robust distributed tracing solution in your own microservice architecture. For more detailed examples, you can check out the complete code repository on GitHub:

[GitHub - berkslv/lecture-correlation-id-microservices](https://github.com/berkslv/lecture-correlation-id-microservices)

# Resources

The source I used for the correct use of the AsyncLocal class:

https://medium.com/@mbearz/how-to-log-everything-using-middleware-and-httpclient-handler-42b8f628fe84

---

## Conclusion

Thank you for reading! 🎉 In order not to miss my research in the field of software development, you can follow me at [@berkslv](https://x.com/berkslv).