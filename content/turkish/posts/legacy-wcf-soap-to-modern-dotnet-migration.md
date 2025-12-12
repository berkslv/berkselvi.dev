+++
title = "Lgacy WCF/SOAP'tan Modern .NET'e: Taviz Vermeden Migration"
date = "2025-12-12T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv"
keywords = [".NET","CoreWCF","SOAP","WCF","migration","eski sistemler","modernizasyon"]
description = "Eski .NET Framework WCF/SOAP uygulamalarını, mevcut SOAP entegrasyonlarını bozmadan modern .NET'e nasıl taşıyacağınızı keşfedin. Bu rehber, SOAP kontratlarınızı korurken modern geliştirme pratiklerini benimsemek ve tüm paydaşlar için sorunsuz bir geçiş sağlamak adına CoreWCF kullanımına dair pratik desenler sunmaktadır."
showFullContent = false
readingTime = true
cover = "img/legacy-wcf-soap-to-modern-dotnet-migration/cover.webp"
+++

# Lgacy WCF/SOAP'tan Modern .NET'e: Taviz Vermeden Migration

Mükemmel migration planını hazırladınız. Yol haritası harika görünüyor: O yaşlanmış, bitik monolitik .NET Framework 4.8 WCF uygulamasını alıp dönüştüreceksiniz. Arayüzü .NET 10 üzerinde şık, state tutmayan bir REST API olarak yeniden yazacak ve sonunda o eski IIS sunucusunu kapatacaksınız.

Planı paydaşlara sunuyorsunuz. İç ekipler alkışlarla tezahürat yapıyor. DevOps ekibi çoktan Dockerfile'ları yazmaya başladı bile. Herkes çok heyecanlı.

Ve sonra o e-posta geliyor.

Büyük bir iş ortağının "Eski Entegrasyonlar" ekibinden veya belki de 2014'ten beri yazılım güncellemesi almamış bir donanım cihazını yöneten bir tedarikçiden geliyor. Mesajları kibar ama net:

> *"Bir REST API tüketemeyiz. Sistemlerimiz bir SOAP gerektiriyor. WSDL'in olduğu gibi kalmasına ihtiyacımız var. Eğer kontratı değiştirirseniz, size entegre olamayız."*

Aniden, migration planınız bir tuğla duvara çarpıyor. İki kötü seçenekle karşı karşıyasınız:

1.  **migrationü iptal etmek:** Sadece tek bir arayüzü memnun etmek için tüm projeyi .NET Framework üzerinde tutmak.
2.  **"Sidecar" Kabusu:** Yeni sistemi .NET Core'da kurmak, ancak sadece SOAP isteklerini yeni API'ye proxy etmek için çalışan bir zombi .NET Framework sunucusunu ayakta tutmak.

Ancak üçüncü bir seçenek daha var. Bir köprü.

**CoreWCF.**

CoreWCF, barındırma modelini, Dependency Injection ve performans özelliklerini modern .NET kullanarak tamamen yeniden yazarken, dış kontratı (SOAP) eski sistemle aynı tutmamıza olanak tanır.

Bu yazıda, bir `InvoiceService`'i adım adım taşıyacağız. Ham bir uç noktayla (endpoint) başlayacak, onu modern yetkilendirme ile güvenli hale getirecek ve son olarak RESTful `ProblemDetails` ile SOAP Hataları (Faults) arasındaki boşluğu dolduran sofistike bir hata yönetimi uygulayacağız.

---

## Adım 1: migrationün "Merhaba Dünya"sı

İlk hedefimiz sadece ışıkları yakmak. `IInvoiceService` kontratını IIS yerine Kestrel web sunucusu kullanarak sunabileceğimizi kanıtlamak istiyoruz.

Henüz güvenlik veya hata yönetimi hakkında endişelenmiyoruz. Sadece XML'in aktığını görmek istiyoruz.

### Kontrat ve Servis

Servis Kontratımızı eski sistemdekiyle neredeyse tamamen aynı tutuyoruz. Tek fark, eski WCF uygulamasına kıyasla büyük bir performans kazancı sağlayan gerçek asenkron işlemeyi yani `Task<T>` yapısını benimsiyor olmamız. Ayrıca, Mediator desenine daha iyi uyması için mevcut istek ve yanıt modellerini birazcık yeniden adlandırdık.

```csharp
// Sample.API.WCF/IInvoiceService.cs
using CoreWCF;
using Sample.Business.Features.Invoices.CreateInvoice;

namespace Sample.API.WCF;

[ServiceContract]
public interface IInvoiceService
{
    [OperationContract]
    Task<CreateInvoiceCommandResponse> CreateInvoice(CreateInvoiceCommand command);
}

// Dikkat: Henüz burada hiçbir attribute yok, sadece saf mantık.
public class InvoiceService(ISender mediator) : IInvoiceService
{
    public async Task<CreateInvoiceCommandResponse> CreateInvoice(CreateInvoiceCommand command)
    {
        return await mediator.Send(command);
    }
}
```

### Konfigürasyon (1. Adım)

İşte en temel kurulum için `Program.cs`. Gereksiz her şeyi çıkarıyoruz.

```csharp
// Program.cs - Adım 1: Temel WCF Barındırma
using CoreWCF;
using CoreWCF.Configuration;
using CoreWCF.Description;
using Sample.API.WCF;
using CoreWCF.Description;

var builder = WebApplication.CreateBuilder(args);

// 1. CoreWCF temellerini DI container'a ekle
builder.Services.AddTransient<InvoiceService>();
builder.Services.AddServiceModelServices();
builder.Services.AddServiceModelMetadata();
services.AddSingleton<IServiceBehavior, UseRequestHeadersForMetadataAddressBehavior>();

// 2. MediatR ve Servisimizi Kaydet
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(Program).Assembly));

var app = builder.Build();

// 3. CoreWCF Middleware'ini Yapılandır
app.UseServiceModel(serviceBuilder =>
{
    serviceBuilder.AddService<InvoiceService>()
    .AddServiceEndpoint<InvoiceService, IInvoiceService>(
        new BasicHttpBinding(), "/Services/InvoiceService.svc" // Uç nokta URL'si
    );

    // İnatçı istemcinin referansını güncellemesi gerekirse diye WSDL üretimini etkinleştir
    var serviceMetadataBehavior = app.Services.GetRequiredService<ServiceMetadataBehavior>();
    serviceMetadataBehavior.HttpGetEnabled = true;
});

app.Run();
```

Bu noktada, taşıma katmanında zafer kazandık. Entegratör `/Services/InvoiceService.svc` adresine gelebilir, bir XML/SOAP zarfı gönderebilir ve modern MediatR işleyicilerimiz iş kurallarını işler.

---

## Adım 2: Yetkilendirme (Authorization) Ekleme

"Sade" servis çalışıyor ama tehlikeli. Eski WCF günlerinde, geliştiriciler çoğu zaman uç noktalara herhangi bir yetkilendirme desteği eklemezdi, güvenliği yapılandırmak güvenlik sertifikalarıyla uğraşmak demekti.

CoreWCF'de, **güvenlik sadece ASP.NET Core güvenliğidir**.

Eğer REST API'niz JWT Bearer tokenları veya Cookie Auth kullanıyorsa, CoreWCF uç noktalarınız da bunları kullanabilir. Tekerleği yeniden icat etmemize gerek yok. Servisimizi basitçe `[Authorize]` ile süslüyoruz.

### Güncellenmiş Servis
`[Authorize]` ekliyoruz ve kullanıcı bağlamına erişebildiğimizi kanıtlamak için `IHttpContextAccessor` enjekte ediyoruz.

```csharp
using CoreWCF;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Sample.Shared.Services.Interfaces;

namespace Sample.API.WCF;

[Authorize] // <--- Sihirli kelime. Bu standart ASP.NET Core yetkilendirmesidir.
public class InvoiceService(ISender mediator, IHttpContextAccessor httpContextAccessor) : IInvoiceService
{
    public async Task<Response> CreateInvoice(CreateInvoiceCommand command)
    {
        var context = httpContextAccessor.HttpContext;
        Console.WriteLine(context?.User.Identity?.Name);

        return await mediator.Send(command);
    }
}
```

### Konfigürasyon (2. Adım)
ASP.NET Core Auth ara yazılımını (middleware), CoreWCF ara yazılımından *önce* katmanlamamız gerekiyor.

```csharp
// Program.cs - Adım 2: Yetkilendirme Ekleme
using CoreWCF.Configuration;
using CoreWCF.Description;
using Sample.API.WCF;
using Microsoft.AspNetCore.Authentication.JwtBearer; // JWT varsayıyoruz

var builder = WebApplication.CreateBuilder(args);

// 1. Standart ASP.NET Core Kimlik Doğrulama Kurulumu
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = configuration["Jwt:Issuer"],
            ValidAudience = configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration["Jwt:SecretKey"]!))
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.DefaultPolicy = new AuthorizationPolicyBuilder(JwtBearerDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .Build();
});

builder.Services.AddTransient<InvoiceService>();
builder.Services.AddServiceModelServices();
builder.Services.AddServiceModelMetadata();
services.AddSingleton<IServiceBehavior, UseRequestHeadersForMetadataAddressBehavior>();

builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(Program).Assembly));

var app = builder.Build();

// 2. ÖNEMLİ: Auth middleware WCF middleware'den önce çalışmalıdır
app.UseAuthentication();

app.UseAuthorization();

app.UseServiceModel(serviceBuilder =>
{
    serviceBuilder.AddService<InvoiceService>()
    .AddServiceEndpoint<InvoiceService, IInvoiceService>(
        new BasicHttpBinding(), "/Services/InvoiceService.svc" 
    );

    var serviceMetadataBehavior = app.Services.GetRequiredService<ServiceMetadataBehavior>();
    serviceMetadataBehavior.HttpGetEnabled = true;
});

app.Run();
```

Şimdi, eğer entegratör geçerli bir standart HTTP `Authorization: Bearer` header'ı olmadan bir istek gönderirse, CoreWCF bunu kodumuza daha ulaşmadan 401 ile reddedecektir. Elbette müşterimizin istek yapmadan önce ek bir adım uygulaması gerekir ancak authn & authz olmadan herhangi bir uygulama saldırılara açık olacaktır.

---

## Adım 3: Evrensel Çevirmen (Birleşik Hata Yönetimi)

Hikayenin en zor kısmı burası.

Modern bir REST API'de, bir şeyler ters gittiğinde (örneğin "Fatura bulunamadı"), özel bir `BadRequestException` fırlatırız ve bir JSON `ProblemDetails` (RFC 7807) yanıtı döndürürüz.

WCF'de ise, XML içine sarılmış bir `FaultException` döndürmemiz beklenir.

Eğer bunu yönetmezsek, güzelim `ValidationException`'ımız servisi çökertecek ve istemciye genel, çirkin bir "Internal Server Error" dönecektir. Modern Exception'larımızı yakalayan ve onları hala tüm zengin verileri (doğrulama hata alanları gibi) içeren SOAP Hatalarına (Faults) çeviren bir tercümana ihtiyacımız var.

### Kod: ExceptionHandlerErrorHandler

```csharp
using System.Diagnostics;
using System.Xml.Linq;
using CoreWCF;
using CoreWCF.Channels;
using CoreWCF.Dispatcher;
using Sample.Domain.Constants;
using Sample.Domain.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;

namespace Sample.API.Filters;

/// <summary>
/// Exception'ları yakalayan ve ProblemDetails'i SOAP Fault olarak döndüren CoreWCF Hata İşleyicisi.
/// Bu, modern Exception tanımları ile eski SOAP hataları arasında bir köprü görevi görür.
/// </summary>
public class ExceptionHandlerErrorHandler : IErrorHandler
{
    private const string HttpRfcBadRequest = "https://tools.ietf.org/html/rfc7231#section-6.5.1";
    private const string ProblemDetailsNamespace = "urn:ietf:rfc:7807";

    private readonly ILogger<ExceptionHandlerErrorHandler> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IStringLocalizer<ExceptionHandleMiddleware> _localizer;
    private readonly Dictionary<Type, Func<Exception, ProblemDetails>> _exceptionHandlers;

    public ExceptionHandlerErrorHandler(
        ILogger<ExceptionHandlerErrorHandler> logger,
        IHttpContextAccessor httpContextAccessor,
        IStringLocalizer<ExceptionHandleMiddleware> localizer)
    {
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
        _localizer = localizer;

        // Domain exception'larını belirli ProblemDetails işleyicilerine eşle
        _exceptionHandlers = new()
        {
            { typeof(BadRequestException), HandleBadRequestException },
            // İstediğiniz kadar ekleyin
        };
    }

    public bool HandleError(Exception error)
    {
        // Hatayı işlediğimizi ve oturumun hatalı olmadığını belirtmek için true döndür
        return true;
    }

    public void ProvideFault(Exception error, MessageVersion version, ref Message fault)
    {
        // 1. Exception'ı ProblemDetails'e dönüştür
        var problemDetails = CreateProblemDetails(error);

        // 2. ProblemDetails'i SOAP Body için XML Elementine dönüştür
        var problemDetailsElement = TransformToXml(problemDetails);

        // 3. Problem detaylarını içeren bir FaultException oluştur
        var faultException = new FaultException<XElement>(
            problemDetailsElement,
            new FaultReason(problemDetails.Title ?? "An error occurred"),
            new FaultCode(GetFaultCodeFromStatus(problemDetails.Status ?? 500)),
            "ProblemDetails");

        var messageFault = faultException.CreateMessageFault();
        fault = Message.CreateMessage(version, messageFault, faultException.Action);

        // 4. Temel HTTP durum kodunu ayarla (izleme/gözlemlenebilirlik için önemli)
        SetHttpStatusCode(problemDetails.Status ?? StatusCodes.Status500InternalServerError);
    }

    private ProblemDetails CreateProblemDetails(Exception exception)
    {
        var exceptionType = exception.GetType();

        if (_exceptionHandlers.TryGetValue(exceptionType, out var handler))
        {
            _logger.LogWarning("Handled Exception {ExceptionMessage}: Time {Time}", exception.Message, DateTime.UtcNow);
            var pd = handler(exception);
            EnrichProblemDetails(pd);
            return pd;
        }

        _logger.LogError(exception, "Unhandled Exception: Time {Time}", DateTime.UtcNow);
        var unknownPd = HandleUnknownException(exception);
        EnrichProblemDetails(unknownPd);
        return unknownPd;
    }

    // --- Özel Exception İşleyicileri ---
    private ProblemDetails HandleBadRequestException(Exception ex)
    {
        var exception = (BadRequestException)ex;
        return new ProblemDetails
        {
            Status = StatusCodes.Status400BadRequest,
            Type = HttpRfcBadRequest,
            Title = _localizer[Localized.BadRequestExceptionTitle],
            Detail = _localizer[exception.LocalizedMessage, exception.Arguments]
        };
    }

    private ProblemDetails HandleValidationException(Exception ex)
    {
        var exception = (ValidationException)ex;
        return new ValidationProblemDetails(exception.Errors)
        {
            Status = StatusCodes.Status400BadRequest,
            Type = HttpRfcBadRequest,
            Title = _localizer[Localized.ValidationExceptionTitle]
        };
    }

    private static ProblemDetails HandleUnknownException(Exception ex)
    {
        return new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Type = HttpRfcInternalError,
            Title = "Beklenmeyen bir hata oluştu",
            Detail = ex.Message
        };
    }

    // --- Yardımcılar ---

    private static void EnrichProblemDetails(ProblemDetails result)
    {
        // Hata raporlaması için dağıtık izleme (distributed tracing) ID'lerini ekle
        var correlation = AsyncStorage<Correlation>.Retrieve();
        if (correlation is not null)
        {
            result.Extensions.Add("correlationId", correlation.Id);
        }

        var traceId = Activity.Current?.Id;
        if (traceId is not null)
        {
            result.Extensions.Add(nameof(traceId), traceId);
        }
    }

    private static XElement TransformToXml(ProblemDetails problemDetails)
    {
        var ns = XNamespace.Get(ProblemDetailsNamespace);

        var element = new XElement(ns + "problem",
            new XElement(ns + "type", problemDetails.Type),
            new XElement(ns + "title", problemDetails.Title),
            new XElement(ns + "status", problemDetails.Status),
            new XElement(ns + "detail", problemDetails.Detail ?? string.Empty));

        foreach (var extension in problemDetails.Extensions)
        {
            element.Add(new XElement(ns + extension.Key, extension.Value?.ToString() ?? string.Empty));
        }

        if (problemDetails is ValidationProblemDetails validationProblemDetails &&
            validationProblemDetails.Errors.Count > 0)
        {
            var errorsElement = new XElement(ns + "errors");
            foreach (var error in validationProblemDetails.Errors)
            {
                var errorElement = new XElement(ns + "error", new XAttribute("field", error.Key));
                foreach (var message in error.Value)
                {
                    errorElement.Add(new XElement(ns + "message", message));
                }
                errorsElement.Add(errorElement);
            }
            element.Add(errorsElement);
        }

        return element;
    }

    private static string GetFaultCodeFromStatus(int status)
    {
        return status switch
        {
            400 => "BadRequest",
            401 => "Unauthorized",
            403 => "Forbidden",
            404 => "NotFound",
            _ => "InternalServerError"
        };
    }

    private void SetHttpStatusCode(int statusCode)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext is not null)
        {
            httpContext.Response.StatusCode = statusCode;
        }
    }
}
```

### Konfigürasyon (3. Adım)
Bu hata işleyicisini bir `IServiceBehavior` olarak bağlamamız gerekiyor. Bu, servise yapılan her bir çağrı için geçerli olmasını sağlar.

```csharp
// Program.cs - Adım 3: Hata Yönetimi ile Üretime Hazır
using CoreWCF;
using CoreWCF.Channels;
using CoreWCF.Configuration;
using CoreWCF.Description;
using CoreWCF.Dispatcher;
using Sample.API.Filters; // ErrorHandler'ımızın olduğu yer
using Sample.API.WCF;
using Microsoft.Extensions.DependencyInjection.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = configuration["Jwt:Issuer"],
            ValidAudience = configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration["Jwt:SecretKey"]!))
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.DefaultPolicy = new AuthorizationPolicyBuilder(JwtBearerDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .Build();
});

builder.Services.AddTransient<InvoiceService>();
builder.Services.AddServiceModelServices();
builder.Services.AddServiceModelMetadata();
builder.Services.AddSingleton<IServiceBehavior, UseRequestHeadersForMetadataAddressBehavior>();
builder.Services.AddSingleton<IErrorHandler, ExceptionHandlerErrorHandler>(); // Bu satırların
builder.Services.AddSingleton<IServiceBehavior, ExceptionHandlerServiceBehaviour>(); // eklenmesi gerek.

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.UseServiceModel(serviceBuilder =>
{
    serviceBuilder.AddService<InvoiceService>()
    .AddServiceEndpoint<InvoiceService, IInvoiceService>(
        new BasicHttpBinding(), "/Services/InvoiceService.svc" 
    );

    var serviceMetadataBehavior = app.Services.GetRequiredService<ServiceMetadataBehavior>();
    serviceMetadataBehavior.HttpGetEnabled = true;
});

app.Run();
```

### Mutlu Son

3. Adım itibarıyla dikkate değer bir şey başardık:

1.  **Entegratör** mutlu çünkü hala `/Services/InvoiceService.svc` adresine SOAP istekleri gönderiyorlar. Entegrasyon desenlerini değiştirmek zorunda kalmadılar.
2.  **Geliştirici** mutlu çünkü `InvoiceService` tertemiz. `MediatR` kullanıyor. İş mantığını kirleten `try/catch` blokları yok. Güvenlik için `[Authorize]` kullanıyor.
3.  **Operasyon Ekibi** mutlu çünkü loglar, istek bir REST istemcisinden de gelse SOAP istemcisinden de gelse tutarlı `ProblemDetails` yapılarını gösteriyor.

Sadece kodu "port" etmedik; etrafındaki ekosistemi modernize ettik ve WCF arayüzünü bir pranga yerine bir uyumluluk katmanı olarak bıraktık.