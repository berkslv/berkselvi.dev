+++
title = "IEnumerable'dan IAsyncEnumerable'a: .NET'te Belleği Öldürmeden Büyük Veri Setlerini Streaming ile İşlemek"
date = "2026-08-02T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["IAsyncEnumerable", "IEnumerable", ".NET", "C#", "büyük veri setleri streaming", "EF Core", "yield return", "ASP.NET Core", "cancellation token"]
description = ".NET'te IAsyncEnumerable, EF Core ile büyük veri setlerini kayıt kayıt streaming yaparak, tüm veriyi ToListAsync ile bir List'e yüklemeye kıyasla bellek kullanımını ciddi oranda azaltır."
showFullContent = false
readingTime = true
cover = "img/from-ienumerable-to-iasyncenumerable-streaming-large-datasets-in-dotnet-without-killing-memory/cover.webp"
+++

Birkaç ay önce, gece çalışan export job'larımızdan biri `OutOfMemoryException` fırlatmaya başladı. Kodda hiçbir şey değişmemişti. Değişen tek şey, okuduğu tablonun boyutuydu—sessizce 200 bin satırdan 4 milyon satıra çıkmıştı. Job tam olarak söylediğimiz şeyi yapıyordu: tüm tabloyu `.ToListAsync()` ile çekip üzerinde döngü kuruyordu. Sadece önce tüm veritabanı tablosunu RAM'e alıyordu ve RAM kaybediyordu.

Bu, neredeyse her .NET geliştiricisinin er ya da geç düştüğü bir tuzak: aslında ihtiyacınız olan şey kayıt kayıt streaming yapan `IAsyncEnumerable<T>` iken `IEnumerable<T>`'ye (ya da onun async kuzeni `Task<List<T>>`'ye) yönelmek. `IEnumerable<T>` ve `IAsyncEnumerable<T>` yüzeysel olarak birbirine benzer ama çok farklı problemleri çözerler, ve yanlışını seçmek sizi gece 2'de 4 milyon satırlık bir tabloyu bellekte sayfalamaya götüren tam olarak budur.

## Bir Bakışta IEnumerable vs IAsyncEnumerable

| Özellik | `IEnumerable<T>` / `List<T>` | `IAsyncEnumerable<T>` |
| --- | --- | --- |
| **Materialization** | Iterasyon başlamadan önce tamamen gerçekleştirilir | Talep üzerine, tek tek çekilir |
| **Bellek ayak izi** | Sonuç kümesinin boyutuyla birlikte büyür | Boyuttan bağımsız olarak kabaca sabit |
| **İlk öğeye kadar geçen süre** | Tüm sorgu/koleksiyonu bekler | İlk öğe hazır olur olmaz kullanılabilir |
| **Cancellation** | Sadece döngünüzü durdurur; zaten yapılmış iş yapılmış kalır | Altta yatan sorguyu akış ortasında durdurabilir |
| **Iterasyon** | Tekrarlanabilir, indekslenebilir | Sadece ileri yönlü, tek geçişli |
| **Tipik kullanım** | Küçük, sınırlı koleksiyonlar | Export'lar, ETL, sayfalanmış API'ler, log işleme |

## Eski Yöntem: Önce Her Şeyi Yükle, Sonra Iterasyon Yap

İşte bizi belaya sokan pattern buydu. Order'ları export etmek için okuyan tipik bir .NET servisi:

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

Bu tamamen makul görünüyor, ve küçük tablolar için de öyle. Ama `ToListAsync()`'in aslında ne yaptığına yakından bakın: sorgunun döndürdüğü **her bir satırı**, kodunuz ilk öğeye dokunmadan önce bellekte duran bir `List<Order>` içinde materialize eder. Sorgu 4 milyon satır döndürüyorsa, `foreach` döngüsünde her seferinde sadece bir satır işlese bile, aynı anda 4 milyon `Order` nesnesini tutacak kadar belleğe ihtiyacınız var.

Belirtiler yavaşça ortaya çıkar:

- **Bellek sıçramaları:** GC baskısı artar, process'in working set'i şişer, ve Kubernetes'te container bellek limitlerine takılınır.
- **İlk sonuçtan önce gecikme:** Caller, tek bir satır görmeden önce *tüm* sorgunun tamamlanmasını bekler, sadece sonuçları bir client'a stream etmek istese bile.
- **Cancellation'da boşa giden iş:** Caller yarı yolda işlemi iptal ederse, her şeyi yükleme maliyetinin tamamını zaten ödemişsinizdir.
- **Backpressure yok:** "Yavaşla, son batch'i hâlâ işliyorum" demenin bir yolu yoktur—veritabanı, driver'ın buffer'layabildiği hızda satır üretmeye devam eder.

Export yapan bir background job, bir CSV stream eden API endpoint'i, ya da bir veri migration script'i için bu pattern ölçeklenmez. Local development'ta 50 satırlık seed veri setinizle çalışır, ve sessizce production'da bozulur.

## Neden IAsyncEnumerable?

.NET Core 3.0, tam olarak bu tür problemi çözmek için `await foreach` syntax'ıyla birlikte `IAsyncEnumerable<T>`'yi tanıttı. Tamamen gerçekleştirilmiş bir koleksiyon döndüren bir method yerine, consumer bir sonraki elemanı her istediğinde asenkron olarak tek tek **çekilen** bir sequence döndürür.

Mental model değişimi önemli:

- **`Task<List<T>>`** şu anlama gelir: "her şey hazır olana kadar bekle, sonra bana tüm şeyi ver."
- **`IAsyncEnumerable<T>`** şu anlama gelir: "bir sonrakini istediğimde bana bir öğe ver, hazır değilse `await` etmeme izin ver."

Bu şunları mümkün kılar:

- **Sabit bellek kullanımı:** Kaynağın 10 satırı ya da 10 milyon satırı olması fark etmeksizin, herhangi bir anda bellekte sadece bir öğenin (ya da küçük bir buffer'ın) olması yeterlidir.
- **Time-to-first-byte iyileştirmeleri:** Bir consumer, tüm sonuç kümesini beklemek yerine ilk satır hazır olur olmaz işlemeye (ya da bir HTTP client veri almaya) başlayabilir.
- **Doğal cancellation desteği:** `IAsyncEnumerable<T>`, `WithCancellation` üzerinden `CancellationToken` ile compose olur, böylece bir stream'i iptal etmek, sadece zaten yüklenmiş bir listeyi atmak yerine gerçekten altta yatan sorguyu durdurur.
- **LINQ ile composability:** `System.Linq.Async` paketiyle, async stream'ler üzerinde `Select`, `Where` ve benzerlerini kullanabilirsiniz, böylece `IEnumerable<T>` ile alışık olduğunuz ifade gücünü kaybetmezsiniz.

Trade-off ise, random access'ten ve ayrı bir sorgu yapmadan sayıyı önceden bilme yeteneğinden vazgeçmenizdir—`IAsyncEnumerable<T>` tasarım gereği sadece ileri yönlü, tek geçişlidir. Streaming senaryoları için bu tam olarak doğru kısıtlamadır.

## yield return ile IAsyncEnumerable Üretmek

Bir `IAsyncEnumerable<T>` üretmenin en basit yolu, `async` bir method içinde `yield return` kullanmaktır. İşte simüle edilmiş bir I/O gecikmesiyle sayıları stream eden, EF Core'u işin içine katmadan önce mekaniği anlamak için kullanışlı, el yazımı bir örnek:

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

`[EnumeratorCancellation]` attribute'u gözden kaçması kolay ama önemli bir detay: bu olmadan, `WithCancellation`'a geçirilen bir `CancellationToken` aslında method body'sine akmaz, ve `ThrowIfCancellationRequested` caller'ın token'ına karşı no-op haline gelir.

Bunu tüketmek şöyle görünür:

```csharp

await foreach (var number in GenerateNumbersAsync(1000, cts.Token))
{
    Console.WriteLine(number);
}

```

Burada *olmayan* şeye dikkat edin: 1000 sayının tamamını tutan ara bir `List<int>` yok. Her `number` üretilir, tüketilir, ve bir sonraki üretilmeden önce garbage collect edilebilir.

## Gerçek Hayat Örneği: EF Core Sorgu Sonuçlarını Streaming Yapmak

Gece 2'de 4 milyon `Order` satırını belleğe sayfalayan export job'a geri dönelim ve doğru şekilde düzeltelim. Entity Framework Core, `AsAsyncEnumerable()` üzerinden `DbSet<T>` ve `IQueryable<T>` üzerinde doğrudan `IAsyncEnumerable<T>` sunar, bu yüzden veritabanı sorguları için kendi `yield return` wrapper'ınızı yazmanıza gerek yoktur:

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

Fark kodda ince ama runtime'da devasa. Sorgu tamamen çalışıp 4 milyon `Order` satırını bir `List<Order>`'a buffer'lamak yerine, EF Core altta yatan `DbDataReader`'ı açık tutar ve `await foreach` döngüsü istedikçe veritabanı bağlantısından satırları stream eder. Sorgunun kendisi için bellek kullanımı, tablo boyutundan bağımsız olarak kabaca sabit kalır—tüm sonuç kümesi için değil, her seferinde bir satır (artı küçük bir internal buffer) için ödeme yaparsınız.

Burada gözden kaçması kolay iki detay önemli. Birincisi, `.AsNoTracking()` dekoratif değildir—olmadan, EF Core'un change tracker'ı, `DbContext`'in ömrü boyunca size verdiği her entity'nin bir snapshot'ını tutar, bu da sorgu kendisi stream ediyor olsa bile, ortadan kaldırmaya çalıştığınız tam bellek büyümesini sessizce geri getirir. İkincisi, yukarıdaki el yazımı `yield return` örneğinin aksine, `AsAsyncEnumerable()` kendi kodunuzda herhangi bir yerde `[EnumeratorCancellation]` eklemenizi gerektirmez—EF Core, `WithCancellation`'a geçirdiğiniz `CancellationToken`'ı internal olarak kendi sorgu pipeline'ına bağlar. Attribute sadece `async IAsyncEnumerable<T>` method'unu kendiniz yazdığınızda önem kazanır.

Bu ayrıca ASP.NET Core ile de temiz bir şekilde compose olur. Bunu minimal bir API endpoint'i olarak sunarsanız, framework, tüm JSON array'ini önce server-side'da buffer'lamak yerine, öğeler hazır oldukça stream'i doğrudan response body'sine serialize eder:

```csharp

app.MapGet("/orders/stream", (AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    return dbContext.Orders
        .AsNoTracking()
        .OrderBy(o => o.Id)
        .AsAsyncEnumerable();
});

```

.NET 6'dan beri, ASP.NET Core'un minimal API'leri `IAsyncEnumerable<T>` dönüş tipini algılar ve altta yatan enumerable öğeleri ürettikçe JSON array'ini, tam listeyi return etmeden önce materialize etmenizi gerektirmek yerine, chunk chunk stream eder. Bilinmeye değer bir tuzak: eğer response compression middleware'i endpoint'in önünde duruyorsa, etkili bir şekilde sıkıştırmak için response'u internal olarak buffer'layabilir, bu da az önce kurduğunuz streaming davranışını sessizce boşa çıkarır—uçtan uca çalıştığını varsaymadan önce gerçek bir client ve `Transfer-Encoding: chunked` ile kontrol etmeye değer.

### Batching Üzerine Bir Not

EF Core'dan bir seferde bir satır stream etmek bellek dostudur, ama her satırı harici bir sisteme yazıyorsanız (bir HTTP call, bir message queue, ikinci bir veritabanı), bunu satır bazında yapmak, öğe başına overhead nedeniyle yavaş olabilir. Yaygın bir orta yol, stream'i chunk'lara batch'lemektir:

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

Şöyle kullanılır:

```csharp

await foreach (var batch in StreamOrdersAsync(cancellationToken).ChunkAsync(500, cancellationToken))
{
    await _messageBus.PublishBatchAsync(batch);
}

```

Yine de belleği sınırlı tutarsınız—4 milyon yerine aynı anda uçuşta sadece 500 order—aynı zamanda downstream sistemin çağrı başına overhead'ini bir batch üzerinden amortize edersiniz.

## IAsyncEnumerable Doğru Araç Olmadığında

`IAsyncEnumerable<T>`, `List<T>` ya da `IEnumerable<T>` için evrensel bir replacement değildir. Şu durumlarda yanlış seçimdir:

- Sayıya ihtiyacınız varsa, yükledikten sonra sort etmeniz gerekiyorsa, ya da random access'e ihtiyacınız varsa (örn. `orders[42]`)—bunlar zaten veriyi materialize etmeyi gerektirir.
- Veri seti gerçekten küçük ve sınırlıysa (20 kategoriden oluşan bir dropdown listesi streaming semantiğine ihtiyaç duymaz).
- Aynı sequence'ı birden fazla kez iterate etmeniz gerekiyorsa—`IAsyncEnumerable<T>` convention gereği tek geçişlidir; yeniden enumerate etmek genellikle altta yatan sorguyu yeniden çalıştırır.
- Zaten tüm koleksiyona ihtiyaç duyan in-memory dönüşümler yapıyorsanız (örn. median hesaplamak), bu durumda streaming, bellek kullanımını azaltmadan sadece `await` overhead'i ekler.

Problemin şekli "potansiyel olarak büyük bir sequence'ı, hepsini bir anda tutmaya ihtiyaç duymadan, tek tek (ya da küçük batch'ler halinde) işlemek" olduğunda özellikle kullanın. Export'lar, ETL pipeline'ları, sayfalanmış API sonuçları, log işleme, ve büyük rapor üretimi klasik durumlardır.

## Özet

Bu araştırmayı başlatan `OutOfMemoryException`, geleneksel anlamda bir bug değildi—kod, `ToListAsync()`'in vaat ettiği şeyi tam olarak yapıyordu. Gerçek çözüm daha akıllı bir allocation stratejisi ya da daha büyük bir container bellek limiti değildi; job'un aslında hiçbir zaman bellekte duran bir `List<Order>`'a ihtiyaç duymadığını fark etmekti. İhtiyacı olan bir stream'di. O export job'ında `ToListAsync()`'i `AsAsyncEnumerable()` ile değiştirdiğimizde, aynı 4 milyon satırlık tablo düz, öngörülebilir bir bellek kullanımıyla işlendi, ve `OutOfMemoryException` bir daha geri gelmedi.

Büyük veri setlerini `IAsyncEnumerable<T>` ile stream etmek her sorguyu daha hızlı yapmaz, ve karmaşıklık ekler—cancellation token'ları, `[EnumeratorCancellation]`, ve random access ile tekrarlanabilir iterasyonun kaybı bedava değildir. Ama probleminiz gerçekten "çok fazla veri okuyup sıralı olarak işlemek" olduğunda, `IAsyncEnumerable<T>`, sınırsız bir bellek problemini sabit bir probleme dönüştürür. Bir dahaki sefere, beklediğinizden daha fazla satır döndürebilecek bir sorguda alışkanlıktan `.ToListAsync()` yazdığınızda, gerçekten listeye mi ihtiyacınız var, yoksa sadece bir sonraki öğeye mi ihtiyacınız var diye durup sormaya değer.

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme alanındaki araştırmalarımı kaçırmamak için [@berkslv](https://x.com/berkslv) adresinden takipte kalabilirsiniz.
</content>
