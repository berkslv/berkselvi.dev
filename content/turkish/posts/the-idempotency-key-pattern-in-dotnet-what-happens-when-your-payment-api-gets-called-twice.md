+++
title = ".NET'te Idempotency Key Pattern: Ödeme API'niz İki Kere Çağrılırsa Ne Olur?"
date = "2026-07-22T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["idempotency key", "idempotent api nedir", ".NET", "ödeme api", "microservices", "distributed systems", "retry mekanizması", "aspnet core", "mükerrer ödeme engelleme"]
description = "Ödeme retry'larının mükerrer çekimlere yol açmasını engelleyen idempotent bir API tasarlamak için .NET'te idempotency key pattern'ini nasıl uygulayacağınızı öğrenin."
showFullContent = false
readingTime = true
cover = "img/the-idempotency-key-pattern-in-dotnet-what-happens-when-your-payment-api-gets-called-twice/cover.webp"
+++

Müşteri "Öde" butonuna basıyor. İstek API'nize düşüyor, ödeme sağlayıcınız kartı çekiyor ve sonra... response timeout'a düşüyor. Mobil uygulama ödemenin başarılı olup olmadığını bilmiyor, bu yüzden bildiği tek şeyi yapıyor: retry atıyor. Şimdi tek bir sipariş için iki başarılı çekim, sinirli bir müşteri ve "iki kere para çekildi" diye başlayan bir destek talebiniz var.

Parayla, kuyruklarla veya üçüncü parti API'lerle ilgilenen herhangi bir şey geliştirdiyseniz, bu senaryonun hipotetik olmadığını zaten biliyorsunuzdur. Ağ kesintileri, client timeout'ları ve load balancer retry'ları distributed system'lerin gerçeği. **Idempotency key pattern**, retry sayısı ne olursa olsun aynı mantıksal isteğin yalnızca bir kez uygulanmasını garanti eden, production seviyesindeki ödeme API'lerinin kullandığı yöntem. Bu yazıda bunun neden önemli olduğunu, önlem alınmazsa genelde nelerin ters gittiğini ve .NET API'de nasıl doğru şekilde uygulanacağını anlatacağım.

## Problem: "At least once delivery" Varsayılan Davranıştır

Rahatsız edici bir gerçek var: güvenilir olmayan bir ağ üzerinden bir isteğin "tam olarak bir kez" teslim edildiğini garanti edemezsiniz. TCP bağlantıları response ortasında kopabilir, HTTP client'lar timeout'a düşebilir, load balancer'lar veya mobil uygulamalar 5xx hatalarında ve timeout'larda retry atabilir. Gerçekçi olarak inşa edebileceğiniz en iyi şey **en az bir kez teslimat** (at-least-once delivery), yani endpoint'iniz tamamen aynı mantıksal isteği iki, üç, hatta on kez alabilir.

`GET /orders/123` isteği için bu zararsız. Veriyi iki kez okumak hiçbir şeyi değiştirmez. Ama `POST /payments/charge` için, bu retry'ların her biri yepyeni bir çekim tetikleyebilir, çünkü server açısından bu, yeni ve alakasız bir istek gibi görünür.

## Eski Yöntem: Mükerrer İsteklere Karşı Hiçbir Koruma Yok

Çoğu ekip hiçbir koruma olmadan başlar. Tipik, naif bir ödeme endpoint'i şöyle görünür:

```csharp

[HttpPost("charge")]
public async Task<IActionResult> ChargeCard([FromBody] ChargeRequest request)
{
    var result = await _paymentGateway.ChargeAsync(request.CardToken, request.Amount);

    await _orderRepository.MarkAsPaidAsync(request.OrderId, result.TransactionId);

    return Ok(result);
}

```

Bu, happy path'te gayet iyi çalışır. Ama client, aslında başarılı olmak üzere olan bir response'u beklerken timeout'a düşerse neler olduğuna bakalım:

1. Client, `#4711` numaralı sipariş için `POST /payments/charge` isteği gönderir.
2. Server payment gateway'i çağırır, kart başarıyla çekilir.
3. Server response dönmeden önce, client'ın HTTP timeout'u devreye girer.
4. Client, standart retry mantığını izleyerek aynı isteği tekrar gönderir.
5. Server ilk denemeyi hiç hatırlamadığı için kartı ikinci kez çeker.

Bunu "timeout olmasın yeter" diyerek çözemezsiniz, çünkü timeout'lar, kopan bağlantılar ve process crash'leri **microservices** ve diğer **distributed system**'lerde ağ üzerinden çalışan bir servisi işletmenin normal bir parçası. Çözüm retry'ları önlemek değil, doğru tasarlanmış bir **idempotent API** ile retry'ları güvenli hale getirmek.

## Neden Idempotency Key?

**Idempotency key**, genellikle client tarafında üretilen bir UUID olan, çağıranın isteğe eklediği benzersiz bir tanımlayıcıdır. API'nize şunu söyler: "bu belirli deneme, kaç kere görürsen gör, tek bir mantıksal işlemi temsil ediyor." Server'ın görevi şudur:

- İlk başarılı isteğin sonucunu bu key'e karşılık saklamak.
- Aynı key'i taşıyan herhangi bir mükerrer istekte, işlemi yeniden çalıştırmak yerine **saklanan sonucu** döndürmek.
- Aynı key'i farklı bir payload ile yeniden kullanan istekleri reddetmek (client'ın key'i yanlış kullandığının bir işareti).

### Bir API'yi Gerçekten Idempotent Yapan Nedir

Sıradan bir endpoint'i idempotent bir API'ye dönüştürmek, client kaç kere aynı key ile çağırırsa çağırsın, endpoint'in şu üç özelliği sağlaması demektir:

- **Side effect'lerin tek seferde çalışması:** payment gateway, envanter sistemi veya veritabanı yazma işlemi yalnızca bir kez gerçekleşir.
- **Tutarlı response:** her retry, orijinal denemeyle tamamen aynı response body ve status code'u geri alır.
- **Sınırlı yaşam süresi:** key belirli bir süre sonra expire olur, böylece store sonsuza kadar büyümez ve bir client'ın yanlışlıkla yeniden kullandığı bir key yüzünden meşru yeni istekler engellenmez.

Gezegendeki en çok retry atılan API'lerden biri olan Stripe, [tam olarak bu pattern'i dokümante ediyor](https://stripe.com/docs/api/idempotent_requests) ve durum değiştiren tüm isteklerde bir `Idempotency-Key` header'ı zorunlu kılıyor. Bu bir "olsa iyi olur" özelliği değil; retry ağırlıklı SDK'larını bir ödeme API'sine karşı güvenle kullanılabilir kılan temel yapı.

## Idempotency Store'u Tasarlamak

Herhangi bir middleware yazmadan önce, idempotency kayıtlarını saklayacak bir yere ihtiyacınız var. Basit bir relational tablo gayet iyi iş görür:

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

Burada önemli olan birkaç tasarım kararı var:

- **`RequestHash`**: request body'nin hash'i, böylece bir client'ın aynı key'i *farklı* bir payload için yeniden kullanıp kullanmadığını tespit edebilirsiniz (bu bir client bug'ı ve saklanan yanlış response'u sessizce döndürmek yerine `422` dönmelisiniz).
- **`Status`**: sadece "Completed" değil, bir "Processing" state'ine de ihtiyacınız var, böylece ikinci, eşzamanlı bir istek ilkinin hâlâ devam ettiğini anlayabilir. Mükerrer çekime karşı asıl garanti, veritabanının `Key` üzerindeki unique constraint'inin ikinci insert'i reddetmesinden gelir, sadece `Status` kolonundan değil — bunu aşağıdaki store implementasyonunda göreceksiniz.
- **`ExpiresAt`**: idempotency key'ler sonsuza kadar yaşamamalı. Stripe bunları 24 saat sonra expire ediyor; client'larınızın gerçekçi olarak ne kadar süre retry attığına uyan bir pencere seçin ve `ExpiresAt`'i geçmiş satırları silen bir background cleanup job'ı çalıştırın, böylece tablo sınırsızca büyümesin.

Bu şemanın Postgres tarzı SQL (`ON CONFLICT`) kullandığını unutmayın. SQL Server kullanıyorsanız, karşılığı `MERGE` veya `Key` üzerinde unique index ile birleştirilmiş bir `IF NOT EXISTS` guard'ıdır — concurrency güvenliği prensibi aynı, sadece syntax farklı.

## .NET'te Uygulamak

Bunu bir `ActionFilter` olarak inşa edelim, böylece business logic'i kirletmeden idempotency korumasına ihtiyaç duyan herhangi bir endpoint'e deklaratif olarak uygulanabilir.

### 1. Idempotency Store

Bu örnek raw SQL erişimi için [Dapper](https://github.com/DapperLib/Dapper) kullanıyor, önce onu ekleyin:

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

`TryStartProcessingAsync` metodu kritik parça. Bu, atomik bir "yoksa insert et" işlemi olmalı, aksi halde aynı key'e sahip iki eşzamanlı istek de kontrolü geçip ikisi de kartı çekmeye devam edebilir:

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

`ON CONFLICT (Key) DO NOTHING ... RETURNING Key` numarası, veritabanının unique constraint'inin concurrency kontrolünü sizin yerinize yapmasını sağlar, böylece application seviyesinde lock'lara ihtiyacınız kalmaz.

### 2. Action Filter

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

Değinilmesi gereken iki detay var: `JsonSerializerOptions`, uygulamanın gerçek `AddJsonOptions` konfigürasyonundan `IOptions<JsonOptions>` üzerinden alınıyor, böylece replay edilen body, client'ın zaten beklediği casing ve converter'larla eşleşiyor — burada default serializer'ı kullanmak sessizce orijinal response'tan farklı bir payload üretirdi. Ve hatalar dahil her code path artık `CompleteAsync`'i çağırıyor, böylece bir key hiçbir zaman kalıcı olarak `"Processing"`'de takılı kalmıyor; bunu, bir şekilde yine de takılı kalan herhangi bir kaydın otomatik olarak geri alınması için `ExpiresAt` cleanup job'ı ile birleştirin.

### 3. Idempotent API'yi Endpoint'e Uygulamak

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

Artık client, her mantıksal ödeme denemesi için bir UUID üretmekten ve aynı denemenin her retry'ında bunu `Idempotency-Key` header'ı olarak göndermekten sorumlu:

```bash

$ curl -X POST https://api.example.com/payments/charge \
  -H "Idempotency-Key: 8f14e45f-ceea-467e-bb9d-8f7c1a1c1b1a" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"4711","cardToken":"tok_visa","amount":4999}'

```

Response gelmeden ağ koparsa ve client aynı header ile retry atarsa, ikinci istek payment gateway'e bir daha hiç dokunmadan ilk denemede saklanan sonucu döndürür.

## Bunun Çözmediği Şeyler

Idempotency key'ler sihirli bir değnek değil, sınırlarını açıkça belirtmekte fayda var:

- **Outbox pattern'inin yerini tutmaz.** Charge handler'ınız aynı zamanda bir `OrderPaidEvent` yayınlaması gerekiyorsa, klasik dual-write problemini önlemek için o event için hâlâ transactional garantilere ihtiyacınız var.
- **Client işbirliği gerektirir.** Mobil client'ınız aynı UUID'yi yeniden kullanmak yerine her retry'da *yeni* bir UUID üretirse, tüm pattern boşa çıkar. Bunu API kontratınızda açıkça dokümante edin ve key'i her HTTP denemesinde değil, kullanıcı "Öde"ye bastığı anda client tarafında üretmeyi düşünün.
- **Her istekte bir yazma işlemi ekler.** Aşırı yüksek throughput'lu, düşük değerli endpoint'ler için ekstra veritabanı round-trip'i buna değmeyebilir. Bu pattern'i, mükerrerliğin gerçekten pahalıya mal olduğu işlemler için saklayın: ödemeler, sipariş oluşturma ve para veya envanter hareket ettiren her şey.
- **Expiration bir trade-off.** Çok kısa olursa, meşru ama yavaş retry'lar pencerenin dışında kalır ve yine de mükerrer çekim olur. Çok uzun olursa, sürekli büyüyen bir ölü kayıt tablosu biriktirirsiniz. Expire olmuş key'leri temizleyen bir background cleanup job'ı ilk günden inşa edilmeye değer.

## Özet

Retry'lar distributed system'lerde bir edge case değil; payment gateway'lerle, webhook'larla ve birbiriyle konuşan microservices'lerin normal işleyiş koşuludur. Idempotency key pattern retry'ları önlemeye çalışmaz, "bu ödeme çekildi mi?" sorusunu bir tahmin yerine bir lookup'a çevirerek onları zararsız hale getirir. Yazının başındaki, iki kere ücretlendirilip ücretlendirilmediğini merak eden o müşteriyi hatırlayın? Idempotent bir API yerinde olsaydı, o retry sessizce tamamen aynı başarı response'unu döndürürdü ve müşteri bir ağ sorunu yaşandığından haberdar bile olmazdı. Bir ödeme API'si, bir webhook receiver'ı veya mükerrer çalışmanın gerçek bir maliyeti olan başka bir şey inşa ediyorsanız, idempotency key'leri sonradan eklenen bir yama değil, birinci sınıf bir gereksinim olarak ele alın.

---

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme alanındaki araştırmalarımı kaçırmamak için [@berkslv](https://x.com/berkslv) adresinden takipte kalabilirsiniz.
