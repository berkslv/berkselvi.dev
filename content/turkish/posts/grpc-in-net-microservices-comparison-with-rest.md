+++
title = ".NET Mikroservislerinde gRPC: REST ile Karşılaştırma"
date = "2025-10-08T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["grpc","REST","mikroservis",".NET"]
description = ".NET servislerinizde yüksek performanslı senkron iletişimi gRPC ile sağlayarak sağladığı Protocol Buffers ve HTTP/2 streaming gibi özellikleri kullanarak  REST'e kıyasla performans avantajı yakalayalım."
showFullContent = false
readingTime = true
cover = "img/grpc-in-net-mikroservislerinde-comparison-with-rest/cover.jpg"
+++

.NET mikroservislerinin birbirleriyle senkron iletişim kurması gerektiğinde, genellikle iki ana seçenek önümüze çıkar: REST API ve gRPC API.

REST, HTTP/1.1 protokolü üzerinde JSON ile çalışır; kolay okunur, tüm tarayıcılarda desteklenir ve debug işlemi basittir. Ancak REST API’lerde veri paketleri gRPC’ye kıyasla daha büyüktür ve her istek kendi TCP bağlantısını açar. gRPC ise veri iletimini Protocol Buffers ile sıkıştırır ve tüm trafiği tek bir HTTP/2 bağlantısı üzerinden aktararak gecikmeyi minimuma indirir. Bu yazımda hem REST hem gRPC teknolojilerinin çalışma mantığını, .NET 9 üzerinde örneklerle karşılaştırmasını ve hangi senaryolarda hangi çözümün daha avantajlı olduğunu inceleyeceğiz. Haydi başlayalım.

## Nedir bu RPC?

Uzun süredir .NET ekosisteminde uygulama geliştiriyorsanız RPC kavramıyla büyük ihtimal ilk kez karşılaşmıyorsunuz. SOAP tabanlı, IIS üzerinden WCF servisleri kullanarak servisler arası iletişim .NET Framework zamanlarındada yapılıyordu, ancak bu framework ile XML tipinkedi mesajlarla boğuşup, .NET ekosisteminde sıkışıp kalabiliyorduk.

Bunun yerine HTTP/2 üzerinden çok daha performanslı, cross-platform ve cross-language çalışabilen gRPC, yeni projelerde seçebileceğimiz en mantıklı RPC framework’ü haline geliyor. 

## REST ile gRPC arasındaki farklar

Mikroservis mimarisinde, servisler arası iletişim için kullanabileceğimiz tek seçenek RPC değildir. REST API yaklaşımı da, servislerin birbirleriyle kolayca ve yaygın şekilde iletişim kurmasını sağlar. Ancak, REST ve gRPC arasında hem mimari tasarım hem de teknik uygulama açısından önemli farklar bulunmaktadır. Bu farklılıkları tasarım felsefesi ve teknik farklar altında inceleyelim.

### 1. Tasarım Felsefesi

**REST** ve **gRPC**, API tasarımında farklı bakış açılarına sahiptir. REST’te temel yaklaşım, her şeyi bir “kaynak” (resource) olarak görmek ve bu kaynaklar üzerinde işlem yapmaktır. HTTP metodları (GET, POST, PUT, DELETE) yapılan işlemi temsil eder, URL ise üzerinde çalışılan kaynağı belirtir. Örneğin `/api/books` adresi bir kitaplar kaynağıdır, bu şekilde bir endpointe sahipseniz onun üzerinde yapabileceğiniz işlemleri az çok tahmin edebilirsiniz;

- `GET /api/books` isteği kitap listesini döndürür,
- `POST /api/books` ile yeni bir kitap eklersiniz,

gRPC’de ise bakış açısı daha çok “eylem” (action) veya “metot” (method) odaklıdır. Yani her bir işlem, bir fonksiyon çağrısı gibi tanımlanır. gRPC’de doğrudan hangi işlemi yapmak istediğinizi belirtirsiniz ve URL tasarımına veya HTTP metodlarına bağlı kalmazsınız. 

Örneğin,

- `BookService.GetBooks()` ile kitapları listelersiniz,
- `BookService.CreateBook()` ile yeni bir kitap eklersiniz.

REST’te de işlemsel endpoint’ler tanımlamak teknik olarak mümkün olsa da, bu genellikle best practice’lere ve standart REST felsefesine uygun değildir.

### 2. Teknik Farklılıklar

REST ve gRPC arasında, iletişimden veri formatına, bağlantı yönetiminden hata kontrolüne kadar birçok teknik fark bulunur. Aşağıda en önemli başlıklar ve farklar özetlenmiştir:

### **Transport Layer**

**REST** HTTP/1.1 kullanır. Her bir REST API isteği için ayrı bir TCP/TLS bağlantısı kurulur. Bu, özellikle yüksek istek hacminde **head-of-line blocking** (bir isteğin yavaşlaması diğerlerini de etkiler) gibi performans darboğazlarına neden olabilir. Ayrıca, REST’te çift yönlü sürekli iletişim (örneğin canlı veri akışı veya anlık bildirimler) gerektiren durumlarda WebSocket veya Server-Sent Events gibi ek protokoller kullanmak gerekir. Yani REST, temelinde request-response modeline dayanır ve streaming (akış) desteği doğal değildir.

**gRPC** ise modern iletişim protokolü olan HTTP/2 ile çalışır. HTTP/2’nin **multiplexing** özelliği sayesinde tek bir TCP bağlantısı üzerinden eşzamanlı birçok istek ve yanıt taşınabilir. Bu, yüksek performans ve düşük gecikme (latency) sağlar. gRPC, HTTP/2’nin sunduğu native stream ve header compression gibi özelliklerle, gerçek zamanlı ve çift yönlü iletişimi çok daha kolay ve verimli şekilde gerçekleştirir.

gRPC, hizmetlerin arayüzlerini ve mesaj yapısını genellikle **Protocol Buffers** (Protobuf) ile tanımlar. Servis tanımı, uzaktan çağrılabilecek metodları ve mesaj şemalarını açıkça belirtir.

Aşağıda bir örnek görebilirsin

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

gRPC ile 4 farklı iletişim (RPC) yöntemi mümkündür:

**Unary**

En klasik yöntemdir: istemci bir istek gönderir, sunucu bir yanıt döner. REST’teki request-response modeline benzer. Aşağıdaki şekilde tanımlanabilir.

```protobuf
rpc SayHello(HelloRequest) returns (HelloResponse);
```

**Server Streaming**

İstemci tek bir istek gönderir, sunucu ise birden fazla yanıt mesajı akışı (stream) dönebilir. İstemci, sunucudan gelen veri akışını tek tek okur.

```protobuf
rpc LotsOfReplies(HelloRequest) returns (stream HelloResponse);
```

**Client Streaming**

İstemci, sunucuya birden fazla mesaj gönderir (stream). Tüm mesajları gönderdikten sonra sunucudan tek bir yanıt alır. Büyük veri yükleme işlemleri, toplu güncellemeler gibi alanlarda kullanılabilir.

```protobuf
rpc LotsOfGreetings(stream HelloRequest) returns (HelloResponse);
```

**Bidirectional Streaming RPC**

Hem istemci hem sunucu, aynı anda birbirlerine bağımsız şekilde veri akışı gönderebilirler. Akışlar birbirinden bağımsız çalışır; sıralama her bir akış için korunur. Gerçek zamanlı sohbet uygulamaları, canlı veri transferlerinde tercih edilebilir.

```protobuf
rpc BidiHello(stream HelloRequest) returns (stream HelloResponse);
```

### **Veri**

- **REST:** Mesajlar genellikle insan tarafından okunabilir **JSON** formatında taşınır. JSON, okunabilir ve esnek ama büyük veri boyutuna ve yüksek ayrıştırma maliyetine sahiptir. Ayrıca kesin bir şema zorunlu değildir. Genellikle OpenAPI/Swagger ile dokümantasyon eklenir, ancak uygulama sırasında tip uyuşmazlıkları yaşanabilir.
- **gRPC:** **Protocol Buffers (Protobuf)** adı verilen ikili (binary) ve sıkıştırılmış bir format kullanır. Protobuf mesajları küçük ve hızlıdır, ağ ve CPU maliyeti düşüktür. Tüm veri tipleri ve metodlar `.proto` dosyasında tanımlanır. Sunucu ve istemci kodları otomatik olarak üretilir, tip güvenliği yüksektir.

### **Performans ve Verimlilik**

- **REST:** JSON’un büyük boyutu ve HTTP/1.1’in sınırlamaları nedeniyle yüksek trafik altında gecikme ve kaynak tüketimi artar.
- **gRPC:** Küçük paket boyutu ve HTTP/2 ile tek bağlantı üzerinden çoklu istek sayesinde daha düşük gecikme, daha fazla RPS (istek/saniye) ve daha verimli ağ kullanımı sağlar.

### **Tarayıcı ve Platform Uyumluluğu**

- **REST:** Doğrudan tarayıcıdan çağrılabilir, fetch/AJAX ile kolayca entegre edilir.
- **gRPC:** Tarayıcıdan doğrudan kullanılamaz; gRPC-Web veya JSON Transcoding gibi ek katmanlara ihtiyaç duyacağı için tarayıcı içeren senaryolarda tercih edilmezler.

## Hangi Senaryolarda REST veya gRPC Seçilmeli?

REST ve gRPC arasında seçim yaparken sadece teknik detaylara bakmak yeterli olmayabilir; iş ihtiyaçları, hedef kullanıcı kitlesi ve entegrasyon gereksinimleri de en az performans kadar önemlidir. İşte bazı tipik senaryolar ve öneriler:

### Ne Zaman REST Kullanılmalı?

- **Tarayıcı veya üçüncü parti entegrasyonu**: Eğer API’nız doğrudan web tarayıcıları veya harici uygulamalar tarafından tüketilecekse REST her zaman daha yaygın ve erişilebilir bir çözüm sunar.
- **public API’ler**: JSON’un okunabilirliği ve HTTP/1.1’in yaygın desteği sayesinde REST tabanlı API’ler, geliştiriciler tarafından kolayca test edilebilir ve dökümante edilebilir.
- **Basit CRUD işlemleri**: Kaynak odaklı (ör. ürünler, siparişler) ve klasik GET/POST/PUT/DELETE işlemleri için REST yalın ve anlaşılırdır.
- **Cache/Proxy ihtiyaçları**: CDN veya reverse proxy üzerinden önbellekleme ve yönlendirme yapmak gerekiyorsa, HTTP standardı ile tam uyumlu olduğu için REST daha avantajlıdır.

### Ne Zaman gRPC Kullanılmalı?

- **Mikroservisler arası iletişim**: Aynı altyapı içinde, yüksek hacimli ve düşük gecikmeli servis-servis trafiği için gRPC ciddi avantaj sağlar.
- **Mobil ve IoT cihazları**: Küçük paket boyutu ve ikili format sayesinde veri tüketimi azalır.
- **Gerçek zamanlı akış gereksinimi**: Sunucudan istemciye ya da çift yönlü veri akışının gerektiği chat, canlı skor, bildirim gibi uygulamalarda gRPC doğal akış desteği sunar.
- **Dil bağımsızlığı**: Birden çok farklı programlama dili arasında tip güvenli bir iletişim kurmak istiyorsanız, Protobuf sayesinde uyumluluk kolayca sağlanır.
- **Daha güçlü tip güvenliği**: Derlenmiş sözleşmeler ve otomatik kod üretimi sayesinde API tüketiminde hata oranı düşer.

## .NET ile Kapsamlı Uygulama Örneği: Books Servisi

Hem REST hem de gRPC ile kitap yönetim servisi oluşturalım. Bu örnekte, gRPC'nin sunduğu farklı streaming modlarını da göreceğiz.

### Proje Kurulumu

İlk olarak gerekli paketleri ekleyelim:

```bash
dotnet new web -n BookService
cd BookService
dotnet add package Grpc.AspNetCore
dotnet add package Grpc.AspNetCore.Server.Reflection
dotnet add package Grpc.Tools

```

### REST API İmplementasyonu

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

### gRPC Servisi - Protobuf Tanımları

```protobuf
// Protos/books.proto
syntax = "proto3";

option csharp_namespace = "BookService.Grpc";

package books;

// Ana servis tanımı
service BookService {
  // Unary RPC - Tüm kitapları getir
  rpc GetBooks (GetBooksRequest) returns (BookList);

  // Server Streaming - Kitapları tek tek stream et
  rpc StreamBooks (StreamBooksRequest) returns (stream Book);

  // Client Streaming - Toplu kitap ekleme
  rpc AddBooksStream (stream Book) returns (AddBooksResponse);

  // Bidirectional Streaming - Gerçek zamanlı kitap arama
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
  // Boş istek mesajı
}

message BookList {
  repeated Book books = 1;
}

message StreamBooksRequest {
  int32 delay_ms = 1; // Her kitap arasında gecikme (ms)
}

message AddBooksResponse {
  int32 count = 1;
  string message = 2;
}

message SearchRequest {
  string query = 1;
}

```

### gRPC Servisi - İmplementasyon

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

    // Unary RPC - Klasik request-response
    public override Task<BookList> GetBooks(GetBooksRequest request, ServerCallContext context)
    {
        var response = new BookList();
        response.Books.AddRange(Books);
        
        return Task.FromResult(response);
    }

    // Server Streaming - Sunucu kitapları tek tek stream eder
    public override async Task StreamBooks(StreamBooksRequest request, 
        IServerStreamWriter<BookService.Grpc.Book> responseStream, 
        ServerCallContext context)
    {
        foreach (var book in Books)
        {
            // İptal kontrolü
            if (context.CancellationToken.IsCancellationRequested)
            {
                break;
            }

            await responseStream.WriteAsync(book);

            // Belirtilen süre kadar bekle (streaming'i göstermek için)
            if (request.DelayMs > 0)
            {
                await Task.Delay(request.DelayMs);
            }
        }
    }

    // Client Streaming - İstemci birden fazla kitap gönderir
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

    // Bidirectional Streaming - İki yönlü gerçek zamanlı arama
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

### Program.cs Konfigürasyonu

```csharp
// Program.cs
using BookService.Services;

var builder = WebApplication.CreateBuilder(args);

// REST API servisleri
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// gRPC servisleri
builder.Services.AddGrpc();

var app = builder.Build();

// Swagger (REST için)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();

    // gRPC reflection (development için)
    app.MapGrpcReflectionService();
}

// REST endpoints
app.MapControllers();

// gRPC endpoints
app.MapGrpcService<GrpcBookService>();

app.Run();

```

### .csproj Dosyası

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

Ayrıca lokalden çalışan uygulamanız https ile çalışmayacaksa HTTP/1 protundan ayrı HTTP/2 için ayrı bir port açmamız gerekiyor. Bunun için appsettings.json dosyasında aşağıdaki tanım eklenerek ilgili portlar açılır.

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

## gRPC Client Örnekleri

Şimdi farklı streaming modlarını kullanan client örnekleri görelim:

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
						 // HTTPS tanımı disable ediliyor. Production ortamda dikkatlı kullanınız
				     HttpHandler = new HttpClientHandler
				     {
				         ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
				     }
				 });
        _client = new Grpc.BookService.BookServiceClient(_channel);
    }

    // Unary RPC Örneği
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

    // Server Streaming Örneği
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

    // Client Streaming Örneği
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
            await Task.Delay(300); // Simüle edilmiş gecikme
        }

        await call.RequestStream.CompleteAsync();
        var response = await call;

        Console.WriteLine($"Result: {response.Message}");
    }

    // Bidirectional Streaming Örneği
    public async Task BidirectionalStreamingExample()
    {
        Console.WriteLine("\\n=== Bidirectional Streaming Example ===");

        using var call = _client.SearchBooksStream();

        // Background'da sonuçları oku
        var readTask = Task.Run(async () =>
        {
            await foreach (var book in call.ResponseStream.ReadAllAsync())
            {
                Console.WriteLine($"Found: {book.Title} by {book.Author}");
            }
        });

        // Arama sorgularını gönder
        var queries = new[] { "Clean", "Design", "Refactoring", "Domain" };

        foreach (var query in queries)
        {
            Console.WriteLine($"Searching for: {query}");
            await call.RequestStream.WriteAsync(new SearchRequest { Query = query });
            await Task.Delay(1000); // Her aramadan sonra bekle
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

// Kullanım örneği
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

## grpcurl ile Test Etme

grpcurl, gRPC servisleri için curl benzeri bir komut satırı aracıdır. Servisimizi test edelim:

### grpcurl Kurulumu

```bash
# macOS (Homebrew)
brew install grpcurl

# Linux
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest

# Windows (Chocolatey)
choco install grpcurl

```

### grpcurl Kullanım Örnekleri

```bash
# 1. Serviste hangi servisler var? (Reflection gerektirir)
grpcurl -plaintext localhost:5001 list

# Çıktı:
# books.BookService
# grpc.reflection.v1alpha.ServerReflection

# 2. BookService'in metodlarını listele
grpcurl -plaintext localhost:5001 list books.BookService

# Çıktı:
# books.BookService.AddBooksStream
# books.BookService.GetBooks
# books.BookService.SearchBooksStream
# books.BookService.StreamBooks

# 3. Unary RPC çağrısı - Tüm kitapları getir
grpcurl -plaintext localhost:5001 books.BookService/GetBooks

# Çıktı:
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

## **Performans Karşılaştırması: REST vs gRPC Benchmark**

Teorik avantajları görmek güzel, ancak gerçek performans farkını ölçmek için kapsamlı bir benchmark yapalım. BenchmarkDotNet kullanarak REST ve gRPC'nin farklı senaryolardaki performansını karşılaştıracağız.

### Benchmark Kurulumu

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
        // REST client kurulumu
        _httpClient = new HttpClient { BaseAddress = new Uri(RestUrl) };

        // gRPC client kurulumu - HTTP/2 optimizasyonları ile
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

### Benchmark Sonuçları

Optimizasyonlar sonrasında elde edilen gerçek performans sonuçları:

| Method | Mean | Error | StdDev | Ratio | RatioSD | Allocated | Alloc Ratio |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **REST_GetAllBooks** | 332.3 μs | 42.42 μs | 28.06 μs | 1.00 | 0.00 | 22.91 KB | 1.00 |
| **gRPC_GetAllBooks** | 296.9 μs | 18.10 μs | 10.77 μs | **0.90** | 0.06 | 25.66 KB | 1.12 |
| **REST_GetAllBooks_10Times** | 3,257.1 μs | 364.16 μs | 240.87 μs | 9.85 | 0.99 | 227.61 KB | 9.94 |
| **gRPC_GetAllBooks_10Times** | 2,883.9 μs | 338.63 μs | 223.99 μs | **8.74** | 1.05 | 255.17 KB | 11.14 |

### Sonuçların Analizi

Tek istek performansı incelendiğinde, gRPC'nin REST'e kıyasla %10 daha hızlı çalıştığı görülüyor (296.9 μs vs 332.3 μs). Bu fark, Protocol Buffers'ın binary serializasyon formatının JSON'a gösterdiği avantajdan kaynaklanmaktadır. Çoklu istek senaryolarında ise gRPC'nin performans üstünlüğü daha da belirginleşiyor ve %11.5'e çıkıyor (2,883.9 μs vs 3,257.1 μs). Bu artış, HTTP/2 protokolünün connection reuse özelliğinin devreye girmesiyle açıklanabilir.

Bellek kullanımı açısından bakıldığında, gRPC'nin REST'e göre %12 daha fazla bellek tükettiği görülmektedir (25.66 KB vs 22.91 KB). Bu ek bellek kullanımı, HTTP/2 bağlantı yönetimi için gerekli olan overhead'dan kaynaklanmaktadır. Ancak elde edilen performans iyileştirmeleri göz önüne alındığında, bu bellek artışı kabul edilebilir bir trade-off olarak değerlendirilebilir.

## Özet

Bu yazı, .NET 9 ekosisteminde mikroservisler arası **senkron** iletişimde REST ve gRPC’yi mimari yaklaşım, teknik altyapı ve performans boyutlarıyla karşılaştırıyor. REST, HTTP/1.1 üzerinde JSON’la kolay erişilebilirlik, tarayıcı uyumluluğu ve cache/proxy avantajı sunarken; gRPC, HTTP/2’nin multiplexing ve doğal **streaming** yetenekleri ile Protobuf sayesinde daha düşük gecikme ve daha güçlü tip güvenliği sağlıyor. Yazıda, aynı “Books” alanında hem REST Controller hem de gRPC servis (unary, server/client/bidirectional streaming) örnekleri ve **grpcurl** ile test adımları bulunuyor. BenchmarkDotNet sonuçları, tekil çağrıda gRPC’nin REST’e kıyasla yaklaşık **%10**, art arda çağrılarda **%11** civarı daha hızlı olduğunu; buna karşılık az miktarda ek bellek kullandığını gösteriyor.

Kaynak koduna erişmek isterseniz projenin tamamını GitHub hesabımda bulabilirsiniz:

https://github.com/berkslv/lecture-grpc

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme alanındaki araştırmalarımı kaçırmamak için [@berkslv](https://x.com/berkslv) adresinden takipte kalabilirsiniz.