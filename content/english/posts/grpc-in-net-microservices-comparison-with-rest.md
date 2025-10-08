
+++
title = "gRPC in .NET Microservices: Comparison with REST"
date = "2025-10-08T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["grpc","REST","microservices",".NET"]
description = "Achieve high-performance synchronous communication in your .NET services with gRPC, leveraging features like Protocol Buffers and HTTP/2 streaming to capture performance advantage compared to REST."
showFullContent = false
readingTime = true
cover = "img/grpc-in-net-microservices-comparison-with-rest/cover.jpg"
+++

When .NET microservices need to communcate synchronously with each other, two main options usually come up: REST API and gRPC API.

REST works with JSON over the HTTP/1.1 protocol; it’s easy to read, supported by all browsers, and simple to debug. However, compared to gRPC, REST API payloads are larger, and each request opens its own TCP connection. gRPC, on the other hand, compresses data transmission with Protocol Buffers and carries all traffic over a single HTTP/2 connection, minimizing latency. In this post, we’ll look at how both REST and gRPC work, compare them with examples on .NET 9, and examine which solution is more advantageous in which scenarios. Let’s get started.

## What is this RPC?

If you’ve been developing in the .NET ecosystem for a long time, this is probably not your first encounter with the concept of RPC. In the .NET Framework days, service-to-service communication was also done using SOAP-based WCF services running on IIS. However, with that framework you could end up wrestling with XML-based messages and staying locked into the .NET ecosystem.

Instead, gRPC—which runs over HTTP/2 and can operate much more efficiently, cross-platform, and cross-language—has become the most sensible RPC framework to choose for new projects.

## Differences between REST and gRPC

In a microservices architecture, RPC is not the only option for service-to-service communication. The REST API approach also enables services to communicate easily and widely with each other. However, there are notable differences between REST and gRPC in both architectural design and technical implementation. Let’s examine these differences under design philosophy and technical differences.

### 1. Design Philosophy

**REST** and **gRPC** take different perspectives in API design. In REST, the main approach is to see everything as a **resource** and operate on those resources. HTTP methods (GET, POST, PUT, DELETE) represent the operation being performed, while the URL indicates the resource being acted upon. For example, `/api/books` is a books resource. If you have an endpoint like this, you can more or less guess the operations you can do on it:

- `GET /api/books` returns the list of books,
- `POST /api/books` adds a new book.

In **gRPC**, the perspective is more **action/method** oriented. Each operation is defined like a function call. In gRPC, you directly specify which operation you want to perform and you don’t stick to URL design or HTTP methods.

For example,

- `BookService.GetBooks()` lists the books,
- `BookService.CreateBook()` adds a new book.

While it’s technically possible to define action-style endpoints in REST, this generally doesn’t align with best practices or the standard REST philosophy.

### 2. Technical Differences

REST and gRPC differ across many technical areas—from transport to data format, connection management to error handling. Below are the key topics and differences summarized:

### **Transport Layer**

**REST** uses HTTP/1.1. A separate TCP/TLS connection is established for each REST API request. Especially at high request volumes, this can lead to performance bottlenecks such as **head-of-line blocking** (one slow request affects the others). Also, in cases requiring continuous bidirectional communication (e.g., live data streams or real-time notifications), you need additional protocols such as WebSocket or Server-Sent Events. In other words, REST is fundamentally based on the request-response model and does not have native streaming support.

**gRPC** works with the modern HTTP/2 protocol. Thanks to HTTP/2’s **multiplexing** feature, many concurrent requests and responses can be carried over a single TCP connection. This provides high performance and low latency. With HTTP/2’s native streaming and header compression, gRPC makes real-time and bidirectional communication much easier and more efficient.

gRPC typically defines service interfaces and message structures with **Protocol Buffers** (Protobuf). The service definition explicitly specifies the remotely callable methods and message schemas.

Here’s an example:

```protobuf
service HelloService {
  rpc SayHello (HelloRequest) returns (HelloResponse);
}

message HelloRequest {
  string greeting = 1;
}

message HelloResponse {
  string reply = 1;
}

```

gRPC supports four different communication (RPC) patterns:

**Unary**

The classic pattern: the client sends one request, the server returns one response. Similar to REST’s request-response model. It can be defined as follows.

```protobuf
rpc SayHello(HelloRequest) returns (HelloResponse);

```

**Server Streaming**

The client sends a single request, and the server can return a stream of multiple response messages. The client reads the server’s data stream one by one.

```protobuf
rpc LotsOfReplies(HelloRequest) returns (stream HelloResponse);

```

**Client Streaming**

The client sends multiple messages (a stream) to the server. After sending all messages, it receives a single response from the server. Useful for large uploads or batch updates.

```protobuf
rpc LotsOfGreetings(stream HelloRequest) returns (HelloResponse);

```

**Bidirectional Streaming RPC**

Both client and server can independently send data streams to each other at the same time. The streams operate independently; ordering is preserved within each stream. Suitable for real-time chat applications or live data transfer.

```protobuf
rpc BidiHello(stream HelloRequest) returns (stream HelloResponse);

```

### **Data**

- **REST:** Messages are typically carried in human-readable **JSON** format. JSON is readable and flexible, but results in larger payload sizes and higher parsing cost. A strict schema is not required. Documentation is often added via OpenAPI/Swagger, but you can run into type mismatches at runtime.
- **gRPC:** Uses a binary and compressed format called **Protocol Buffers (Protobuf)**. Protobuf messages are small and fast, reducing network and CPU cost. All data types and methods are defined in a `.proto` file. Server and client code is generated automatically, providing strong type safety.

### **Performance and Efficiency**

- **REST:** Due to JSON’s larger size and the limitations of HTTP/1.1, latency and resource consumption increase under high traffic.
- **gRPC:** Thanks to small packet sizes and multiple requests over a single connection via HTTP/2, it provides lower latency, higher RPS (requests per second), and more efficient network usage.

### **Browser and Platform Compatibility**

- **REST:** Can be called directly from the browser and easily integrated with fetch/AJAX.
- **gRPC:** Cannot be used directly from the browser; it requires extra layers such as gRPC-Web or JSON Transcoding, so it’s not preferred in scenarios that include the browser.

## Which scenarios call for REST or gRPC?

When choosing between REST and gRPC, looking only at technical details may not be sufficient; business needs, target users, and integration requirements are at least as important as performance. Here are some typical scenarios and suggestions:

### When should you use REST?

- **Browser or third-party integration:** If your API will be consumed directly by web browsers or external applications, REST provides a more common and accessible solution.
- **Public APIs:** Thanks to JSON’s readability and the widespread support for HTTP/1.1, REST-based APIs are easy for developers to test and document.
- **Simple CRUD operations:** For resource-oriented operations (e.g., products, orders) and classic GET/POST/PUT/DELETE flows, REST is simple and clear.
- **Caching/Proxy needs:** If you need to do caching or routing via CDN or reverse proxy, REST is more advantageous because it aligns fully with the HTTP standard.

### When should you use gRPC?

- **Microservice-to-microservice communication:** For high-volume, low-latency service-to-service traffic within the same infrastructure, gRPC provides serious advantages.
- **Mobile and IoT devices:** The binary format and small message sizes reduce data consumption.
- **Real-time streaming requirements:** For applications like chat, live scores, or notifications where server-to-client or bidirectional streaming is needed, gRPC offers native streaming support.
- **Language independence:** If you want strongly typed communication across multiple programming languages, Protobuf makes compatibility easy.
- **Stronger type safety:** With compiled contracts and code generation, the error rate in API consumption drops.

## Comprehensive .NET example: Books service

Let’s build a book management service using both REST and gRPC. In this example, we’ll also see the different streaming modes gRPC offers.

### Project setup

First, add the required packages:

```bash
dotnet new web -n BookService
cd BookService
dotnet add package Grpc.AspNetCore
dotnet add package Grpc.AspNetCore.Server.Reflection
dotnet add package Grpc.Tools

```

### REST API implementation

```csharp
// Models/Book.cs
namespace BookService.Models;

public class Book
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public int Year { get; set; }
    public decimal Price { get; set; }
}

```

```csharp
// Controllers/BooksController.cs
using Microsoft.AspNetCore.Mvc;
using BookService.Models;

namespace BookService.Controllers;

[ApiController]
[Route("api/books")]
public class BooksController : ControllerBase
{
    private static readonly List<Book> Books = Book.GenerateBooks();

    [HttpGet]
    public IActionResult GetBooks()
    {
        return Ok(Books);
    }

    [HttpGet("{id}")]
    public IActionResult GetBook(int id)
    {
        var book = Books.FirstOrDefault(b => b.Id == id);
        if (book == null)
            return NotFound();

        return Ok(book);
    }

    [HttpPost]
    public IActionResult CreateBook([FromBody] Book book)
    {
        book.Id = Books.Max(b => b.Id) + 1;
        Books.Add(book);
        return CreatedAtAction(nameof(GetBook), new { id = book.Id }, book);
    }
}

```

### gRPC service — Protobuf definitions

```protobuf
// Protos/books.proto
syntax = "proto3";

option csharp_namespace = "BookService.Grpc";

package books;

// Main service definition
service BookService {
  // Unary RPC - Get all books
  rpc GetBooks (GetBooksRequest) returns (BookList);

  // Server Streaming - Stream books one by one
  rpc StreamBooks (StreamBooksRequest) returns (stream Book);

  // Client Streaming - Bulk add books
  rpc AddBooksStream (stream Book) returns (AddBooksResponse);

  // Bidirectional Streaming - Real-time book search
  rpc SearchBooksStream (stream SearchRequest) returns (stream Book);
}

message Book {
  int32 id = 1;
  string title = 2;
  string author = 3;
  int32 year = 4;
  double price = 5;
}

message GetBooksRequest {
  // Empty request message
}

message BookList {
  repeated Book books = 1;
}

message StreamBooksRequest {
  int32 delay_ms = 1; // Delay between each book (ms)
}

message AddBooksResponse {
  int32 count = 1;
  string message = 2;
}

message SearchRequest {
  string query = 1;
}

```

### gRPC service — Implementation

```csharp
// Services/GrpcBookService.cs
using Grpc.Core;
using BookService.Grpc;

namespace BookService.Services;

public class GrpcBookService : Grpc.BookService.BookServiceBase
{
    private static readonly List<BookService.Grpc.Book> Books = BookService.Models.Book.GenerateBooks()
        .Select(b => new BookService.Grpc.Book { Id = b.Id, Title = b.Title, Author = b.Author, Year = b.Year, Price = (double)b.Price })
        .ToList();

    // Unary RPC - Classic request-response
    public override Task<BookList> GetBooks(GetBooksRequest request, ServerCallContext context)
    {
        var response = new BookList();
        response.Books.AddRange(Books);

        return Task.FromResult(response);
    }

    // Server Streaming - Server streams books one by one
    public override async Task StreamBooks(StreamBooksRequest request,
        IServerStreamWriter<BookService.Grpc.Book> responseStream,
        ServerCallContext context)
    {
        foreach (var book in Books)
        {
            // Cancellation check
            if (context.CancellationToken.IsCancellationRequested)
            {
                break;
            }

            await responseStream.WriteAsync(book);

            // Wait for the specified duration (to demonstrate streaming)
            if (request.DelayMs > 0)
            {
                await Task.Delay(request.DelayMs);
            }
        }
    }

    // Client Streaming - Client sends multiple books
    public override async Task<AddBooksResponse> AddBooksStream(
        IAsyncStreamReader<BookService.Grpc.Book> requestStream,
        ServerCallContext context)
    {
        int count = 0;
        int maxId = Books.Any() ? Books.Max(b => b.Id) : 0;

        await foreach (var book in requestStream.ReadAllAsync())
        {
            book.Id = ++maxId;
            Books.Add(book);
            count++;
        }

        return new AddBooksResponse
        {
            Count = count,
            Message = $"Successfully added {count} books"
        };
    }

    // Bidirectional Streaming - Real-time two-way search
    public override async Task SearchBooksStream(
        IAsyncStreamReader<SearchRequest> requestStream,
        IServerStreamWriter<BookService.Grpc.Book> responseStream,
        ServerCallContext context)
    {
        await foreach (var searchRequest in requestStream.ReadAllAsync())
        {
            var results = Books.Where(b =>
                b.Title.Contains(searchRequest.Query, StringComparison.OrdinalIgnoreCase) ||
                b.Author.Contains(searchRequest.Query, StringComparison.OrdinalIgnoreCase)
            ).ToList();

            foreach (var book in results)
            {
                await responseStream.WriteAsync(book);
            }
        }
    }
}

```

### Program.cs configuration

```csharp
// Program.cs
using BookService.Services;

var builder = WebApplication.CreateBuilder(args);

// REST API services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// gRPC services
builder.Services.AddGrpc();

var app = builder.Build();

// Swagger (for REST)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();

    // gRPC reflection (for development)
    app.MapGrpcReflectionService();
}

// REST endpoints
app.MapControllers();

// gRPC endpoints
app.MapGrpcService<GrpcBookService>();

app.Run();

```

### .csproj file

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Grpc.AspNetCore" Version="2.60.0" />
    <PackageReference Include="Grpc.AspNetCore.Server.Reflection" Version="2.60.0" />
    <PackageReference Include="Grpc.Tools" Version="2.60.0">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
  </ItemGroup>

  <ItemGroup>
    <Protobuf Include="Protos\\books.proto" />
  </ItemGroup>

</Project>

```

Also, if your locally running app won’t run over HTTPS, you need to open a separate port for HTTP/2 apart from the HTTP/1 port. To do this, add the following definition in `appsettings.json` to open the relevant ports:

```json
  "Kestrel": {
    "Endpoints": {
      "Http": {
        "Protocols": "Http1",
        "Url": "http://*:5000"
      },
      "gRPC": {
        "Protocols": "Http2",
        "Url": "http://*:5001"
      }
    }
  },

```

## gRPC client examples

Now let’s look at client examples using different streaming modes:

```csharp
// Client/GrpcClientExamples.cs
using Grpc.Net.Client;
using BookService.Grpc;

namespace BookService.Client;

public class GrpcClientExamples
{
    private readonly GrpcChannel _channel;
    private readonly Grpc.BookService.BookServiceClient _client;

    public GrpcClientExamples(string serverAddress = "http://localhost:5001")
    {
        _channel = GrpcChannel .ForAddress(serverAddress, new GrpcChannelOptions
				 {
						 // Disable HTTPS validation. Use carefully in production.
				     HttpHandler = new HttpClientHandler
				     {
				         ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
				     }
				 });
        _client = new Grpc.BookService.BookServiceClient(_channel);
    }

    // Unary RPC example
    public async Task UnaryCallExample()
    {
        Console.WriteLine("=== Unary Call Example ===");
        var request = new GetBooksRequest();
        var response = await _client.GetBooksAsync(request);

        Console.WriteLine($"Received {response.Books.Count} books:");
        foreach (var book in response.Books)
        {
            Console.WriteLine($"- {book.Title} by {book.Author} ({book.Year})");
        }
    }

    // Server streaming example
    public async Task ServerStreamingExample()
    {
        Console.WriteLine("\\n=== Server Streaming Example ===");
        var request = new StreamBooksRequest { DelayMs = 500 };

        using var call = _client.StreamBooks(request);

        await foreach (var book in call.ResponseStream.ReadAllAsync())
        {
            Console.WriteLine($"Received: {book.Title} - ${book.Price}");
        }

        Console.WriteLine("Streaming completed");
    }

    // Client streaming example
    public async Task ClientStreamingExample()
    {
        Console.WriteLine("\\n=== Client Streaming Example ===");

        using var call = _client.AddBooksStream();

        var booksToAdd = new[]
        {
            new Book { Title = "Design Patterns", Author = "Gang of Four", Year = 1994, Price = 59.99 },
            new Book { Title = "Head First Design Patterns", Author = "Eric Freeman", Year = 2004, Price = 44.99 },
            new Book { Title = "Microservices Patterns", Author = "Chris Richardson", Year = 2018, Price = 49.99 }
        };

        foreach (var book in booksToAdd)
        {
            await call.RequestStream.WriteAsync(book);
            Console.WriteLine($"Sent: {book.Title}");
            await Task.Delay(300); // Simulated delay
        }

        await call.RequestStream.CompleteAsync();
        var response = await call;

        Console.WriteLine($"Result: {response.Message}");
    }

    // Bidirectional streaming example
    public async Task BidirectionalStreamingExample()
    {
        Console.WriteLine("\\n=== Bidirectional Streaming Example ===");

        using var call = _client.SearchBooksStream();

        // Read results in the background
        var readTask = Task.Run(async () =>
        {
            await foreach (var book in call.ResponseStream.ReadAllAsync())
            {
                Console.WriteLine($"Found: {book.Title} by {book.Author}");
            }
        });

        // Send search queries
        var queries = new[] { "Clean", "Design", "Refactoring", "Domain" };

        foreach (var query in queries)
        {
            Console.WriteLine($"Searching for: {query}");
            await call.RequestStream.WriteAsync(new SearchRequest { Query = query });
            await Task.Delay(1000); // Wait after each search
        }

        await call.RequestStream.CompleteAsync();
        await readTask;

        Console.WriteLine("Bidirectional streaming completed");
    }

    public async ValueTask DisposeAsync()
    {
        await _channel.ShutdownAsync();
        _channel.Dispose();
    }
}

// Usage example
public class Program
{
    public static async Task Main(string[] args)
    {
        await using var client = new GrpcClientExamples();

        await client.UnaryCallExample();
        await client.ServerStreamingExample();
        await client.ClientStreamingExample();
        await client.BidirectionalStreamingExample();
    }
}

```

## Testing with grpcurl

`grpcurl` is a curl-like command-line tool for gRPC services. Let’s test our service:

### Installing grpcurl

```bash
# macOS (Homebrew)
brew install grpcurl

# Linux
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest

# Windows (Chocolatey)
choco install grpcurl

```

### grpcurl usage examples

```bash
# 1. What services exist on the server? (Requires reflection)
grpcurl -plaintext localhost:5001 list

# Output:
# books.BookService
# grpc.reflection.v1alpha.ServerReflection

# 2. List the methods of BookService
grpcurl -plaintext localhost:5001 list books.BookService

# Output:
# books.BookService.AddBooksStream
# books.BookService.GetBooks
# books.BookService.SearchBooksStream
# books.BookService.StreamBooks

# 3. Unary RPC call - Get all books
grpcurl -plaintext localhost:5001 books.BookService/GetBooks

# Output:
# {
#   "books": [
#     {
#       "id": 1,
#       "title": "Dune",
#       "author": "Frank Herbert",
#       "year": 1965,
#       "price": 29.99
#     },
#     ...
#   ]
# }

```

## **Performance comparison: REST vs gRPC benchmark**

It’s nice to see the theoretical advantages, but let’s run a comprehensive benchmark to measure the real performance difference. Using BenchmarkDotNet, we’ll compare REST and gRPC across different scenarios.

### Benchmark setup

```csharp
// BookService.Benchmark/BookServiceBenchmark.cs
using BenchmarkDotNet.Attributes;
using Grpc.Net.Client;
using BookService.Grpc;
using System.Net.Http.Json;

namespace BookService.Benchmark;

[MemoryDiagnoser]
[SimpleJob(warmupCount: 3, iterationCount: 10)]
public class BookServiceBenchmark
{
    private HttpClient? _httpClient;
    private GrpcChannel? _grpcChannel;
    private Grpc.BookService.BookServiceClient? _grpcClient;

    private const string RestUrl = "http://localhost:5000";
    private const string GrpcUrl = "http://localhost:5001";

    [GlobalSetup]
    public void Setup()
    {
        // REST client setup
        _httpClient = new HttpClient { BaseAddress = new Uri(RestUrl) };

        // gRPC client setup - with HTTP/2 optimizations
        _grpcChannel = GrpcChannel.ForAddress(GrpcUrl, new GrpcChannelOptions
        {
            MaxReceiveMessageSize = 4 * 1024 * 1024, // 4MB
            MaxSendMessageSize = 4 * 1024 * 1024,    // 4MB
        });
        _grpcClient = new Grpc.BookService.BookServiceClient(_grpcChannel);
    }

    [Benchmark(Baseline = true)]
    public async Task<int> REST_GetAllBooks()
    {
        var books = await _httpClient!.GetFromJsonAsync<List<BookDto>>("/api/books");
        return books?.Count ?? 0;
    }

    [Benchmark]
    public async Task<int> gRPC_GetAllBooks()
    {
        var response = await _grpcClient!.GetBooksAsync(new GetBooksRequest());
        return response.Books.Count;
    }

    [Benchmark]
    public async Task<int> REST_GetAllBooks_10Times()
    {
        int totalCount = 0;
        for (int i = 0; i < 10; i++)
        {
            var books = await _httpClient!.GetFromJsonAsync<List<BookDto>>("/api/books");
            totalCount += books?.Count ?? 0;
        }
        return totalCount;
    }

    [Benchmark]
    public async Task<int> gRPC_GetAllBooks_10Times()
    {
        int totalCount = 0;
        for (int i = 0; i < 10; i++)
        {
            var response = await _grpcClient!.GetBooksAsync(new GetBooksRequest());
            totalCount += response.Books.Count;
        }
        return totalCount;
    }

    [GlobalCleanup]
    public async Task Cleanup()
    {
        _httpClient?.Dispose();
        if (_grpcChannel != null)
        {
            await _grpcChannel.ShutdownAsync();
            _grpcChannel.Dispose();
        }
    }
}

```

### Benchmark results

Actual performance results obtained after optimizations:

| Method | Mean | Error | StdDev | Ratio | RatioSD | Allocated | Alloc Ratio |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **REST_GetAllBooks** | 332.3 μs | 42.42 μs | 28.06 μs | 1.00 | 0.00 | 22.91 KB | 1.00 |
| **gRPC_GetAllBooks** | 296.9 μs | 18.10 μs | 10.77 μs | **0.90** | 0.06 | 25.66 KB | 1.12 |
| **REST_GetAllBooks_10Times** | 3,257.1 μs | 364.16 μs | 240.87 μs | 9.85 | 0.99 | 227.61 KB | 9.94 |
| **gRPC_GetAllBooks_10Times** | 2,883.9 μs | 338.63 μs | 223.99 μs | **8.74** | 1.05 | 255.17 KB | 11.14 |

### Analysis of the results

For single-request performance, gRPC runs about 10% faster than REST (296.9 μs vs 332.3 μs). This advantage stems from Protocol Buffers’ binary serialization format compared to JSON. In multiple-request scenarios, gRPC’s performance advantage becomes more pronounced, rising to about 11.5% (2,883.9 μs vs 3,257.1 μs). This increase can be explained by HTTP/2’s connection reuse.

In terms of memory usage, gRPC consumes about 12% more memory compared to REST (25.66 KB vs 22.91 KB). This extra memory usage is due to the overhead required for HTTP/2 connection management. However, given the performance improvements, this memory increase can be considered an acceptable trade-off.

## Summary

This article compares **REST and gRPC** for **synchronous** inter-service communication in the .NET 9 ecosystem across architectural approach, technical underpinnings, and performance. REST, with JSON over HTTP/1.1, offers easy accessibility, browser compatibility, and caching/proxy advantages; gRPC provides lower latency and stronger type safety thanks to HTTP/2’s multiplexing and native **streaming** capabilities plus Protobuf. The post includes both a REST controller and a gRPC service (unary, server/client/bidirectional streaming) in the same “Books” domain, along with **grpcurl** test steps. BenchmarkDotNet results show that gRPC is roughly **10%** faster on single calls and around **11%** faster on consecutive calls than REST, at the cost of a small increase in memory usage.

If you’d like access to the source code, you can find the entire project on my GitHub:

[GitHub - berkslv/lecture-grpc](https://github.com/berkslv/lecture-grpc)

## Conclusion

Thanks for reading! 🎉 To keep up with my research in software development, follow [@berkslv](https://x.com/berkslv).