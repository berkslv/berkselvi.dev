+++
title = "Feature Flagging in .NET with OpenFeature and flagd"
date = "2025-07-08T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["feature flag","openfeature","flagd",".NET","C#"]
description = ".NET uygulamalarınızda OpenFeature ve flagd ile güçlü, sağlayıcıdan bağımsız feature flag yönetimini keşfedin. Eski ortam değişkenlerini geride bırakın, güvenli ve dinamik yayınlar yapın, A/B testleri ve anlık müdahale imkanı kazanın."
showFullContent = false
readingTime = true
cover = "img/feature-flagging-in-dotnet-with-openfeature-and-flagd/cover.jpg"
+++

Feature flagging (özellik bayrakları), modern yazılım geliştirme pratiklerinin vazgeçilmezlerinden biri haline geldi. Sık sık release alıyorsanız, belirli kullanıcılarla özellikleri test etmek istiyorsanız, daha güvenli sürümler arıyorsanız, feature flag’ler kesinlikle araç kutunuzda olmalı. Bu yazıda, vendor bağımsız bir feature flag standardı olan OpenFeature’ı anlatacağım ve .NET projelerinde **flagd** ile nasıl entegre edilebileceğini göstereceğim.

## Feature Flagging Nedir?

Feature flag’ler (ya da diğer adıyla feature toggle’lar), yeni bir kod release almadan uygulamanızdaki özellikleri runtime sırasında anlık olarak açıp kapatmanızı sağlar. Hatta bir özelliği kullanıcı, ortam veya istediğiniz herhangi bir kritere göre segmente edebilirsiniz. Bu sayede:

- Kademeli yaygınlaştırma (progressive delivery)
- A/B testleri ve denemeler
- Problemli özellikler için anında kill switch
- Dağıtım sırasında daha düşük risk

Peki ya en önemli faydası nedir? **Kontrol.** Artık yayına aldığınız kod, sadece ekibinize ya da küçük bir beta grubuna görünür olabilir. Bir problem çıktığında ise, panikle rollback yapmak yerine, sadece flag’i kapatırsınız.

## Eski Yöntem: Environment Variables

OpenFeature ve flagd’dan önce biraz gerçek dünyada yaşanan acılardan bahsetmek istiyorum. Pek çok ekip gibi, ben de başlangıçta feature flag yönetimini **environment variable** (veya `appsettings.json`) üzerinden yaptım. Şu yapı eminim size de tanıdık gelecektir:

```json

{
  "EnableNewDashboard": true
}

```

Kodda da şöyle bir kontrol:

```csharp

if (Configuration["EnableNewDashboard"] == "true")
{
    // Yeni dashboard’u göster
}

```

Tabiki ilk başta işe yarıyor… ama bir süre sonra sorunlar başlıyor:

- **Hedefleme yok:** Ya hep ya hiç. Sadece iç kullanıcılar için mi açmak istiyorsunuz? Mümkün değil.
- **Anlık değişiklik yok:** Değişiklik için çoğu zaman yeniden deploy veya restart gerekiyor.
- **Config karmaşası:** Zamanla onlarca flag, diğer konfigürasyonlarla karışıyor.
- **Audit veya geçmiş yok:** Kim ne zaman değiştirdi, iz yok.
- **Standart yok:** Her ekip, her uygulama kendince yapıyor.

Ekipler büyüdükçe bu yaklaşım kırılganlaşıyor. Progressive delivery, canary deployment veya A/B testleri için dinamik kontrol şart. İşte bu noktada feature flag platformları ve OpenFeature gibi standartlar devreye giriyor.

## Neden OpenFeature?

OpenFeature dışındaki çoğu feature flag çözümü (LaunchDarkly, Unleash, vs.) sizi kendi SDK’sına ve API’sine bağımlı kılar. OpenFeature burada devreye giriyor:

- **Vendor bağımsız:** Sağlayıcı değiştirmek için kodunuzu yeniden yazmanız gerekmez.
- **Standart API:** Farklı dil ve platformlarda aynı yaklaşımı kullanabilirsiniz.
- **Genişletilebilir:** Loglama, telemetry gibi hook’lar ekleyebilirsiniz.
- **Cloud-native uyumlu:** Modern mimariler için tasarlanmıştır.

OpenFeature ile uygulamanız sadece OpenFeature SDK’ya bağımlı olur; belli bir sağlayıcıya değil. Zamanla farklı bir sağlayıcıya geçmek isterseniz, provider’ı değiştirmeniz yeterli olacaktır.

## Neden flagd?

[flagd](https://github.com/open-feature/flagd), açık kaynak ve hafif bir feature flag backend’idir. OpenFeature ile doğrudan çalışmak için tasarlanmıştır ve flag’leri JSON dosyalarından, HTTP endpoint veya gRPC üzerinden yönetilebilir. Fakat ne yazık ki şu anda flag’leri yönetmek için official bir kullanıcı arayüzü (UI) bulunmuyor, bunun yerine GitOps pratikleri ile yönetim sağlanıyor. flagd, hiçbir vendor-lockin yaşamadan, self host edebileceğiniz, bulut tabanlı bir feature flag backendi istiyorsanız idealdir.

## Gerçek Hayattan Örnek: ENV’den Feature Flag’e

Gerçek hayattan bir örnekle, bir .NET web API’niz var diyelim. Yeni bir özelliği yayına alıyorsunuz; ama önce sadece iç kullanıcılarınıza açmak istiyorsunuz. Bir environment variable tanımlayıp, bunu `isInternalUser` gibi bir değişkene bağlayarak feature flag pratiklerini kısmen uygulayabilirsiniz. Ancak bu değişkende her değişiklikte kodu tekrar deploy etmeniz gerekiyor ve belirli bir kullanıcı grubu için değil, servisi kullanan tüm kullanıcılar için bu işlemi yapabiliyorsunuz.

Enviroment variable ile yönetilen bir feature flag ortamında Product Manager, bir özelliği kullanıcıların %10’u ile A/B test yapmak istiyorsa özel kod ve yeniden deploy gerekecektir.

**Feature flag’ler** bu tabloyu değiştiriyor:

- Özelliği anında, spesifik kullanıcı/gruplar için açıp kapatın.
- Herkese açmaya hazır olduğunuzda deploy gerekmeden canlıya çıkın.
- Sorun çıkarsa, tek tuşla anında kapatın.

Modern ürün ekipleri bu sayede daha hızlı iterasyon yapabiliyor, riski azaltıyor ve sürekli değer sunabiliyor.

## .NET’te OpenFeature ve flagd Entegrasyonu

Şimdi kurulumun nasıl yapılacağına bakalım.

### 1. NuGet Paketlerini Ekleyin

```bash

dotnet add package OpenFeature
dotnet add package OpenFeature.Contrib.Providers.Flagd

```

### 2. flagd’i docker-compose ile çalıştırın

```yaml

services:
  flagd:
    image: ghcr.io/open-feature/flagd:latest
    volumes:
      - ./flags:/etc/flagd
    command: [
      'start',
      '--uri',
      'file:/etc/flagd/flags.json',
      '--debug'
    ]
    ports:
      - '8013:8013'

```

Örnek `flags.json`:

```json

{
  "$schema": "https://flagd.dev/schema/v0/flags.json",
  "flags": {
    "new-greeting": {
      "state": "ENABLED",
      "variants": {
        "on": true,
        "off": false
      },
      "defaultVariant": "off",
      "targeting": {
        "if": [
          {
            "$ref": "userAgentIsFirefox"
          },
          "on",
          null
        ]
      }
    }
  },
  "$evaluators": {
    "userAgentIsFirefox": {
      "in": [
        "firefox",
        {
          "var": [
            "userAgent"
          ]
        }
      ]
    }
  }
}

```

### 3. .NET Uygulamanızda OpenFeature’ı Konfigüre Edin

```csharp

using OpenFeature.Contrib.Providers.Flagd;
using OpenFeature.Model;

var builder = WebApplication.CreateBuilder(args);

await OpenFeature.Api.Instance.SetProviderAsync(new FlagdProvider(new Uri("http://localhost:8013")));

var app = builder.Build();

app.MapGet("/greet", async context =>
{
    var client = OpenFeature.Api.Instance.GetClient();
    // Get User-Agent header
    var userAgent = context.Request.Headers["User-Agent"].FirstOrDefault() ?? "";
    var evalContext = EvaluationContext.Builder().Set("userAgent", userAgent).Build();
    
    var useNewGreeting = await client.GetBooleanValueAsync("new-greeting", false, evalContext);

    string greeting = useNewGreeting
        ? "Hey there! Welcome to the new greeting experience! 🎉"
        : "Hello, World!";

    await context.Response.WriteAsync(greeting);
});

app.Run();

```

### 4. Test Edin

`flags.json` dosyanızdan flag’i değiştirin. .NET uygulamanız değişikliği anında yakalayacaktır. API ucunu test ettiğimizde aşağıdaki gibi bir sonuçla karşılaşırız.

```bash

$ curl http://localhost:5050/greet
Hello, World!

$ curl http://localhost:5050/greet -H 'User-Agent: firefox'
Hey there! Welcome to the new greeting experience! 🎉

```

Eğer flagd backendine direk olarak istek atıp flagin durumunu görmek istersek ise aşağıdaki şekilde sorgulama yapabiliriz

```bash

$ curl -X POST "http://localhost:8013/flagd.evaluation.v1.Service/ResolveBoolean" -d '{"flagKey":"new-greeting","context":{}}' -H "Content-Type: application/json"
{"value":false, "reason":"DEFAULT", "variant":"off", "metadata":{}}

$ curl -X POST "http://localhost:8013/flagd.evaluation.v1.Service/ResolveBoolean" -d '{"flagKey":"new-greeting","context":{"userAgent": "firefox"}}' -H "Content-Type: application/json"
{"value":true, "reason":"TARGETING_MATCH", "variant":"on", "metadata":{}}

```

## Özet

Feature flag’ler riski azaltır, daha hızlı dağıtım sağlar ve kullanıcı hedeflemesini kolaylaştırır. OpenFeature, .NET’te feature flag yönetimi için size standart ve geleceğe dönük bir API sunar. flagd ise kendi kendinize barındırabileceğiniz, Kubernetes ile uyumlu açık kaynak bir backend’dir.

Hâlâ environment variable ya da config dosyaları ile özellik yönetimi yapıyorsanız, OpenFeature ve flagd’ye bir şans verin. Gelecekte kendinize teşekkür edeceksiniz, özellikle bir cuma akşamı bir özelliği acil kapatmanız gerekirse.

Kaynak koduna erişmek isterseniz projenin tamamını GitHub hesabımda bulabilirsiniz:

[https://github.com/berkslv/lecture-net-pre-commit](https://github.com/berkslv/lecture-net-openfeature)

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme alanındaki araştırmalarımı kaçırmamak için [@berkslv](https://x.com/berkslv) adresinden beni takip edebilirsiniz.