+++
title = "Yazılım Mimarisinde Events vs Commands: Kapsamlı Bir .NET Rehberi"
date = "2026-06-22T14:55:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["software architecture", "events vs commands", "event-driven architecture", "cqrs", "dotnet", "mediatr", "microservices", "asynchronous messaging", "system design"]
description = "Software architecture içinde events ve commands arasındaki kritik farkları aydınlatın. .NET kod örnekleri, MediatR ve asynchronous messaging pattern'leri kullanarak microservices'leri nasıl birbirinden ayıracağınızı (decouple) öğrenin."
showFullContent = false
readingTime = true
cover = "img/events-vs-commands-in-software-architecture-a-complete-dotnet-guide/cover.webp"
+++

# Yazılım Mimarisinde Events vs Commands Kavramlarını Aydınlatmak: Kapsamlı Bir .NET Rehberi

Modern yazılım mühendisliği dünyasında, monolitik sistemlerden dağıtık **microservices** mimarilerine geçiş yaygın bir evrimsel yoldur. Sistemler karmaşıklaştıkça, farklı bileşenlerin, modüllerin ve servislerin iletişim kurma şekli; sistemin dayanıklılığını, ölçeklenebilirliğini ve sürdürülebilirliğini belirleyen kritik faktör haline gelir. Eğer sağlam, cloud-native uygulamalar geliştiriyorsanız, bileşenlerinizi birbirinden ayırma (decouple) ihtiyacıyla kaçınılmaz olarak karşılaşırsınız.

Bu iletişim ve decoupling stratejisinin merkezinde iki temel mesajlaşma deseni (pattern) yatar: **Commands** ve **Events**.

İlk bakışta birbirlerine benzeseler de —her ikisi de özünde sistemin bir parçasından diğerine gönderilen ve veri içeren mesajlardır— amaçları, işlenme şekilleri (handling) ve mimari etkileri birbirinden çok farklıdır. **Software architecture içinde events vs commands** ayrımını yanlış anlamak, bir **Event-Driven Architecture (EDA)** tasarlarken veya **Command Query Responsibility Segregation (CQRS)** uygularken düşülen en yaygın tuzaklardan biridir.

Bu kapsamlı rehberde, events ve commands arasındaki teorik farkları keşfedecek, hangisinin ne zaman kullanılacağını analiz edecek ve **.NET** ve C# kullanarak hikaye tadında pratik bir uygulamayı adım adım inceleyeceğiz.

## Dağıtık Sistemlerde Temel İletişim Problemi

Tanımlara dalmadan önce, çözmeye çalıştığımız problemi anlayalım.

Bir e-ticaret uygulaması hayal edin. Kullanıcı "Ödeme Yap" (Checkout) butonuna tıklar. Geleneksel, sıkı sıkıya bağlı (tightly coupled) monolitik bir mimaride, sistem aşağıdaki adımları tek bir senkron akış içinde sırayla yürütebilir:

1. Sepeti doğrula.
2. Stoğu düş.
3. Ödemeyi işle.
4. Fatura oluştur.
5. Onay e-postası gönder.

Eğer e-posta sunucusu çökerse, tüm ödeme süreci başarısız olabilir, ödeme işlemi geri alınabilir ve kullanıcı hüsrana uğrayabilir. Bu sıkı bağ (tight coupling), kırılgan sistemler yaratır.

Bunu çözmek için mimarlar **asynchronous messaging** kavramını devreye sokarlar. Servisler metotları doğrudan çağırmak yerine, bir mediator veya bir message broker (RabbitMQ, Apache Kafka veya AWS ve Google Cloud üzerindeki cloud-native çözümler gibi) aracılığıyla birbirlerine mesaj gönderirler. Peki bu mesajlar nasıl yapılandırılmalıdır? Ödeme servisi, e-posta servisine *bir e-posta göndermesini* mi söylemeli, yoksa sadece *bir siparişin verildiğini* mi belirtmeli?

İşte Commands ve Events arasındaki ayrım bu noktada kritik bir hal alır.

## Command Nedir?

Bir **Command**, bir *niyetin* (intent) ifadesidir. Sistemin belirli bir eylemi gerçekleştirmesi veya durumunu (state) değiştirmesi için yapılan bir istektir.

Bir command'i emir kipiyle verilmiş bir talimat olarak düşünün. Sisteme tam olarak ne yapmasını istediğinizi söylüyorsunuz. Bir istek olduğu için, bir command reddedilebilir. Sistem command'i doğrulayabilir ve iş kuralları, izinler veya geçersiz veriler nedeniyle çalıştırılamayacağına karar verebilir.

### Bir Command'in Temel Özellikleri:

- **Imperative Naming (Emir Kipiyle İsimlendirme):** Command'ler emir kipindeki fiillerle isimlendirilir (örneğin, `PlaceOrderCommand`, `CreateUserCommand`, `ProcessPaymentCommand`).
- **Targeted (Hedefe Yönelik):** Bir command tam olarak **bir** handler'a yönlendirilir (routed). Bir command'i tüm sisteme yayınlamazsınız (broadcast); onu o eylemden sorumlu olan belirli bileşene gönderirsiniz.
- **Can Fail (Başarısız Olabilir):** Durumu (state change) değiştirmeye yönelik bir istek olduğundan, alıcı handler doğrulama başarısız olursa bu isteği reddedebilir (ve genellikle reddeder) ve gönderene bir hata veya exception döndürür.
- **High Coupling (Behavioral):** Command'i gönderen taraf ne yapılması gerektiğini bilmek zorundadır. Fiziksel bağ bir mesaj veriyolu ile soyutlanmış olsa da, bu durum events'e kıyasla daha sıkı bir davranışsal bağ anlamına gelir.

## Event Nedir?

Öte yandan bir **Event**, bir *gerçeğin* (fact) ifadesidir. Geçmişte bir şeyin zaten gerçekleşmiş olduğunun duyurusudur.

Bir event'i reddedemezsiniz çünkü geçmişi değiştiremezsiniz. Eğer bir event yayınlanmışsa (published), state change çoktan gerçekleşmiştir. Sistemdeki bileşenler, bu olaylara tepki vermek ve kendi ardışık süreçlerini tetiklemek için events'i dinlerler.

### Bir Event'in Temel Özellikleri:

- **Past-Tense Naming (Geçmiş Zamanla İsimlendirme):** Events, geçmiş zamanlı fiiller kullanılarak isimlendirilir (örneğin, `OrderPlacedEvent`, `UserCreatedEvent`, `PaymentProcessedEvent`).
- **Broadcasted (Yayınlanan - Publish/Subscribe):** Bir event, bir event bus veya message broker'a yayınlanır. **Sıfır, bir veya birden fazla** handler'ı olabilir. Yayınlayan taraf (publisher), kimin dinlediğini bilmez ve umursamaz.
- **Cannot Be Rejected (Reddedilemez):** Olay zaten gerçekleşmiştir. Abone olanlar (subscribers) bunu işlemek zorundadır. Eğer bir subscriber bir event'i işlemekte başarısız olursa, kendi retry (yeniden deneme) mantığını yürütmelidir; publisher'a bu gerçeği "geri almasını" söyleyemez.
- **Loose Coupling (Gevşek Bağ):** Gönderici (publisher), alıcılardan (subscribers) tamamen izole edilmiştir (decoupled). Publisher sadece bir durum değişikliğini duyurur, bu da mevcut koda hiç dokunmadan sisteme yeni işlevsellikler eklemeyi inanılmaz derecede kolaylaştırır.

## Temel Farklar: Events vs Commands

Kavramları pekiştirmek için yan yana bir karşılaştırma yapalım.

| Özellik | Command | Event |
| --- | --- | --- |
| **Tanım** | Bir eylemi gerçekleştirmek için yapılan istek. | Bir şeyin gerçekleştiğine dair bildirim. |
| **İsimlendirme Standardı** | Emir Kipi (örn. `ShipOrder`) | Geçmiş Zaman (örn. `OrderShipped`) |
| **Yönlendirme / Handlers** | Tam olarak bir handler (1:1). | Sıfırdan çoka kadar handlers (1:N). |
| **Yön** | Noktadan noktaya (Point-to-point). Gönderen bir alıcıyı hedefler. | Publish/Subscribe. Gönderen yayınlar. |
| **Hata Yönetimi** | Reddedilebilir (doğrulama hatası). | Reddedilemez. Geçmiş olaylar değiştirilemez (immutable). |
| **Gönderenin Bilgisi** | *Ne* yapılması gerektiğini bilir. | Event ile *kimin* ilgilendiğini bilmez. |

## .NET Uygulama Hikayesi: Hayata Geçirmek

Bu kavramların gerçek dünya uygulamalarında nasıl bir araya geldiğini göstermek için **.NET** kullanarak bir hikaye anlatalım. .NET ekosisteminde in-memory (bellek içi) mesajlaşma ve **CQRS** pattern'leri için standart uygulama olan, oldukça popüler **MediatR** kütüphanesini kullanacağız.

Bir Sipariş Yönetimi microservice'i inşa ettiğimizi hayal edelim.

### Adım 1: Command'i Tanımlamak

Yolculuk, bir kullanıcının sepetini onaylamasıyla başlar. API controller HTTP isteğini alır ve bir command oluşturur. Emir kipiyle isimlendirmeye dikkat edin. Mesajlar değiştirilemez (immutable) olması gerektiği için C# record'larını kullanıyoruz.

```csharp
using MediatR;

namespace ECommerce.Domain.Commands;

// The Command: A request that returns a strongly typed result
public record PlaceOrderCommand(
    Guid CustomerId, 
    List<CartItem> Items, 
    string ShippingAddress
) : IRequest<OrderResult>;

public record CartItem(Guid ProductId, int Quantity, decimal Price);

public record OrderResult(bool IsSuccess, string Message, Guid? OrderId = null);

```

### Adım 2: Command'i İşlemek (Handling)

Command tam olarak *bir* handler'a yönlendirilir. Bu handler temel iş mantığını içerir. İsteği doğrular, veritabanı durumunu günceller ve eğer başarılı olursa bir Event üretir.

```csharp
using MediatR;

namespace ECommerce.Application.Handlers.Commands;

public class PlaceOrderCommandHandler : IRequestHandler<PlaceOrderCommand, OrderResult>
{
    private readonly IOrderRepository _repository;
    private readonly IMediator _mediator;

    public PlaceOrderCommandHandler(IOrderRepository repository, IMediator mediator)
    {
        _repository = repository;
        _mediator = mediator;
    }

    public async Task<OrderResult> Handle(PlaceOrderCommand request, CancellationToken cancellationToken)
    {
        // 1. Validation (The command can be rejected!)
        if (request.Items == null || !request.Items.Any())
        {
            return new OrderResult(false, "Cart cannot be empty.");
        }

        // 2. State Change
        var totalAmount = request.Items.Sum(i => i.Price * i.Quantity);
        var order = new Order(Guid.NewGuid(), request.CustomerId, totalAmount, request.ShippingAddress);
        
        await _repository.SaveAsync(order);

        // 3. Announcing the Fact (The Event)
        var orderPlacedEvent = new OrderPlacedEvent(order.Id, request.CustomerId, totalAmount);
        
        // Notice we are Publishing the event, not Sending a command.
        await _mediator.Publish(orderPlacedEvent, cancellationToken);

        return new OrderResult(true, "Order successfully placed.", order.Id);
    }
}

```

### Adım 3: Event'i Tanımlamak

Durum (state) değişti. Sipariş güvenli bir şekilde veritabanına kaydedildi. Artık sistem sadece bu gerçeği uygulamanın geri kalanına duyurur. Geçmiş zamanlı isimlendirmeye dikkat edin.

```csharp
using MediatR;

namespace ECommerce.Domain.Events;

// The Event: A notification that something happened. Does not return a response.
public record OrderPlacedEvent(
    Guid OrderId, 
    Guid CustomerId, 
    decimal TotalAmount
) : INotification;

```

### Adım 4: Event'e Tepki Vermek (Multiple Handlers)

İşte **Event-Driven Architecture**'ın büyüsünün parladığı yer burasıdır. Bir event yayınladığımız için, çekirdek `PlaceOrderCommandHandler` sınıfımızı değiştirmeden, birbirinden bağımsız birden fazla handler'ın bu olaya tepki vermesini sağlayabiliriz.

Diyelim ki pazarlama ekibi bir "Teşekkürler" e-postası göndermek istiyor ve lojistik ekibinin stoğu ayırması gerekiyor. Basitçe iki ayrı event handler oluşturuyoruz.

**Handler A: E-posta Servisi**

```csharp
using MediatR;

namespace ECommerce.Application.Handlers.Events;

public class SendOrderConfirmationEmailHandler : INotificationHandler<OrderPlacedEvent>
{
    private readonly IEmailService _emailService;

    public SendOrderConfirmationEmailHandler(IEmailService emailService)
    {
        _emailService = emailService;
    }

    public async Task Handle(OrderPlacedEvent notification, CancellationToken cancellationToken)
    {
        // React to the fact
        await _emailService.SendEmailAsync(
            notification.CustomerId, 
            $"Thank you for your order! Your total is ${notification.TotalAmount}."
        );
    }
}

```

**Handler B: Envanter Servisi**

```csharp
using MediatR;

namespace ECommerce.Application.Handlers.Events;

public class ReserveInventoryHandler : INotificationHandler<OrderPlacedEvent>
{
    private readonly IInventoryService _inventoryService;

    public ReserveInventoryHandler(IInventoryService inventoryService)
    {
        _inventoryService = inventoryService;
    }

    public async Task Handle(OrderPlacedEvent notification, CancellationToken cancellationToken)
    {
        // React to the same fact independently
        await _inventoryService.ReserveItemsForOrderAsync(notification.OrderId);
    }
}

```

**.NET** kodumuzu bu şekilde yapılandırarak harika bir loosely coupled (gevşek bağlı) sistem elde ettik. Yarın analiz ekibi satışları takip etmek isterse, `PlaceOrderCommandHandler`'a dokunmayız. Sadece `OrderPlacedEvent`'i dinleyen bir `TrackSalesAnalyticsHandler` ekleriz.

## İleri Düzey Mimari Değerlendirmeler

**MediatR** örneği in-memory kavramları mükemmel bir şekilde gösterse de, bu pattern'leri bellekten çıkarıp dağıtık (distributed) bir bulut ortamına taşımak karmaşık zorlukları beraberinde getirir. **Microservices**'leri çalıştırmak için Google Cloud, AWS veya Azure gibi cloud platformları kullanıldığında, mesajlaşma yapısı da dağıtık hale gelir.

İşte **Events vs Commands** yapılarını ölçeklendirirken göz önünde bulundurmanız gereken üç ileri düzey pattern:

### 1. The Outbox Pattern (Garantili Teslimat)

C# örneğimizde siparişi veritabanına kaydettik ve ardından event'i MediatR'a yayınladık. Peki ya veritabanı kaydı başarılı olur ancak uygulama tam olarak `await _mediator.Publish()` satırı çalıştırılmadan bir milisaniye önce çökerse?

Durum değişti, ancak event hiçbir zaman fırlatılmadı. Müşterinin kartından para çekildi, ancak deponun haberi olmadı. Bu, dağıtık sistemlerde "**Dual Write Problem**" (Çift Yazma Problemi) olarak bilinen yıkıcı bir hatadır.

Bunu çözmek için mimarlar **Outbox Pattern** (veya Transactional Outbox Pattern) kullanırlar. Command handler, event'i doğrudan yayınlamak yerine, siparişin kendisiyle *aynı veritabanı transaction'ı* içinde `OrderPlacedEvent`'i bir "Outbox" tablosuna yazar. Ayrı bir arka plan süreci (bir .NET BackgroundService gibi) sürekli olarak bu Outbox tablosunu okur ve mesajları harici broker'ınıza (örn. RabbitMQ veya Google Cloud Pub/Sub) yayınlar. Bu, event'lerinizin en az bir kere teslim edilmesini garanti eder.

### 2. Idempotency (Yinelenen Event'leri İşlemek)

Dağıtık mesajlaşma sistemleri genellikle "en az bir kere" teslimat garantisi sunduğundan, event handler'larınız aynı `OrderPlacedEvent`'i iki kez alabilir.

Eğer `SendOrderConfirmationEmailHandler` dikkatlice tasarlanmazsa, müşteri iki e-posta alabilir. Daha da kötüsü, bir event ödeme alımını tetikliyorsa, müşteriden iki kez ücret alınabilir.

Event handler'lar **idempotent** olmalıdır. Bu, aynı event'i birden fazla kez uygulamanın, bir kez uygulamakla aynı etkiye sahip olması anlamına gelir. .NET'te bu genellikle işlenmiş `EventId`'lerin tutulduğu bir tablo aracılığıyla uygulanır. Bir handler bir event'i işlemeden önce kontrol eder: *"Bu Event ID'yi daha önce gördüm mü?"* Eğer evetse, onu güvenli bir şekilde yoksayar ve başarılı bir yanıt döner.

### 3. Event Sourcing vs Event-Driven Architecture

Bir **Event-Driven Architecture**'ı (EDA), **Event Sourcing** ile karıştırmamak önemlidir.

- **EDA**, servisler arasında iletişim kurmak için events kullanır (yukarıdaki örneğimizde olduğu gibi). Durum (state) hala geleneksel bir veritabanı tablosunda (örneğin, bir `Status` sütunu olan `Orders` tablosunda) saklanır.
- **Event Sourcing** ise events'in veritabanının *ta kendisi* olduğu çok daha karmaşık bir paradigmadır. Bir siparişin mevcut durumunu kaydetmek yerine, sadece ekleme yapılabilen (append-only) bir olaylar günlüğü (log) kaydedersiniz: `OrderCreated`, `AddressUpdated`, `ItemAdded`, `OrderCheckedOut`. Sistemin mevcut durumu bulabilmesi için events başlangıç zamanından itibaren yeniden oynatılır. Denetim izleri için güçlü olsa da, devasa bir karmaşıklık getirir ve finansal defterler gibi katı tarihsel doğruluk gerektiren özel alanlara saklanmalıdır.

## Hangisini Ne Zaman Kullanmalı?

Yazılım tasarımının güzelliği, iş için doğru aracı seçmektir. İşte .NET uygulamalarınızda Commands vs Events tercihini ne zaman yapacağınıza dair kısa bir kopya kağıdı:

- **Şu durumlarda Command kullanın:**
* Sistemin belirli bir eylemi gerçekleştirmesine ihtiyacınız varsa ve bunu hangi bileşenin işlemesi (handle) gerektiğini tam olarak biliyorsanız.
* Kullanıcı girdisini doğrulamanız ve potansiyel olarak isteği reddetmeniz gerekiyorsa.
* Geriye bir sonuç bekliyorsanız (başarı, başarısızlık veya yeni oluşturulan bir entity'nin ID'si).


- **Şu durumlarda Event kullanın:**
* Önemli bir durum değişikliği (state change) gerçekleştiyse ve sistemin diğer parçalarını bilgilendirmek istiyorsanız.
* Farklı, bağımsız modüllerin sıkı bir bağ (tight coupling) yaratmadan tek bir eyleme tepki vermesine izin vermek istiyorsanız.
* Microservice sınırları arasında entegrasyon yapıyorsanız ve servislerin otonom kalmasını sağlamak istiyorsanız.



## Özet

**Software architecture** içinde **events vs commands** arasındaki farkta uzmanlaşmak, bir geliştiricinin **system design** mükemmelliğine giden yolculuğunda önemli bir kilometre taşıdır. Commands uygulamanızın niyetini yönlendirir ve iş kurallarını korur, durum değişikliklerinin sadece geçerli olduğunda gerçekleşmesini sağlar. Events ise sistemin sinir ağı gibi davranır, gerçekleri yayınlar ve yüksek ölçeklenebilir, loosely coupled (gevşek bağlı) bir microservices ekosistemini mümkün kılar.

.NET'teki **MediatR** gibi güçlü kütüphanelerden yararlanarak ve **asynchronous messaging** inceliklerini anlayarak, sadece günümüz iş mantığının karmaşıklığıyla başa çıkabilen değil, aynı zamanda yarının gereksinimlerine uyum sağlayacak kadar esnek ve dayanıklı sistemler inşa edebilirsiniz. Command'lerinizi emir kipiyle isimlendirmeyi, event'lerinizi geçmişin değiştirilemez gerçekleri olarak ele almayı ve decouple mimarinin gücünü kucaklamayı unutmayın.

---

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme konusundaki araştırmalarımı kaçırmamak için beni [@berkslv](https://x.com/berkslv) adresinden takip edebilirsiniz.