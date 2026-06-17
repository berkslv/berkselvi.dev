+++
title = ".NET'te Anemic'ten Rich Domain Model'e Refactoring"
date = "2026-06-16T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["domain-driven design", "ddd", "csharp", "dotnet", "anemic domain model", "rich domain model", "entity framework core", "software architecture", "unit testing"]
description = ".NET'te Anemic Domain Model anti-pattern'ini nasıl iyileştireceğinizi öğrenin. İş mantığınızı C# entity'lerinizin içine encapsulate etmek, EF Core'u yapılandırmak ve unit testing süreçlerinizi basitleştirmek için pratik adımları keşfedin."
showFullContent = false
readingTime = true
cover = "img/refactoring-from-an-anemic-to-a-rich-domain-model-in-dotnet/cover.webp"
+++

.NET'te kurumsal uygulamalar geliştirmek için önemli bir zaman harcadıysanız, Domain-Driven Design (DDD) kavramıyla karşılaşmış olmanız muhtemeldir. DDD, kodunuzu temsil ettiği gerçek dünya iş domain'iyle hizalayarak yazılım karmaşıklığıyla başa çıkmanın bir yolunu vaat eder. Ancak, geliştiricilerin DDD'yi—veya sadece temel Object-Oriented Programming'i (OOP)—benimserken düştükleri en yaygın tuzaklardan biri **Anemic Domain Model** yaratmaktır.

Birçok .NET mimarisinde tanıdık bir pattern görürsünüz: yalnızca public getter ve setter'lardan oluşan torbalar olan "entity"ler ve bunlara eşlik eden, tüm iş kurallarını (business rules), validation ve state manipulation mantığını içeren devasa "service" sınıfları. Bu yapı, özellikle veritabanı odaklı bir geçmişten gelenler için rahat hissettirse de, object-oriented design ve encapsulation prensiplerine aktif olarak ters düşer.

Bu kapsamlı rehberde, Anemic Domain Model'in tam olarak ne olduğunu, endüstri uzmanlarının bunu neden bir anti-pattern olarak gördüğünü ve C# uygulamalarınızı nasıl **Rich Domain Model**'e refactor edebileceğinizi inceleyeceğiz. Pratik kod örneklerine bakacak, Entity Framework Core (EF Core) ile persistence işlemlerini nasıl halledeceğimizi tartışacak ve mantığı entity'lerinizin içine taşımanın unit testing'i nasıl çocuk oyuncağı haline getirdiğini göreceğiz.

## 1. Anemic Domain Model Tuzağı

### Anemic Domain Model Nedir?

"Anemic Domain Model" terimi ilk olarak 2003 yılında Martin Fowler tarafından meşhur edilmiştir. O, bu durumu nesnelerin gerçek domain entity'leri gibi göründüğü (genellikle iş alanındaki `Customer`, `Order` veya `Invoice` gibi isimlerle adlandırıldığı) ancak neredeyse hiçbir davranışa (behavior) sahip olmadığı bir anti-pattern olarak tanımlamıştır. Bunun yerine, onlar sadece birer veri konteyneridir (data containers)—public property'lerle dolu C# sınıflarıdır.

C#'ta anemic bir entity'nin klasik bir örneğine bakalım:

```csharp
public class Order
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public DateTime OrderDate { get; set; }
    public OrderStatus Status { get; set; }
    public decimal TotalAmount { get; set; }
    public List<OrderItem> Items { get; set; } = new List<OrderItem>();
    public string ShippingAddress { get; set; }
}

public enum OrderStatus
{
    Pending,
    Paid,
    Shipped,
    Cancelled
}


```

İlk bakışta bu tamamen normal görünebilir. Entity Framework eğitimlerinin büyük çoğunluğu sınıfları bu şekilde oluşturmanızı öğretir. Ancak bu sınıf davranıştan (behavior) tamamen yoksundur. Bu "aptal" (dumb) bir nesnedir.

`Order` kendi state'ini koruyamadığı için, uygulamanın herhangi bir kısmı onu doğrudan değiştirebilir:

```csharp
var order = new Order();
// Bekle, müşterisi olmayan, ürün içermeyen ve çoktan kargolandı olarak işaretlenmiş bir sipariş mi?
order.Status = OrderStatus.Shipped; 
order.TotalAmount = -500m; // Negatif tutar mı? Tabii, neden olmasın!


```

### "Service" Katmanı Şişkinliği

Entity hiçbir mantığa sahip olmadığı için, iş kuralları (business rules) başka bir yerde yaşamalıdır. Bu durum genellikle Transaction Scripts olarak adlandırılan "God class"ların veya devasa service katmanlarının oluşmasına yol açar.

İşte anemic bir modelle uğraşırken bir `OrderService`'in nasıl göründüğü:

```csharp
public class OrderService
{
    public void AddItemToOrder(Guid orderId, OrderItem item)
    {
        var order = _repository.Get(orderId);
        
        if (order == null) throw new Exception("Order not found");
        
        if (order.Status == OrderStatus.Shipped || order.Status == OrderStatus.Cancelled)
        {
            throw new InvalidOperationException("Cannot modify a shipped or cancelled order.");
        }

        order.Items.Add(item);
        
        // Recalculate total
        order.TotalAmount = order.Items.Sum(i => i.Price * i.Quantity);
        
        _repository.Save(order);
    }
}


```

Bu kod çalışmasına rağmen, object-oriented programming kılığına girmiş prosedürel programlamayı (procedural programming) temsil eder. Bir `Order`'ı neyin geçerli (valid) kıldığıyla ilgili mantık `Order`'dan çıkarılıp `OrderService` içine atılmıştır.

### Anemi'nin Maliyetleri

Domain modeliniz anemic olduğunda, birkaç önemli mimari maliyetle karşılaşırsınız:

1. **Eksik Encapsulation:** Herhangi bir yerdeki herhangi bir kod bir entity'nin state'ini değiştirebilir. Bir `Order`'ın geçerli (valid) bir state'te olduğunu garanti etmek imkansızdır.
2. **Tekrarlanan Logic:** Farklı bir use case'te bir siparişin toplam tutarını yeniden hesaplamanız gerekirse (örneğin indirim uygularken), muhtemelen bu hesaplama mantığını başka bir service içinde kopyalayacaksınız.
3. **Düşük Cohesion:** Veri (`Order`) ve o veri üzerinde işlem yapan davranış (`OrderService`) birbirinden ayrılmıştır. Bir siparişin yaşam döngüsünü anlamak için birden fazla katman arasında gezinmeniz gerekir.
4. **Kırılganlık (Fragility):** Uygulama büyüdükçe, karmaşık iş mantığı onlarca service'e dağılır ve bu da bug'ların izini sürmeyi veya sistemi refactor etmeyi inanılmaz derecede zorlaştırır.

## 2. Çözüm: Rich Domain Model'e Giriş

Bir **Rich Domain Model** bu paradigmayı tam tersine çevirir. Rich bir modelde entity'ler zeki nesnelerdir. Hem kendi verilerini (state) hem de o verilerin nasıl mutate edilebileceğini yöneten iş kurallarını (behavior) encapsulate ederler.

Rich bir domain model üç temel sütun üzerine inşa edilir:

1. **Her Zaman Geçerli State (Invariants):** Bir entity asla geçersiz bir state'te bulunmamalıdır. Yaratılması ve mutate edilmesi sıkı bir şekilde kontrol edilir.
2. **Encapsulation:** Property'ler dışarıdan keyfi olarak değiştirilemez. State mutation'ları sadece açıkça isimlendirilmiş methodlar aracılığıyla gerçekleşir.
3. **Behavior-Driven (Davranış Odaklı):** Bir nesneden verilerini isteyip onun adına kararlar vermek yerine, nesneye ne yapacağını söylersiniz (*Tell, Don't Ask* prensibi).

Anemic `Order` entity'mizi C#'ta behavior-driven, rich bir domain entity'sine refactor etme sürecine başlayalım.

## 3. C#'ta Adım Adım Rich Domain Model'e Refactoring

### Adım 1: State'i Kilitleyin (Private Setter'lar)

Anemic bir modeli iyileştirmenin ilk adımı kanamayı durdurmaktır. Dışarıdaki kodun property'leri keyfi olarak değiştirmesini engellemeliyiz. Bunu tüm property setter'larını `private` veya `protected` yaparak başarıyoruz.

```csharp
public class Order
{
    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }
    public DateTime OrderDate { get; private set; }
    public OrderStatus Status { get; private set; }
    public decimal TotalAmount { get; private set; }
    public string ShippingAddress { get; private set; }
    
    // We don't want external code adding to the list directly
    private readonly List<OrderItem> _items = new List<OrderItem>();
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();
}


```

Burada ne olduğuna dikkat edin:

* `set` accessor'ları artık `private`. Siparişin state'ini okuyabilirsiniz, ancak doğrudan değiştiremezsiniz.
* `Items` koleksiyonu artık `IReadOnlyCollection<OrderItem>` olarak dışarı sunuluyor. Gerçek liste, `private readonly` bir backing field'ın arkasına gizlenmiştir. Bu, birisinin dışarıdan `order.Items.Add(...)` çağırmasını engeller.

### Adım 2: Anlamlı Constructor'lar

Setter'lar private ise, bir nesneyi nasıl oluştururuz? Başından itibaren geçerli (valid) bir entity oluşturmak için gerekli tüm bilgileri talep eden parametreli bir constructor kullanırız.

```csharp
public class Order
{
    // ... properties ...

    public Order(Guid id, Guid customerId, string shippingAddress)
    {
        if (id == Guid.Empty) throw new ArgumentException("Order ID cannot be empty.");
        if (customerId == Guid.Empty) throw new ArgumentException("Customer ID cannot be empty.");
        if (string.IsNullOrWhiteSpace(shippingAddress)) throw new ArgumentException("Shipping address is required.");

        Id = id;
        CustomerId = customerId;
        ShippingAddress = shippingAddress;
        
        // Initial defaults
        OrderDate = DateTime.UtcNow;
        Status = OrderStatus.Pending;
        TotalAmount = 0m;
    }
}


```

Artık bir Customer ID veya Shipping Address olmadan bir `Order` oluşturmak tam anlamıyla imkansızdır. Derleyici (compiler) sizin iş kurallarınızı zorunlu kılar.

### Adım 3: Domain Method'ları Ekleyin (Behavior)

State korunduğuna göre, state mutation'larına izin vermek için açık ve amacını belli eden methodlar eklememiz gerekiyor. Mantığı `OrderService`'ten çıkarıp `Order` entity'sinin içine taşıdığımız yer burasıdır.

Bir öğe ekleme ve siparişi kargolandı olarak işaretleme mantığını implement edelim.

```csharp
public class Order
{
    // ... constructor and properties ...

    public void AddItem(Product product, int quantity)
    {
        if (Status != OrderStatus.Pending)
        {
            throw new InvalidOperationException("Can only add items to a pending order.");
        }

        if (quantity <= 0)
        {
            throw new ArgumentException("Quantity must be greater than zero.");
        }

        var existingItem = _items.SingleOrDefault(i => i.ProductId == product.Id);
        if (existingItem != null)
        {
            existingItem.IncreaseQuantity(quantity);
        }
        else
        {
            _items.Add(new OrderItem(product.Id, product.Price, quantity));
        }

        RecalculateTotal();
    }

    public void Ship()
    {
        if (Status != OrderStatus.Paid)
        {
            throw new InvalidOperationException("Cannot ship an order that has not been paid.");
        }

        if (!_items.Any())
        {
            throw new InvalidOperationException("Cannot ship an empty order.");
        }

        Status = OrderStatus.Shipped;
    }

    private void RecalculateTotal()
    {
        TotalAmount = _items.Sum(item => item.Price * item.Quantity);
    }
}


```

### Sonuçta Ortaya Çıkan Application Layer

Bu refactoring'den sonra `OrderService`'imizin (Clean Architecture'da genellikle Command Handler veya Application Service olarak adlandırılır) nasıl göründüğüne bakalım:

```csharp
public class OrderService
{
    public void AddItemToOrder(Guid orderId, Product product, int quantity)
    {
        var order = _repository.Get(orderId);
        if (order == null) throw new Exception("Order not found");

        // The logic is no longer here! We simply delegate to the domain.
        order.AddItem(product, quantity);
        
        _repository.Save(order);
    }
}


```

Application Service artık incedir ve tamamen bir orkestratör (orchestrator) görevi görür. Veritabanından entity'yi çeker, entity üzerindeki davranışı (behavior) çağırır ve yeni state'i tekrar veritabanına kaydeder. Tüm o ağır işler, business rule'lar ve invariant'lar `Order` sınıfının içine düzgün bir şekilde encapsulate edilmiştir. Bu, Domain-Driven Design prensipleriyle mükemmel bir şekilde uyum sağlar.

## 4. Entity Framework Core: Rich Model'leri Veritabanına Map Etmek

Geliştiricilerin Anemic Domain Model'lere bağlı kalmalarının tarihi ve büyük bir nedeni, Object-Relational Mapper'ların (ORM) bunları zorunlu kılmasıydı. Entity Framework'ün erken sürümleri, tabloları nesnelere map etmek için public setter'lar, parametresiz public constructor'lar ve public collection'lar talep ediyordu.

Neyse ki, modern **Entity Framework Core (EF Core)** inanılmaz derecede güçlüdür ve Domain-Driven Design pattern'lerini aktif olarak destekler. Persistence endişelerini domain'inize sızdırmadan tamamen encapsulate edilmiş bir Rich Domain Model'i koruyabilirsiniz.

İşte Rich Domain Model'leri veritabanına kaydetmek (persist) için ihtiyacınız olan temel EF Core özellikleri:

### 1. EF Core için Parametresiz Constructor'lar

EF Core veritabanından veri okuduğunda, property'lerini ayarlamadan önce nesnelerinizi instance haline getirmek için bir yola ihtiyaç duyar. Public bir parametresiz constructor istemezsiniz çünkü bu encapsulation'ı bozar. Bunun yerine, özellikle EF Core için **private** bir parametresiz constructor sağlayabilirsiniz.

```csharp
public class Order
{
    // Public constructor for your application code
    public Order(Guid id, Guid customerId, string shippingAddress) { ... }

    // Private constructor for EF Core
    private Order() { } 
}


```

EF Core nesneyi oluşturmak için reflection kullanır, bu yüzden private bir constructor mükemmel çalışırken API'nizi diğer geliştiricilerden de korur.

### 2. Private Backing Field'ları Map Etmek

EF Core, private backing field'ları otomatik olarak bulacak ve onlara bağlanacak (bind) kadar akıllıdır. Eğer bir `IReadOnlyCollection<OrderItem> Items` property'niz ve bir `_items` backing field'ınız varsa, veritabanından veri materialize ederken EF Core ilişkileri doğrudan `_items` alanına map edecektir.

Eğer isimlendirme kuralınız farklıysa, bunu `OnModelCreating` methodunda veya `IEntityTypeConfiguration` sınıfınızda açıkça yapılandırabilirsiniz:

```csharp
public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.HasKey(o => o.Id);

        // Tell EF Core to use the private backing field for the collection
        builder.Metadata.FindNavigation(nameof(Order.Items))
               .SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}


```

### 3. Owned Entity'ler Aracılığıyla Value Object'ler

Bir Rich Domain Model'de genellikle birbiriyle ilişkili property'leri **Value Object**'ler halinde gruplamak istersiniz. Örneğin, `Currency` ve `Amount` değerlerini bir entity üzerinde ayrı ayrı tutmak yerine, bir `Money` value object'i oluşturabilirsiniz.

EF Core bunu **Owned Types** (`OwnsOne`) aracılığıyla destekler:

```csharp
// The Value Object
public class Money
{
    public string Currency { get; private set; }
    public decimal Amount { get; private set; }

    public Money(string currency, decimal amount)
    {
        Currency = currency;
        Amount = amount;
    }
    
    private Money() { } // For EF Core
}

// Inside your Entity Configuration:
builder.OwnsOne(o => o.Price, priceBuilder => 
{
    priceBuilder.Property(p => p.Currency).HasColumnName("PriceCurrency");
    priceBuilder.Property(p => p.Amount).HasColumnName("PriceAmount");
});


```

Bu, son derece anlamlı, object-oriented bir domain modeli korumanıza olanak tanırken, verileri tek bir SQL tablosuna düzgün bir şekilde düzleştirmenizi (flatten) sağlar.

## 5. Rich Domain Model'leri Unit Test Etmenin Büyüsü

Mantığı entity'lerinizin içine taşımanın en derin faydalarından biri de unit testing süreçlerinizin ne kadar kolaylaştığıdır.

Mantığınız devasa bir `OrderService` içinde yaşadığında, unit test yazmak acı vericidir. `IOrderRepository`'yi mock'lamanız, `IProductRepository`'yi mock'lamanız, loglama servisini mock'lamanız, veritabanı state'ini hazırlamanız (arrange) ve son olarak mantığı test etmeniz gerekir. Test kurulumu genellikle testin kendisinden daha büyüktür.

Ancak bir Rich Domain Model kullandığınızda, business logic tamamen entity'nin state'ine dayanır. `Order` sınıfınızın içinde harici bağımlılıklar, veritabanları veya API'ler yoktur. Bu saf (pure) bir C# kodudur.

Domain mantığını test etmek inanılmaz derecede basit ve ışık hızında hale gelir:

```csharp
public class OrderTests
{
    [Fact]
    public void AddItem_Should_ThrowException_When_OrderIsNotPending()
    {
        // Arrange
        var order = new Order(Guid.NewGuid(), Guid.NewGuid(), "123 Main St");
        
        // Use reflection or a test-specific setup to transition state to Shipped 
        // (Assuming we have a Pay() then Ship() method)
        order.Pay(); 
        order.Ship(); 

        var product = new Product(Guid.NewGuid(), "Laptop", 1000m);

        // Act & Assert
        var exception = Assert.Throws<InvalidOperationException>(() => 
            order.AddItem(product, 1));
            
        Assert.Equal("Can only add items to a pending order.", exception.Message);
    }

    [Fact]
    public void AddItem_Should_IncreaseTotalAmount()
    {
        // Arrange
        var order = new Order(Guid.NewGuid(), Guid.NewGuid(), "123 Main St");
        var product = new Product(Guid.NewGuid(), "Laptop", 1000m);

        // Act
        order.AddItem(product, 2);

        // Assert
        Assert.Equal(2000m, order.TotalAmount);
        Assert.Single(order.Items);
    }
}


```

Bu testte **sıfır mock** olduğuna dikkat ettiniz mi? Rich Domain Model, iş mantığını altyapı (infrastructure) endişelerinden izole ettiği için domain katmanınız yüksek test edilebilirliğe (testability) ulaşır. Sadece in-memory C# sınıflarını çalıştırdığınız için binlerce karmaşık business varyasyonunu milisaniyeler içinde kapsayabilirsiniz.

## Özet

Anemic Domain Model'den Rich Domain Model'e refactoring yapmak zihniyette bir değişim gerektirir. Entity'lerinizi sadece veritabanı tablolarının (veri yapıları / data structures) birer yansıması olarak görmekten uzaklaşmalı ve onları açık davranışları (behavior) olan yaşayan business konseptleri olarak görmeye başlamalısınız.

Private setter'lar, anlamlı constructor'lar, açık domain method'ları gibi prensipleri uygulayarak ve *Tell, Don't Ask* kuralına bağlı kalarak, iş mantığınızı (business logic) tam olarak ait olduğu yerde, yani entity'nin içinde merkezileştirebilirsiniz.

Bu geçiş bir öğrenme eğrisi gerektirse de, EF Core'un private backing field'lar ve owned entity'ler gibi gelişmiş mapping yeteneklerinin entegrasyonu, artık veritabanınız uğruna object-oriented design'dan ödün vermek zorunda olmadığınız anlamına gelir. Uzun vadeli ödüller inkar edilemez: bug'lara ve technical debt'e aktif olarak direnen, yüksek düzeyde cohesive, derinlemesine encapsulate edilmiş ve kolayca test edilebilir bir kod tabanı.

---

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme alanındaki araştırmalarımı kaçırmamak için beni [@berkslv](https://x.com/berkslv) adresinden takip edebilirsiniz.

