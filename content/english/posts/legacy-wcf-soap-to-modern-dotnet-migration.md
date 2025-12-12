+++
title = "Legacy WCF/SOAP to Modern .NET: Migration Without Compromise"
date = "2025-12-12T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv"
keywords = [".NET","CoreWCF","SOAP","WCF","migration","legacy systems","modernization"]
description = "Discover how to migrate legacy .NET Framework WCF/SOAP applications to modern .NET without breaking existing SOAP integrations. This guide demonstrates practical patterns for using CoreWCF to preserve your SOAP contracts, embrace modern development practices, and deliver a seamless transition for all stakeholders."
showFullContent = false
readingTime = true
cover = "img/legacy-wcf-soap-to-modern-dotnet-migration/cover.webp"
+++

# Legacy WCF/SOAP to Modern .NET: Migration Without Compromise

You’ve just scoped out the perfect migration plan. The roadmap looks beautiful: you are going to take that aging, monolith .NET Framework 4.8 WCF application and strangle it. You’ll extract the business logic, rewrite the interface as a sleek, stateless REST API on .NET 10, and finally shut down the old IIS server.

You present the plan to the stakeholders. The internal teams are cheering. The DevOps guys are already writing the Dockerfiles. Everyone is very excited.

And then, the email arrives.

It’s from the "Legacy Integrations" team at a major partner, or perhaps a vendor managing a hardware device that hasn't had a firmware update since 2014. Their message is polite but firm:

> *"We cannot consume a REST API. Our systems require a SOAP envelope. We need the WSDL to remain exactly as it is. If you change the contract, we break."*

Suddenly, your migration plan hits a brick wall. You are faced with two bad choices:
1.  **Abort the migration:** Keep the entire project on .NET Framework just to satisfy one interface.
2.  **The "Sidecar" Nightmare:** Build the new system in .NET Core, but keep a zombie .NET Framework server running just to proxy SOAP requests to the new API.

But there is a third option. A bridge.

**CoreWCF.**

CoreWCF allows us to keep the external contract (SOAP) identical to the legacy system, while completely rewriting the hosting model, dependency injection, and performance characteristics using modern .NET.

In this post, we are going to migrate a `InvoiceService` step-by-step. We will start with a raw endpoint, secure it with modern authorization, and finally implement sophisticated error handling that bridges the gap between RESTful `ProblemDetails` and SOAP Faults.

---

## Step 1: The "Hello World" of Migration

Our first goal is simply to get the lights on. We want to prove that we can serve the `IInvoiceService` contract using the Kestrel web server instead of IIS.

We aren't worrying about security or error handling yet. We just want to see XML flowing.

### The Contract and Service

We keep our Service Contract almost exactly as it was in the old system. The only difference is that we are embracing `Task<T>` for true asynchronous processing—a massive performance win over the old WCF implementation. Additionally, we have slightly renamed the existing request and response models to better adhere to the Mediator pattern.

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

// Notice: No attributes here yet, just pure logic.
public class InvoiceService(ISender mediator) : IInvoiceService
{
    public async Task<CreateInvoiceCommandResponse> CreateInvoice(CreateInvoiceCommand command)
    {
        return await mediator.Send(command);
    }
}
```

### The Configuration (Step 1)

Here is the `Program.cs` for the most basic setup. We strip away everything unnecessary.

```csharp
// Program.cs - Step 1: Basic WCF Hosting
using CoreWCF;
using CoreWCF.Configuration;
using CoreWCF.Description;
using Sample.API.WCF;
using CoreWCF.Description;

var builder = WebApplication.CreateBuilder(args);

// 1. Add CoreWCF basics to the DI container
builder.Services.AddTransient<InvoiceService>();
builder.Services.AddServiceModelServices();
builder.Services.AddServiceModelMetadata();
services.AddSingleton<IServiceBehavior, UseRequestHeadersForMetadataAddressBehavior>();

// 2. Register our MediatR and Service
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(Program).Assembly));

var app = builder.Build();

// 3. Configure the CoreWCF Middleware
app.UseServiceModel(serviceBuilder =>
{
    serviceBuilder.AddService<InvoiceService>()
    .AddServiceEndpoint<InvoiceService, IInvoiceService>(
        new BasicHttpBinding(), "/Services/InvoiceService.svc" // The endpoint URL
    );

    // Enable WSDL generation so the stubborn client can update their reference if needed
    var serviceMetadataBehavior = app.Services.GetRequiredService<ServiceMetadataBehavior>();
    serviceMetadataBehavior.HttpGetEnabled = true;
});

app.Run();
```

At this point, we have achieved victory on the transport layer. The integrator can hit `/Services/InvoiceService.svc`, send an XML envelope, and our modern MediatR handlers process the logic.

---

## Step 2: Adding Authorization

The "Plain" service works, but it's dangerous. In the old WCF days, many times developers did not add any authorization support to endpoints and configuring security meant dealing with security certificates.

In CoreWCF, **security is just ASP.NET Core security**.

If your REST API uses JWT Bearer tokens or Cookie Auth, your CoreWCF endpoints can use them too. We don't need to reinvent the wheel. We simply decorate our service with `[Authorize]`.

### The Updated Service
We add `[Authorize]` and inject `IHttpContextAccessor` to prove we can access the user context.

```csharp
using CoreWCF;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Sample.Shared.Services.Interfaces;

namespace Sample.API.WCF;

[Authorize] // <--- The magic keyword. This is standard ASP.NET Core auth.
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

### The Configuration (Step 2)
We need to layer the ASP.NET Core Auth middleware *before* the CoreWCF middleware.

```csharp
// Program.cs - Step 2: Adding Authorization
using CoreWCF.Configuration;
using CoreWCF.Description;
using Sample.API.WCF;
using Microsoft.AspNetCore.Authentication.JwtBearer; // Assuming JWT

var builder = WebApplication.CreateBuilder(args);

// 1. Standard ASP.NET Core Authentication Setup
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

// 2. IMPORTANT: Auth middleware must run before WCF middleware
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

Now, if the integrator sends a request without a valid standard HTTP `Authorization: Bearer` header, CoreWCF will reject it with a 401 before it even reaches our code. Of course our customer needs to implement additional step before making a request but without authn & authz any app will be prone to attacks.

---

## Step 3: The Universal Translator (Unified Error Handling)

This is the hardest part of the story.

In a modern REST API, when something goes wrong (e.g., "Invoice not found"), we throw a custom `BadRequestException` and return a JSON `ProblemDetails` (RFC 7807) response.

In WCF, we are expected to return a `FaultException` wrapped in XML.

If we don't handle this, our nice `ValidationException` will crash the service and return a generic, ugly "Internal Server Error" to the client. We need a translator that catches our modern Exceptions and translates them into SOAP Faults that still contain all the rich data (like validation error fields).

### The Code: ExceptionHandlerErrorHandler

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
/// CoreWCF Error Handler that catches exceptions and returns ProblemDetails as SOAP Fault.
/// This acts as a bridge between modern Exception definitions and legacy SOAP faults.
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

        // Map domain exceptions to specific ProblemDetails handlers
        _exceptionHandlers = new()
        {
            { typeof(BadRequestException), HandleBadRequestException },
            // Add as many as you like
        };
    }

    public bool HandleError(Exception error)
    {
        // Return true to indicate we handled the error and the session is not faulted
        return true;
    }

    public void ProvideFault(Exception error, MessageVersion version, ref Message fault)
    {
        // 1. Convert Exception to ProblemDetails
        var problemDetails = CreateProblemDetails(error);

        // 2. Transform ProblemDetails to XML Element for the SOAP Body
        var problemDetailsElement = TransformToXml(problemDetails);

        // 3. Create a FaultException with the problem details as detail
        var faultException = new FaultException<XElement>(
            problemDetailsElement,
            new FaultReason(problemDetails.Title ?? "An error occurred"),
            new FaultCode(GetFaultCodeFromStatus(problemDetails.Status ?? 500)),
            "ProblemDetails");

        var messageFault = faultException.CreateMessageFault();
        fault = Message.CreateMessage(version, messageFault, faultException.Action);

        // 4. Set the underlying HTTP status code (important for monitoring/observability)
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

    // --- Specific Exception Handlers ---
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
            Title = "An unexpected error occurred",
            Detail = ex.Message
        };
    }

    // --- Helpers ---

    private static void EnrichProblemDetails(ProblemDetails result)
    {
        // Add distributed tracing IDs to the error so clients can report them back to us
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

### The Configuration (Step 3)
We have to wire up this error handler as an `IServiceBehavior`. This ensures it applies to every single call made to the service.

```csharp

// Program.cs - Step 3: Production Ready with Error Handling
using CoreWCF;
using CoreWCF.Channels;
using CoreWCF.Configuration;
using CoreWCF.Description;
using CoreWCF.Dispatcher;
using Sample.API.Filters; // Where our ErrorHandler lives
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
builder.Services.AddSingleton<IErrorHandler, ExceptionHandlerErrorHandler>(); // these lines
builder.Services.AddSingleton<IServiceBehavior, ExceptionHandlerServiceBehaviour>(); // should be added.

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

### The Happy Ending

By Step 3, we have achieved something remarkable:

1.  **The Integrator** is happy because they are still sending SOAP requests to `/Services/InvoiceService.svc`. They didn't have to change their integration pattern.
2.  **The Developer** is happy because the `InvoiceService` is clean. It uses `MediatR`. It doesn't have `try/catch` blocks cluttering the business logic. It relies on `[Authorize]` for security.
3.  **The Operations Team** is happy because the logs show consistent `ProblemDetails` structures regardless of whether the request came from a REST client or a SOAP client.

We didn't just "port" the code; we modernized the ecosystem around it, leaving the WCF interface as a compatibility layer rather than a shackle.
