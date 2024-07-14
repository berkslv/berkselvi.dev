+++
title = "HTTP ve RabbitMQ ile .NET Mikroservislerinde CorrelationId Takibi"
# CorrelationId Tracing in .NET Microservices with HTTP and RabbitMQ
date = "2024-07-14T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["microservices", "correlationId", "distributed tracing", "middleware", "AsyncLocal"]
description = ".NET microservice mimarisinde, HTTP ve RabbitMQ istekleriyle CorrelationId kullanarak dağıtık izlenebilirliği arttırdığımız bu yazıda, CorrelationId değerinin farklı servisler arasında nasıl gezdirileceğini, Middleware ve Filter yapılarıyla gelen ve giden isteklerde header değerleri üzerinde nasıl manipülasyon yapılacağını ve Serilog'un LogContext yapısıyla contextlerin loglanmasını keşfedeceğiz."
showFullContent = false
readingTime = true
+++

Microservice mimarisinde dağıtık olarak çalışan uygulamaların kendi aralarında yaptıkları iletişimler sırasında devam eden işlemin takip edilebilirliği ve eğer bir serviste performans sebepli veya akışsal bir sorun varsa hangi adımlardan sonra buraya geldiğini anlamlandırabilmek için Distributed tracing başlığı altında CorrelationId çok önemli bir yere sahiptir.

CorrelationId, bir isteğin tüm yaşam döngüsü boyunca taşınarak, farklı servisler arasındaki bağıntıyı sağlamalıdır. Bu yazıda, .NET tabanlı bir microservice mimarisinde HTTP ve RabbitMQ istekleri kullanarak CorrelationId değerinin nasıl gezdirilebileceğini inceleyeceğiz. Bu çözüm sorunumuza net bir şekilde cevap olmak için tasarlandı ancak her türlü yoruma ve geliştirmeye açıktır, eğer aklınızda daha iyi bir çözüm gelirse lütfen bana ulaşın.  

<img src="/img/correlationid-tracing-net-microservices-with-http-and-rabbitmq/big-picture.png" alt="Big picture" loading="lazy" />
<p class="image-sub-title">Big picture</p>

CorrelationId değerini HTTP ve MassTransit kullanarak servisler arasındaki iletişim sırasında Middleware ve Filter yapılarıyla gelen ve giden isteklerde araya girerek header değerleri üzerinde manipulasyonda bulunarak CorrelationId değerini servisler arasında gezdireceğiz. Bu gezdirme sırasındada gelen isteklerle başlatılan contextlerin, verilen CorrelationId değeri ile loglanması için Serilog tarafından sağlanan LogContext sınıfından faydalanacağız. Tüm örneklere aşağıdaki repodan ulaşabilirsiniz.

[GitHub - berkslv/lecture-correlation-id-microservices](https://github.com/berkslv/lecture-correlation-id-microservices)

Serivisimize gelen isteklerde aldığımız CorrelationId değerini, giden isteklerde göndermek için Scoped olarak tanımlayabileceğimiz Correlation sınıfımızdan yararlanabiliriz. Ancak bu şekilde Dependency Injection yöntemleri ile sınıflar arasında gezdirdiğimiz state değerimiz async olarak ilerleyen isteğimizde özel bir durumda erişilemez oluyor: DelegatingHandler sınıfı kullanarak HttpClient ile yapacağımız isteklerde araya girecek olan `CorrelationHeaderHandler` sınıfımız uygulamamızdan ayrı bir DI scope içerisinde çalışacağı için Scoped olarak tanımlayabileceğimiz Correlation sınıfımızın değerine bu özel durumda erişemeyeceğiz. Bu konu microsoft'un kendi dökümantasyonundada şöyle aktarılıyor

> When IHttpClientFactory creates a new delegating handler, it uses DI to fulfill the handler's constructor parameters. IHttpClientFactory creates a separate DI scope for each handler, which can lead to surprising behavior when a handler consumes a scoped service.

Bu soruna çözüm olarak `AsyncStorage` isminde bir sınıf oluşturup Microsoft tarafından sağlanan `AsyncLocal` sınıfını kullanarak CorrelationId değerini async olarak ilerleyen isteğimizde aynı thread içerisinde dilediğimiz zaman erişebileceğimiz bir yapı oluşturacağız:

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
AsyncStorage sınıfına type olarak vereceğimiz Correlation sınıfını, aşağıdaki gibi tanımlayarak Id property'sinde CorrelationId değerini barındıracağız.

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

CorrelationId değerini yapılan istek boyunca erişebileceğimiz bir konumda sakladığımıza göre, şimdi gelen isteklerde araya girerek header'lardan CorrelationId değerini çekelim. Microservice mimarisinde geliştirilen uygulamalarda servisler arasında sadece HTTP değil, aynı zamanda event tabanlı yöntemlerle iletişim kurulabiliyor. Ancak bu şekilde başlatılan isteklerde, CorrelationId değerini HTTP header'larında değil, MassTransit tarafından sağlanan header değerlerinde taşıyacağız.

<img src="/img/correlationid-tracing-net-microservices-with-http-and-rabbitmq/filters-for-correlationid.png" alt="Filters for CorrelationId" loading="lazy" />
<p class="image-sub-title">Filters for CorrelationId</p>


# CorrelationMiddleware

Gelen HTTP isteklerinde araya girecek ve CorrelationId HTTP header'ından değeri alacak olan CorrelationMiddleware sınıfımızı aşağıdaki gibi tanımlıyoruz. Eğer headerda değer varsa ilk önce Serilog tarafından sağlanan `LogContext` sınıfına bu değeri ayrı bir field olarak koyarak bir nevi enrich işlemi yapıyoruz. Daha sonra `AsyncStorage` sınıfımıza Correlation sınıfını vererek CorrelationId değerini saklıyoruz. Bu sayede gelen isteklerde CorrelationId değerini alıp, giden isteklerde bu değeri kullanabileceğiz. 

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

Bu middleware'i uygulamamıza eklemek için Progam.cs içerisinde aşağıdaki gibi düzenliyoruz. 

```csharp

var builder = WebApplication.CreateBuilder(args);

//...

var app = builder.Build();

app.UseMiddleware<CorrelationMiddleware>();

//...

app.Run();

```


# CorrelationConsumeFilter

Eğer servisimize gelen istek HTTP değil, event ile tetiklenen bir istek ise ortada bir HTTP headerı olmayacaktır. Bu sebeple MassTransit tarafından sağlanan header değerlerinden CorrelationId değerini almak için CorrelationConsumeFilter sınıfımızı aşağıdaki gibi tanımlıyoruz. Bu sınıfımızda IConsumer ile imzalanan sınıflarda consume işlemi gerçekleştirilmeden önce, gelen eventlerde araya girerek CorrelationId değerini alıp, `LogContext` ve `AsyncStorage<Correlation>` içerisine ekliyoruz. 

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

Bu şekilde gelen isteklerde `AsyncStorage<Correlation>` içerisinde tuttuğumuz Correlation değerimizi, yapılacak olan event isteklerinde ilgili header alanlarına eklemek için neler yapabileceğimizi inceleyelim.

# CorrelationPublishFilter

MassTransit tarafından sağlanan `IPublishEndpoint` ile publish edilen eventlerde araya girecek olan `CorrelationPublishFilter` sınıfımızı aşağıdaki gibi tanımlıyoruz. Bu sınıfımız, publish edilen eventlerde araya girerek `AsyncStorage<Correlation>` içerisinden CorrelationId değerini alıp, MassTransit'in CorrelationId header değerine ekleyecektir.

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

Eğer MassTransit'e gönderilen event publish edilmemiş ve request/response yapısı ile `IRequestClient<T>` kullanılarak gönderildiyse `CorrelationPublishFilter` değil `CorrelationSendFilter` sınıfımız araya girecek. Bu sınıfımızda send edilen eventlerde araya girerek `AsyncStorage<Correlation>` içersinden CorrelationId değerini alıp, MassTransit'in CorrelationId header değerininin içerisine ekliyoruz. 

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

`CorrelationConsumeFilter`, `CorrelationPublishFilter` ve `CorrelationSendFilter` sınıflarımızı uygulamamıza eklemek için aşağıdaki gibi ConfigureServices sınıfımızı tanımlayıp bu methodu Program.cs içerisinde kullanıyoruz.

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

Eğer servisimizden yapılan istek event değil HTTP isteği ise `IHttpClientFactory` ile oluşturacağımız HttpClient sınıfımızdan yapacağımız isteklerde araya girecek olan `CorrelationHeaderHandler` sınıfımızı aşağıdaki gibi tanımlıyoruz. Bu sınıfımızda uygulamamızdan yapılan HTTP isteklerinde araya girerek `AsyncStorage<Correlation>` içersinden CorrelationId değerini alıp, HTTP header olarak ekliyoruz.

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

Bu middleware'i uygulamamıza eklemek için Progam.cs içerisinde aşağıdaki gibi Named Http Client tanımlayıp `AddHttpMessageHandler` ile yapılacak isteklerde araya girecek olan middleware'i ekliyoruz.

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

Oluşturduğumuz Named Http Client için kullanımı aşağıdaki gibi yapıyoruz. Burada yapacağımız isteklerin async olmazsa middleware araya giremiyor.

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

Bu makalede, HTTP ve RabbitMQ kullanarak .NET microservice mimarisinde dağıtık izlenebilirliği artırmak için CorrelationId'yi nasıl etkili bir şekilde kullanabileceğimizi inceledik. Middleware ve Filter yapılarından yararlanarak, farklı servisler arasında CorrelationId'yi yayarak header değerlerini manipüle edebildik ve Serilog'un LogContext framework'ü ile kapsamlı loglama ve izleme sağladık.

CorrelationId'yi hem HTTP isteklerinde hem de MassTransit tarafından sağlanan event tabanlı iletişimde nasıl ele alacağımızı gösterdik. HTTP için `CorrelationMiddleware` ve `CorrelationHeaderHandler` sınıflarını; event tabanlı iletişim için ise `CorrelationConsumeFilter`, `CorrelationPublishFilter` ve `CorrelationSendFilter` sınıflarını uygulayarak, CorrelationId'nin bir isteğin tüm yaşam döngüsü boyunca tutarlı bir şekilde taşınmasını sağladık. Bu, işlem akışının net bir şekilde izlenmesini sağladı ve performans veya akış sorunlarını belirlemeye yardımcı oldu.

`AsyncLocal` sınıfıyla birlikte `AsyncStorage<Correlation>` kullanımı, CorrelationId değerini farklı kapsamlar arasında saklamak ve almak için güvenilir bir yol sağladı ve Dependency Injection ve asenkron işlemeyle ilgili zorlukları ele aldı.

Umarım bu rehber, kendi microservice mimarinizde sağlam bir dağıtık izleme çözümü uygulamanıza yardımcı olur. Daha detaylı örnekler için, GitHub reposunu inceleyebilirsiniz:

[GitHub - berkslv/lecture-correlation-id-microservices](https://github.com/berkslv/lecture-correlation-id-microservices)


# Kaynaklar

AsyncLocal sınıfnın doğru kullanımı için yararlandığım kaynak: 

https://medium.com/@mbearz/how-to-log-everything-using-middleware-and-httpclient-handler-42b8f628fe84

---

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme alanındaki araştırmalarımı kaçırmamak için [@berkslv](https://x.com/berkslv) adresinden takipte kalabilirsiniz.