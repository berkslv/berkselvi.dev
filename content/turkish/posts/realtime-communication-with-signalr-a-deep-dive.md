+++
title = "SignalR ile Gerçek Zamanlı İletişim: Derinlemesine İnceleme"
date = "2024-11-29T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv"
keywords = ["signalr", "websocket", ".NET", "long polling"]
description = "Gerçek zamanlı iletişimin gücünü SignalR ile keşfedin! Bu blog yazısında, SignalR’ın WebSockets, Server-Sent Events ve Long Polling gibi karmaşık protokolleri soyutlayarak .NET uygulamalarınıza canlı özellikler eklemeyi nasıl kolaylaştırdığını öğrenin. SignalR'ı projenize kurmaktan, belirli kullanıcıları hedefleme ve Redis ile ölçeklendirme gibi ileri düzey özelliklere kadar her şeyi bu rehberde bulabilirsiniz. SignalR dünyasına adım atmaya hazır mısınız?"
showFullContent = false
readingTime = true
cover = "img/realtime-communication-with-signalr-a-deep-dive/cover.webp"
+++

Günümüz dünyasında verilerin hızla hareket ettiği bir ortamda, modern uygulamaların kullanıcılarına sorunsuz deneyimler sunabilmesi için gerçek zamanlı iletişim bir zorunluluk haline gelmiştir. SignalR, .NET uygulamaları için gerçek zamanlı iletişim özelliklerini kolayca hayata geçirmenize yardımcı olan temel bir kütüphanedir. SignalR kullanırken tüm iletişim ve network gereksinimleri kütüphane tarafından soyutlanır; sadece bir RPC çağrısı yapar gibi yöntem çağrısında bulunmanız yeterlidir. SignalR sayesinde canlı panolar, sohbet uygulamaları veya web uygulamalarında sıkça ihtiyaç duyulan basit bildirim özelliklerini kolayca oluşturabilirsiniz. Haydi başlayalım.

## Neden SignalR?

Geleneksel istemci-sunucu iletişim modelleri, yüksek etkileşim ihtiyaçları için daha az verimli ve sınırlı olan istek-cevap modeline dayanır ve veriye ihtiyaç duyulduğunda istemcinin bir istek göndermesini gerektirir. SignalR, istemci ile sunucu arasındaki aynı bağlantıyı sürekli açık tutarak bu zorlukları ortadan kaldırmak için tasarlanmıştır.

### SignalR’ın Temel Avantajları:

- **Gerçek Zamanlı İletişim:** İstemciler, yeni bir istek göndermeye gerek kalmadan anında güncellemeleri alır.
- **Çapraz Platform Desteği:** SignalR, platform ve tarayıcıdan bağımsızdır.
- **Karmaşık Protokollerin Soyutlanması:** SignalR, WebSocket, Server-Sent Events ve Long Polling protokollerini kullanma yeteneğine sahiptir. Bu, istemci ve sunucu arasında daha verimli bir ilişki sağlar ve en uygun protokolün seçilmesine olanak tanır. WebSocket protokolü istemci tarafından desteklenmiyorsa, SignalR kendi iç algoritmasına göre diğer yöntemleri seçerek kullanır.
- **.NET Uygulamaları ile Entegrasyon:** .NET ile başarılı bir şekilde entegre olarak modern .NET uygulamalarında sorunsuz bir kullanım sağlar.

### SignalR ile Başlangıç

.NET projenize SignalR’ı entegre etmek için aşağıdaki adımları takip edebilirsiniz:

### 1. SignalR NuGet Paketi

SignalR, .NET sistem kütüphaneleriyle birlikte gelir, bu nedenle ek bir paket yüklemenize gerek yoktur. Ancak Visual Studio saçmalamaya başlarsa `Microsoft.AspNetCore.SignalR` paketini yüklemeyi deneyebilirsiniz.

### 2. Hub Sınıfı Oluşturma

Hub, bağlantıları yöneten ve istemcilere mesaj gönderen merkezi bir bileşen görevi görür. Bu sınıfı, HTTP isteklerini kabul ettiğiniz Controller'lara benzetebilirsiniz, ancak burada istemciden gelen istekleri kabul edebilir veya istemciye doğrudan istek gönderebilirsiniz. Basit bir örnek:

```csharp

using Microsoft.AspNetCore.SignalR;

public class NotificationsHub : Hub
{
    public async Task SendNotification(string content)
    {
        await Clients.All.SendAsync("ReceiveNotification", content);
    }
}

```

### 3. Program.cs Dosyasında Hub’ı Yapılandırma

SignalR servislerini kaydedin ve hub uç noktasını şu şekilde eşleyin:

```csharp

var builder = WebApplication.CreateBuilder(args);

//...

builder.Services.AddSignalR();

var app = builder.Build();

//...

app.MapHub<NotificationsHub>("hubs/notification");

app.Run();

```

### 4. SignalR İstemcisi

SignalR, Javascript, .NET ve Java gibi çeşitli istemci platformlarını destekler. Eğer bu platformlarda SignalR kütüphanesini uygulamak istemiyorsanız, uç noktanızı test etmek için basitçe Postman kullanabilirsiniz. Ancak JSON sonuna 0x1E karakterini eklemeniz gerekir. SignalR’ın dahili protokol gerekliliği budur. Javascript kütüphanesi kullanıyorsanız bu detayla uğraşmanıza gerek yoktur.

```json

{
  "protocol": "json",
  "version": 1
}

```

SignalR Hub’a mesaj göndermek ve almak için şu şekilde bir JSON kullanabilirsiniz:

```json

{
    "arguments" : ["hello world"],
    "target" : "SendNotification",
    "type" : 1
}

```

Kısa bir Postman ve SignalR demosu:

<img src="/img/realtime-communication-with-signalr-a-deep-dive/postman-signalr-demo.gif" alt="SignalR ve Postman demo" loading="lazy" />
<p class="image-sub-title">SignalR ve Postman demo</p>


## Gelişmiş Özellikler

### 1. Tip Güvenli Hub’lar

Bakımı daha kolay hale getirmek için hub arayüzünü belirterek tip güvenli hub’lar kullanabilirsiniz:

```csharp

public interface INotificationsClient
{
    Task ReceiveNotification(string content);
}

public class NotificationsHub : Hub<INotificationsClient>
{
    public async Task SendNotification(string content)
    {
        await Clients.All.ReceiveNotification(content);
    }
}

```

### 2. Belirli İstemcilere Mesaj Gönderme

SignalR, belirli kullanıcılar veya gruplara mesaj gönderme yeteneğine sahiptir. Kullanıcıyı bir grup adına ekledikten sonra yalnızca ilgili kullanıcıya bildirim gönderebilirsiniz:

```csharp

await Clients.User(userId).ReceiveNotification("Hello, User!");
await Clients.Group(groupName).ReceiveNotification("Hello, Group!");

```

Kullanıcı kimliği (userId) ile hedefleme yapmak için IUserIdProvider uygulamanız gerekir:

```csharp

public class UserIdProvider : IUserIdProvider
{
    public string GetUserId(HubConnectionContext connection)
    {
        return connection.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }
}

```

```csharp

// Program.cs
services.AddSingleton<IUserIdProvider, CustomUserIdProvider>();

```

### 3. Hub Dışından IHubContext Kullanımı

Hub dışında istemcilere mesaj göndermek için aşağıdaki şekilde bir yaklaşım izleyebilirsiniz. IHubContext türünü enjekte edin ve mesajınızı istemcilere gönderin.

Sisteminizde bir olay gerçekleştiğinde bu özelliği kullanarak hub'ı tetikleyebilirsiniz. Örneğin, uzun süren bir toplu işlem tamamlandığında kullanıcılarınıza sonuç hakkında bildirim gönderebilirsiniz.

Kısa bir not: Kodunuzu daha temiz hale getirmek için bu IHubContext arayüzünü, örneğin `INotificationDispatcher` gibi başka bir arayüzle soyutlamanız iyi bir fikir olabilir.

```csharp

public class NotificationDispatcher(IHubContext<NotificationsHub> hubContext) : INotificationDispatcher
{
    public async Task SendNotification(string content)
    {
        await hubContext.Clients.All.SendAsync("ReceiveNotification", content);
    }

    public async Task SendNotificationToUser(string userId, string content)
    {
        await hubContext.Clients.User(userId).SendAsync("ReceiveNotification", content);
    }

    public async Task SendNotificationToGroup(string groupName, string content)
    {
        await hubContext.Clients.Group(groupName).SendAsync("ReceiveNotification", content);
    }
}

```

4. SignalR Güvenliğini Sağlama

SignalR hub’larını [Authorize] özniteliği ile güvence altına alabilirsiniz:

```csharp

[Authorize]
public class NotificationsHub : Hub
{
    // Hub methods
}

```

5. Redis Backplane ile SignalR Ölçekleme

SignalR’ı birden fazla sunucuya ölçeklendirmek, birden çok instance üzerinde çalışan yüksek talep gören uygulamalar için güvenilir gerçek zamanlı iletişim sağlar. Redis backplane, SignalR sunucuları arasındaki mesajları senkronize ederek, farklı sunuculara bağlı istemcilerin sorunsuz bir şekilde mesaj almasını sağlar. İşte Microsoft belgelerinden bir alıntı:

> SignalR Redis backplane, mesajları diğer sunuculara iletmek için pub/sub özelliğini kullanır. Bir istemci bağlantı kurduğunda, bağlantı bilgileri backplane’e iletilir. Bir sunucu tüm istemcilere mesaj göndermek istediğinde, bunu backplane’e iletir. Backplane, tüm bağlı istemcileri ve hangi sunucularda olduklarını bilir. Mesajı ilgili sunucular aracılığıyla tüm istemcilere gönderir.
> 

```bash

dotnet add package Microsoft.AspNetCore.SignalR.StackExchangeRedis

```

```csharp

// Program.cs

builder.Services.AddSignalR()
    .AddStackExchangeRedis("localhost:6379", options =>
    {
        options.Configuration.ChannelPrefix = "SignalR";
    });

```

Eğer bana inanmıyorsanız, SignalR uygulamanızı yerel test ortamında birden fazla instance ile çalıştırmayı Docker Compose kullanarak deneyebilirsiniz:

```yaml

services:
  signalr:
    image: your-app
    ports:
      - "5000:5000"
    depends_on:
      - redis
  redis:
    image: redis:latest
    ports:
      - "6379:6379"

```

```bash

docker-compose up --scale signalr=3

```

## SignalR İletişim Modelleri

SignalR, uyumluluk ve performansı sağlamak için birden fazla taşıma yöntemini soyutlar:

### **WebSocket (**`webSockets`**)**:

WebSockets, SignalR için en verimli ve tercih edilen gerçek zamanlı, çift yönlü iletişim yöntemidir. Tek bir TCP kanalı üzerinden kalıcı, tam çift yönlü bir bağlantı kurarak istemci ve sunucu arasında eşzamanlı mesaj alışverişine olanak tanır. Bu, canlı sohbetler, ortak düzenleme araçları, çevrimiçi oyunlar ve finansal veri akışları gibi düşük gecikme ve yüksek hız gerektiren uygulamalar için idealdir.

WebSockets, ilk HTTP el sıkışmasının ardından kendi hafif protokolüne (`ws://` veya `wss://`) geçerek geleneksel HTTP tabanlı iletişimin getirdiği yükü azaltır. Ancak, WebSockets'in ölçeklendirilmesi, WebSocket uyumlu yük dengeleyiciler ve yapışkan oturumlar gibi özel altyapılar gerektirir. SignalR, bağlantı sürekliliğini, otomatik yeniden bağlantıları ve WebSockets kullanılamadığında alternatif protokollere geçişi yöneterek bu zorlukları basitleştirir.

### **Server-Sent Events (**`serverSentEvents`**):**

SSE (Server-Sent Events), uzun ömürlü bir bağlantı üzerinden sunucudan istemciye gerçek zamanlı güncellemeler sağlayan hafif bir HTTP tabanlı mekanizmadır. Standartlaştırılmış EventSource API'sini kullanır ve verileri `text/event-stream` formatında iletir. Bu, canlı panolar, bildirimler ve haber akışları gibi yalnızca sunucudan istemciye veri aktarımı gerektiren durumlar için basit ve etkilidir.

SSE, standart HTTP üzerinde çalıştığı için mevcut HTTP altyapısı ile kolayca entegre olur ve WebSockets'e kıyasla daha kolay ölçeklenebilir. Ancak, SSE Internet Explorer tarafından desteklenmez ve istemciden sunucuya iletişim gerektiren durumlar için ayrı HTTP istekleri gerektirir. SignalR, WebSockets kullanılamadığında otomatik olarak SSE'yi tercih ederek kesintisiz bir deneyim sunar.

### **Long Polling (**`longPolling`**):**

Long Polling, sürekli olarak HTTP bağlantıları açıp kapatarak gerçek zamanlı iletişimi taklit eder. İstemci, sunucuya bir istek gönderir ve sunucu veri gönderene kadar bağlantıyı açık tutar. Veriler iletildikten sonra istemci hemen yeni bir istek oluşturur. Bu yöntem, güncellemeler arasındaki gecikmeyi en aza indirir ve bir tür push tabanlı bağlantı hissi yaratır.

Long Polling, tüm tarayıcılarla çalışabilir ve uygulanması kolaydır. Ancak, sık HTTP istekleri ve yanıtları nedeniyle daha fazla yük oluşturur. Bu, özellikle yüksek frekanslı güncellemelerde, WebSockets veya SSE'ye kıyasla daha az verimlidir. SignalR, WebSockets veya SSE desteklenmediğinde Long Polling’i bir yedek çözüm olarak kullanır.

### **Forever Frame (**`foreverFrame`**):**

Forever Frame, eski Internet Explorer sürümlerine özgü bir protokoldür ve gerçek zamanlı, tek yönlü iletişim sağlar. İstemci tarayıcısında gizli bir iframe oluşturur ve sunucu bu iframe’e sürekli olarak çalıştırılabilir komut dosyaları gönderir. 

Forever Frame, çift yönlü iletişimi desteklememesi ve yüksek ek yük getirmesi gibi sınırlamalara sahiptir. İstemciden sunucuya iletişim, ayrı standart HTTP istekleri gerektirir ve bu da uygulamayı daha az verimli ve zahmetli hale getirir. SignalR, yalnızca eski Internet Explorer tarayıcılarına özgü ortamlar için bir son çare olarak Forever Frame’i kullanır.

### WebSockets ve Server-Sent Events Karşılaştırması

WebSockets ve Server-Sent Events (SSE), farklı gerçek zamanlı iletişim ihtiyaçlarına hitap eder. **WebSockets**, düşük gecikmeli, çift yönlü iletişim sunarak sohbet, oyun ve ortak çalışma araçları için idealdir. **SSE** ise hafif, tek yönlü güncellemeler sağlayarak canlı panolar ve bildirimler gibi durumlar için mükemmeldir.

WebSockets, etkili iki yönlü mesajlaşma için özel bir protokol (`ws://` veya `wss://`) kullanır ancak ölçeklendirme için WebSocket uyumlu altyapı gerektirir. SSE ise standart HTTP (`text/event-stream`) üzerinde çalışır ve geleneksel HTTP araçları ile daha kolay ölçeklenebilir. Ancak, yalnızca sunucudan istemciye iletişim sağlar ve Internet Explorer desteği bulunmaz.

SignalR, bu farklılıkları soyutlayarak performans için WebSockets'i önceliklendirir ve kesintisiz gerçek zamanlı işlevsellik sağlamak için SSE veya diğer yöntemlere otomatik olarak geçiş yapar.

## Protokolü Belirleme

SignalR, gerçek zamanlı iletişim için kullanılacak taşıma protokolünü açıkça belirtmenize olanak tanır. Varsayılan olarak, SignalR dahili algoritmasıyla mevcut en iyi protokolü otomatik olarak seçer. Ancak, bu davranışı uygulamanızın ihtiyaçlarına göre özelleştirebilirsiniz.

WebSockets’in verimliliğinden yararlanmak ve WebSockets kullanılamadığında Long Polling’e geçiş yapmak için `Program.cs` dosyasına şu kodu ekleyebilirsiniz:

```csharp

app.MapHub<NotificationsHub>("/hubs/notification", opt =>
{
    opt.Transports = HttpTransportType.WebSockets | HttpTransportType.LongPolling;
});

```

Veya istemci tarafında JavaScript ile şu şekilde yapılandırabilirsiniz:

```js

let connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/notification", { 
	    transport: signalR.HttpTransportType.WebSockets 
		    | signalR.HttpTransportType.LongPolling })
    .build();

```

## Özet

SignalR, .NET uygulamalarına gerçek zamanlı özellikler eklemeyi kolay ve verimli hale getirir. Karmaşık ağ protokollerini soyutlayarak, alt yapı detaylarıyla uğraşmadan canlı panolar, sohbet uygulamaları veya bildirimler oluşturmanıza olanak tanır. WebSockets, Server-Sent Events (SSE) ve Long Polling gibi protokolleri destekleyen SignalR, ortamınıza en uygun protokolü otomatik olarak seçerek kesintisiz bir deneyim sunar.

Kaynak koduna erişmek isterseniz projenin tamamını GitHub hesabımda bulabilirsiniz:

[GitHub - berkslv/lecture-signalr-deep-dive](https://github.com/berkslv/lecture-signalr-deep-dive)

---

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme alanındaki araştırmalarımı kaçırmamak için [@berkslv](https://x.com/berkslv) adresinden takipte kalabilirsiniz.