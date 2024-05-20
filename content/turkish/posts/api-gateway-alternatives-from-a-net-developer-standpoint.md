+++
title = ".NET Geliştiricisi Perspektifinden API Gateway Alternatifleri: YARP, Ocelot, Kong, APISIX ve KrakenD"
date = "2024-05-20T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["api gateway","yarp","ocelot","kong","apisix","krakend"]
description = ".NET geliştirici bakışından API Gateway alternatiflerini inceliyoruz. YARP ve Ocelot gibi .NET tabanlı çözümlerden başlayarak, OpenResty tabanlı Kong ve Apache APISIX ile Go tabanlı KrakenD'yi değerlendiriyoruz. Her bir API Gateway'in özelliklerini, performansını ve kullanım senaryolarını detaylı bir şekilde ele alıyoruz."
showFullContent = false
readingTime = true
+++

API Gateway servislerini microservice mimarisinde servislerimizi dış dünyaya açarken bir ara katman olarak kullanabiliyoruz. Bu yazımızda kısaca API Gateway nedirden bahsedip sonrasında kullanabileceğimiz .NET, OpenResty ve Go tabanlı API Gateway alternatiflerinden performans testleri ile beraber bahsedip sonlandıracağız.

[GitHub - berkslv/lecture-api-gateway-comparison](https://github.com/berkslv/lecture-api-gateway-comparison)

## API Gateway nedir?

API Gateway, sistemlerimize aşağıdaki gibi bir giriş noktası sağlarak dış dünyadan izole eder. İçerisinde her bir alt serviste tekrar tekrar implemente edilmesi gereken yetkilendirme, loglama, Rate limiting gibi ortak sorunları tek bir servis ile çözer. 

İstekleri yönlendirirken url ve body bilgilerinde hatta protokollerinde dönüşümler uygulayabilirler, http bir isteği alt servislere daha performanslı olması için gRPC protokolü ile iletebilirler. Gelen istekleri yönlendirecekleri servislerin adresini bulmak için flat file veya veritabanlarından yararlanabilirler. 

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/what-is-api-gateway.png" alt="What is API Gateway" loading="lazy" />

<br/>

## Seçenekler nelerdir

Sistemlerimizde kullanabileceğimiz API Gateway alternatiflerini değerlendirirken, gereken özelleştirme miktarı, performans, dağıtık mimariye uygunluk ve admin paneli üzerinden route bilgilerini güncelleme gibi ihtiyaçları değerlendirip uygun kararı vermemiz gerekir. Tüm bu özellikleri içerisinde barındıran, tüm ihtiyaçlarımızı tek seferde çözen bir gateway ürünü maalesef yok, bu değerlendirmeleri sistemimizin özel ihtiyaçlarına göre yapmamız gerekiyor. 

İlk olarak .NET tabanlı, C# ile özelleştirilebilen YARP ve Ocelot API gateway ürünlerini inceleyip, OpenResty yani ngnix ve lua ikilisini beraber kullanan Kong ve Apache APISIX’den bahsettikten sonra son olarak cloud native ortamdada sıklıkla kullanılan Go ile geliştirilmiş KrakenD’yi inceleyeceğiz. Tüm bu seçenekler open source olarak ücretsiz bir şekilde kullanılabilir, ancak Kong, Apache APISIX ve KrakenD seçeneklerinde gerektiğinde enterprise desteğide alabiliriz. 

Seçeneklerimizi değerlendirmeye geçmeden önce 1 saniye bekleyerek veritabanı sorgularını simule eden çok basit bir .NET API servisi geliştirdim, bu servisi API Gateway’in arkasına aldıktan sonra isteklerimizi yönlendirmeye çalışacak ve basit bir performans aracı olan Apache Benchmark kullanarak performans testlerimizi yapacağız. Kaynak tüketimini daha yakından inceleyebilmek için bu uygulamayı diğer gateway’lerle beraber docker compose ile çalıştırıp service:8080 adresinden isteklerimize cevap alacağız.

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapGet("/weather", () =>
{
    Task.Delay(1000).Wait();

    return "Weather is OK!";
})
.WithName("GetWeather")
.WithOpenApi();

app.Run();
```

## .NET Based

.NET developerları olarak genellikle aklımıza ilk gelen çözüm yine .NET teknolojileri ile geliştirilebilen YARP ve Ocelot API Gateway’den bahsederek seçeneklerimizi incelemeye başlayabiliriz. Bu seçenekler performans olarak çok basit senaryolarda diğer rakipleriyle yarışabilirken, kaynak tüketimi ve admin dashboard gibi kompleks ihtiyaçlara cevap veremiyorlar.

## YARP

Microsoft'un geliştirdiği YARP (Yet Another Reverse Proxy), bir reverse proxy ürünü olarak öne çıkıyor ve API Gateway olarak da kullanılabiliyor. Microsoft'un GitHub'da yayınladığı eShop örnek microservice projelerinde API Gateway olarak kullanıldığı için benim dikkatimi çekmişti. YARP, load balancing desteği sunuyor ve birden fazla servis olduğunda bu servislerin adreslerini service discovery yöntemleriyle alarak istekleri round robin gibi algoritmalarla bu servislere iletebiliyor. .NET tabanlı olması sebebiyle standart .NET API projelerinde kullanılabilen yetkilendirme, rate limiting, distributed tracing, loglama gibi işlemler de kolayca ve aşina olduğumuz yöntemlerle uygulanabiliyor. Ayrıca, middleware eklemesi ile özelleştirmeler yapılabiliyor, HTTP isteklerini gRPC isteklerine dönüştürebiliyor.

YARP projesi oluşturmak için bir .NET web api projesi oluşturulduktan sonra Yarp.ReverseProxy paketini uygulamaya dahil edip, gerekli konfigürasyonları yaptıktan sonra istekleri yönlendirmek için hazırız.

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

app.MapReverseProxy();
app.Run();
```

```json
// appsettings.json
{
  "ReverseProxy": {
    "Routes": {
      "weaher_route": {
        "ClusterId": "weather_api",
        "Match": {
          "Path": "/weather"
        }
      }
    },
    "Clusters": {
      "weather_api": {
        "Destinations": {
          "destination1": {
            "Address": "http://service:8080"
          }
        }
      }
    }
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

## Ocelot

Ocelot, YARP ile birçok ortak özelliğe sahip bir API Gateway çözümüdür. .NET API projelerinde kullanılabilecek tüm özellikleri yine buradada kullanabiliriz, bağımsız bir open source projesi olarak geliştiriliyor. Ocelot, YARP’a kıyasla direk olarak API Gateway ürünü olarak kendisini konumlandırıyor. Farklı olarak, gRPC desteği bulunmamakla birlikte request aggregation gibi özellikler sunuyor. Bu özellik, backend for frontend yapılarında tercih edilebiliyor.

Ocelot uygulaması oluşturmak için benzer şekilde bir .NET API projesi oluşturulur ve Program.cs içerisindeki konfigurasyonlarla birlikte servis konfigürasyonları appsettings.json değil ayrı bir ocelot.json dosyasından okunacak şekilde ayarlanır. Ocelot ile route tanımlarını yaparken servis adreslerini tekrar tekrar vermemiz gerekiyor, YARP ile bunu tek bir yerden verip oluşturduğumuz servisin bilgisini router içerisinde belirtmemiz yeterliydi. Request aggregation işleminide route tanımlamalarından sonra aggregates kısmında yapabiliriz. Daha kompleks ihtiyaçlar için ise IDefinedAggregator interface'inden yararlanılarak özel aggregate'ler tanımlayabiliyoruz.

```csharp
// Program.cs
using Ocelot.DependencyInjection;
using Ocelot.Middleware;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddJsonFile("ocelot.json", optional: false, reloadOnChange: true);

builder.Services.AddOcelot(builder.Configuration);

var app = builder.Build();

await app.UseOcelot();
await app.RunAsync();
```

```json
// ocelot.json
{
    "Routes": [
      {
        "DownstreamPathTemplate": "/weather",
        "DownstreamScheme": "http",
        "DownstreamHostAndPorts": [
          {
            "Host": "service",
            "Port": 8080
          }
        ],
        "UpstreamPathTemplate": "/weather",
        "UpstreamHttpMethod": [ "Get" ]
      }
    ],
    "GlobalConfiguration": {
      "BaseUrl": "https://service:8080"
    }
  }
```

## YARP vs Ocelot

Ocelot ve YARP teknolojilerinin karşılaştırılması için hazırladığım tabloda görebileceğiniz üzere çoğu özellikte ortaklar. Burada iki teknoloji arasında tercih sebebimiz destekledikleri özellikler, community desteği ve konfigurasyon dosyasının yapısı olabilir diye düşünüyorum.

| Özellik                   | YARP                           | Ocelot                                       |
| ------------------------- | ------------------------------ | -------------------------------------------- |
| Routing & Request mapping | Var                            | Var                                          |
| Authn & Authz             | Var                            | Var                                          |
| Rate limiting             | Var                            | Var                                          |
| Load balancing            | Var                            | Var                                          |
| gRPC                      | Var                            | Yok, Eski paketler mevcut                    |
| Request aggregation       | Yok, Özel geliştirme gerekiyor | Var, Basit ise konfigurasyon ile yapılabilir |
| Distributed tracing       |
| Var                       | Var                            |

Mac M1 8GB özelliklere sahip makinede, docker üzerinde çalışan ortamda, sadece tek bir endpointin olduğu çok basit bir senaryoda performans testlerimiz için 10 bin adet isteği, 50 concurrent channel üzerinden Apache Benchmark aracı ile ilettim. Ocelot ortalama 1030 ms, YARP ortalama 1029 ms cevap süresi ile hemen hemen aynı sonucu verdiler. Tüketim için 20MB hafıza tüketimi ile başlarken, istekler gelmeye başlayınca maksimum 100MB tüketime kadar yükseldi, CPU için ise %10 - %20 arasında değişkenli gösteren bir tüketim oldu. Bu oranlar YARP ve Ocelot için hemen hemen aynı. Testleri yaptığım komutlarda şu şekilde:

```bash
# YARP
# 100 MB RAM | %10 - %20 CPU

ab -k -n 10000 -c 50 http://localhost:9090/weather

Server Software:        Kestrel
Server Hostname:        localhost
Server Port:            9090

Document Path:          /weather
Document Length:        14 bytes

Concurrency Level:      50
Time taken for tests:   207.561 seconds
Complete requests:      10000
Failed requests:        0
Keep-Alive requests:    0
Total transferred:      1470000 bytes
HTML transferred:       140000 bytes
Requests per second:    48.18 [#/sec] (mean)
Time per request:       1037.804 [ms] (mean)
Time per request:       20.756 [ms] (mean, across all concurrent requests)
Transfer rate:          6.92 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.1      0       2
Processing:  1002 1029 122.9   1015    2961
Waiting:     1002 1028 122.9   1015    2961
Total:       1002 1029 123.0   1016    2962

Percentage of the requests served within a certain time (ms)
  50%   1016
  66%   1019
  75%   1021
  80%   1023
  90%   1028
  95%   1033
  98%   1052
  99%   1517
 100%   2962 (longest request)
```

```bash
# Ocelot
# 100 MB RAM | %10 - %20 CPU

ab -k -n 10000 -c 50 http://localhost:9090/weather

Server Software:        Kestrel
Server Hostname:        localhost
Server Port:            9090

Document Path:          /weather
Document Length:        14 bytes

Concurrency Level:      50
Time taken for tests:   207.739 seconds
Complete requests:      10000
Failed requests:        0
Keep-Alive requests:    0
Total transferred:      1470000 bytes
HTML transferred:       140000 bytes
Requests per second:    48.14 [#/sec] (mean)
Time per request:       1038.695 [ms] (mean)
Time per request:       20.774 [ms] (mean, across all concurrent requests)
Transfer rate:          6.91 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.1      0       2
Processing:  1001 1030 120.0   1016    3347
Waiting:     1001 1030 119.9   1016    3347
Total:       1001 1030 120.0   1016    3349

Percentage of the requests served within a certain time (ms)
  50%   1016
  66%   1020
  75%   1023
  80%   1025
  90%   1032
  95%   1040
  98%   1061
  99%   1359
 100%   3349 (longest request)
```

## OpenResty tabanlı

Temellerinden yüksek performansı ile adını duyuran ngnix ve onun üzerine LuaJIT ile script dili olarak esnek bir geliştirme ortamı sunan ve JIT desteği yeniden başlatmaya gerek kalmadan hot reload özelliğini destekleyen Lua kullanılabiliyor. Lua dili çoğu senaryoda içerdiği C API’ı sayesinde C kadar yüksek performans sunarken aynı zamanda script dili olduğu için daha yüksek seviyede bir programlama ile, daha geliştirici dostu yapısıyla daha esnek geliştirme yapmaya olanak sağlıyor. C kodundan Lua kodunu veya Lua kodundan C kodunu çağırmakta mümkün, bu sebeplerden ötürü, beraber kullanılabilen güzel bir ikili ortaya çıkmış oluyor. Hatta C ve Lua ikilisi Cloudflare'in kendi araçları içinde kullandığı bir stack, yani networking uygulamarındada sıklıkla kullanılıyor.

Bahsettiğim OpenResty temeline sahip gatewaylerdende sektörde çok sık tercih edilen ve ismini duyuran Kong, sonrasında tamamen open source olduğu için dikkat çeken ve kong'dan birkaç güzel özellikle sıyrılmayı başaran Apache APISIX'den bahsedip Go tabanlı gatewaylerle devam edeceğiz.

## Kong

Kong, API gateway çözümleri arasında öne çıkan bir araçtır. Ocelot ve YARP gibi araçlarda bulunan tüm özellikleri içermesinin yanı sıra, 60'tan fazla plugin desteği ile ek özellikler sunar. Ayrıca, Lua veya diğer programlama dilleri ile kendi pluginlerinizi geliştirebilirsiniz. Enterprise versiyonu, GraphQL desteği, request validation, body güncelleme ve secret manager gibi ekstra özellikler sağlar.

Kong, bir API gateway’den beklenebilecek yetkilendirme, loglama, request transformation ve rate limiting gibi çoğu özelliği içerir. Ancak, request aggregation pattern (tek bir istekle birden fazla servisten dönen cevabı birleştirme) gibi bazı özellikler için ek geliştirme yapılması gerekir. Native olarak kullanılabilen ve diğer alternatiflerden daha iyi çalışacak olan Lua dışında Go, JavaScript veya Python ile IPC (Inter Process Communication) desteği sayesindede geliştirme yapabiliriz ancak daha düşük bir performansla karşılaşacağız. Bununla birlikte, WebAssembly desteği sayesinde Go ve Rust dilleri ile IPC yöntemlerine gerek kalmadan aşina olduğumuz dillerle yüksek performanslı pluginler oluşturabiliyoruz.

Ocelot ve YARP gibi .NET tabanlı gateway'lerden farklı olarak, Kong farklı deployment seçenekleri sunuyor. "DB-less" mod ile, konfigurasyon dosyaları üzerinden yönetim yapılabilir. Bu mod, CI/CD tabanlı deployment senaryolarında oldukça kullanışlıdır ve state farklılıklarından kaynaklanabilecek sorunları önler.

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/kong-config-deployment.png" alt="Kong config deployment" loading="lazy" />

<br/>

Kong, ayrıca traditional olarak adlandırılan yöntemle veritabanı kullanarak da yapılandırılabilir. Bu yöntemde, PostgreSQL, Cassandra, Redis, InfluxDB ve Kafka gibi veritabanları kullanılabilir. Admin API üzerinden route ve service bilgileri üzerinde değişiklikler yapılabilir. Ancak, bu senaryo veritabanına ek bir bağımlılık yaratır ve control plane ile data plane aynı instance üzerinde çalıştığı için saldırılara karşı daha korunaksız olabilir.

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/kong-traditional-deployment.png" alt="Kong traditional deployment" loading="lazy" />

<br/>

Konnect servisi sayesinde uygulayabildiğimiz deployment senaryosu ile data plane ve control plane kısımlarını birbirinden ayırarak daha güvenli bir yapıya sahip oluyoruz. Konnect, Kong tarafından software as a service olarak sunuluyor ve state yönetimi için ekstra bir veritabanı bağımlılığı gerektirmiyor.

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/kong-konnect-deployment.png" alt="Kong konnect deployment" loading="lazy" />

<br/>

Eğer Kong tarafından yönetilen bir ürünü kullanmak istemiyorsak, tüm sürecin kendi iç network ağımız üzerinde yapılmasını istiyorsak Hybrid mod olarak isimlendirilen yöntem ile control plane ve veritabanı, data plane'den ayrı olarak sistemimizin, birbiri ile iletişime geçebilecekleri farklı bir konumuna deploy edilerek, data plane'i kontrol etmek için kullanılabiliyor

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/kong-hybrid-deployment.png" alt="Kong hybrid deployment" loading="lazy" />

<br/>

Local olarak geliştirme yapmak için, Kong'un sunduğu Docker Compose dosyası sayesinde PostgreSQL ile beraber çalışabilirsiniz ve ilk çalıştırmada bu dosyadan okuma yapılır. Eğer Db-less modda çalışacaksak, tüm route'larınızı bir konfigurasyon dosyasında tanımlamanız gerekir. Aşağıdaki gibi konfigurasyon tanımını yaptıktan sonra Docker compose dosyamız ile gateway’imizi ayağa kaldırıyoruz.

```yaml
# kong.yaml
# a very minimal declarative config file
_format_version: "2.1"
_transform: true

services:
  - name: weather-service
    url: http://host.docker.internal:8080
    routes:
      - name: get-weather
        paths:
          - /weather
```

```yaml
# docker-compose.yml
  # ...
  kong:
    image: "${KONG_DOCKER_TAG:-kong:latest}"
    user: "${KONG_USER:-kong}"
    environment:
      <<: *kong-env
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ERROR_LOG: /dev/stderr
      KONG_PROXY_LISTEN: "${KONG_PROXY_LISTEN:-0.0.0.0:8000}"
      KONG_ADMIN_LISTEN: "${KONG_ADMIN_LISTEN:-0.0.0.0:8001}"
      KONG_ADMIN_GUI_LISTEN: "${KONG_ADMIN_GUI_LISTEN:-0.0.0.0:8002}"
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_PROXY_ERROR_LOG: /dev/stderr
      KONG_PREFIX: ${KONG_PREFIX:-/var/run/kong}
      KONG_DECLARATIVE_CONFIG: "/opt/kong/kong.yaml"
    secrets:
      - kong_postgres_password
    networks:
      - kong-net
    ports:
      # The following two environment variables default to an insecure value (0.0.0.0)
      # according to the CIS Security test.
      - "${KONG_INBOUND_PROXY_LISTEN:-0.0.0.0}:8000:8000/tcp"
      - "${KONG_INBOUND_SSL_PROXY_LISTEN:-0.0.0.0}:8443:8443/tcp"
      # Making them mandatory but undefined, like so would be backwards-breaking:
      # - "${KONG_INBOUND_PROXY_LISTEN?Missing inbound proxy host}:8000:8000/tcp"
      # - "${KONG_INBOUND_SSL_PROXY_LISTEN?Missing inbound proxy ssl host}:8443:8443/tcp"
      # Alternative is deactivating check 5.13 in the security bench, if we consider Kong's own config to be enough security here

      - "127.0.0.1:8001:8001/tcp"
      - "127.0.0.1:8444:8444/tcp"
      - "127.0.0.1:8002:8002/tcp"
    healthcheck:
      test: [ "CMD", "kong", "health" ]
      interval: 10s
      timeout: 10s
      retries: 10
    restart: on-failure:5
    read_only: true
    volumes:
      - kong_prefix_vol:${KONG_PREFIX:-/var/run/kong}
      - kong_tmp_vol:/tmp
      - ./config:/opt/kong
    security_opt:
      - no-new-privileges
  # ...

```

```bash

KONG_DATABASE=postgres docker compose --profile database up -d

```

Kong ile başarılı bir deployment yaptıktan sonra, belirttiğiniz route ve service bilgilerine yapılan istekler yönlendirilir. Tradational veya hybrid mod ile deployment yaptıysanız, bir admin arayüzü üzerinden servis ve endpoint bilgilerinizi yönetebilirsiniz.

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/kong-admin-gui.png" alt="Kong admin gui" loading="lazy" />

<br/>

## Apache APISIX

Apache APISIX, Kong gibi OpenResty üzerine geliştirilmiş bir gateway ürünüdür. Ancak, Kong'un sadece enterprise versiyonunda bulunan özellikleri open source olarak sunarak öne çıkıyor. Bu özellikler arasında GraphQL, Canary release ve secret management gibi özellikler yer alıyor.

APISIX, yüksek sayıda route içeren sistemlerde Kong'a kıyasla daha yüksek performans sunuyor. Kong, route'lar arasında traversal search algoritması kullanırken, APISIX radixtree algoritması ile arama yapar ve plugin kullanılmadığında %140 daha yüksek performans sağlar. Ayrıca, APISIX, konfigurasyonlarını depolamak için etcd veritabanını kullanır. Bu veritabanı, cloud native çalışabilen ve kubernetes ortamında yaygın olarak kullanılan bir veritabanıdır.

APISIX, üç farklı deployment senaryosu sunar:

1. **Traditional Yöntem**: Control plane ve data plane aynı instance içerisinde veritabanına bağımlı olarak deploy edilir.
2. **Decoupled Yöntem**: Control plane ve data plane farklı instancelar ile deploy edilir ve sadece control plane veritabanına bağımlıdır.
3. **Standalone Yöntem**: Veritabanı kullanmadan konfigurasyon dosyasından okuma yaparak çalışır.

Local testlerimde, etcd veritabanı ile traditional yöntem kullanarak Docker Compose üzerinden deployment işlemi gerçekleştirdim. APISIX'in docker repositorysinde bulunan Docker Compose dosyasını küçük değişiklikler yaparak kullandım. Admin key'leri kullanarak Admin API'ya istek atabiliyoruz. Eğer standalone yöntemle deploy edecek olsaydım, route'ları yaml dosyasında tanımlamam gerekecekti.

Eğer enterprise destek almak istenirse, APISIX'in geliştirici takımı tarafından yürütülen [API7](http://api7.ai/) üzerinden destek alınabilir.

Docker Compose dosyalarını ve kullandığım kodları blog yazısının sonunda paylaşacağım, böylece siz de kendi localinizde hızlıca deneyimleyebilirsiniz.

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/kong-vs-apisix.png" alt="Kong vs APISIX" loading="lazy" />

<br/>

APISIX'in performans testlerinde, 1025 milisaniye ortalama cevap süresiyle, 1032 milisaniye ortalama cevap süresine sahip olan Kong'dan daha performanslı olduğu görülebiliyor. Tüketim olarak, Kong çalışır çalışmaz 280MB civarında bellek kullanırken, APISIX 100MB civarında bellek kullanmaktadır. Her iki gateway de %5-10 arasında değişen CPU tüketim oranına sahip.

```bash
# Kong
# 280MB RAM | %5 - %10 CPU
ab -k -n 10000 -c 50 http://localhost:8000/weather

Server Software:        Kestrel
Server Hostname:        localhost
Server Port:            8000

Document Path:          /weather
Document Length:        14 bytes

Concurrency Level:      50
Time taken for tests:   207.499 seconds
Complete requests:      10000
Failed requests:        0
Keep-Alive requests:    0
Total transferred:      2730028 bytes
HTML transferred:       140000 bytes
Requests per second:    48.19 [#/sec] (mean)
Time per request:       1037.494 [ms] (mean)
Time per request:       20.750 [ms] (mean, across all concurrent requests)
Transfer rate:          12.85 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.2      0       4
Processing:  1002 1032 120.5   1018    3369
Waiting:     1002 1031 120.5   1018    3369
Total:       1002 1032 120.7   1019    3373

Percentage of the requests served within a certain time (ms)
  50%   1019
  66%   1023
  75%   1026
  80%   1028
  90%   1034
  95%   1043
  98%   1066
  99%   1326
 100%   3373 (longest request)
```

```bash
# APISIX
# 100MB RAM | %5 - %10 CPU
ab -k -n 10000 -c 50 http://localhost:9080/weather

Server Software:        APISIX/3.9.0
Server Hostname:        localhost
Server Port:            9090

Document Path:          /weather
Document Length:        14 bytes

Concurrency Level:      50
Time taken for tests:   206.130 seconds
Complete requests:      10000
Failed requests:        0
Keep-Alive requests:    0
Total transferred:      1520000 bytes
HTML transferred:       140000 bytes
Requests per second:    48.51 [#/sec] (mean)
Time per request:       1030.650 [ms] (mean)
Time per request:       20.613 [ms] (mean, across all concurrent requests)
Transfer rate:          7.20 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.2      0       7
Processing:   921 1025 126.2   1012    3376
Waiting:      921 1024 126.2   1011    3375
Total:        921 1025 126.3   1012    3378

Percentage of the requests served within a certain time (ms)
  50%   1012
  66%   1015
  75%   1017
  80%   1018
  90%   1023
  95%   1029
  98%   1047
  99%   1327
 100%   3378 (longest request)
```

# Go Tabanlı alternatifler

Go tabanlı API Gateway alternatifi olarakta en çok öne çıkan, KrakenD ürününü ele alacağız, ancak Go ile ikinci bir alternatif olarak Tyk veya Traefik API Gateway gibi seçeneklerde tercih edilebilir, ancak bu ikiside ücretli olarak sunulduğu için deneme yapamadığımdan bu anlatımda yer veremiyorum.

## KrakenD

KrakenD, Go ile geliştirilmiş ve hem community hem de enterprise versiyonlarına sahip bir API gateway ürünü.  2021 yılında Linux Foundation'a bağışlanmış olan Lura engine üzerinde çalışır. Diğer API gateway ürünlerine kıyasla güçlü bir aggregation sistemi sunar. Kod yazmadan, sadece konfigurasyon dosyaları ile tüm aggregation işlemlerini gerçekleştirebilirsiniz.

KrakenD, veritabanı kullanmadığı için, deployment seçenekleri arasında karar verirken kafa karışıklığı yaşatmaz, sadece konfigurasyon dosyalarını kullanarak işlemlerimizi gerçekleştirebiliriz. Ancak, veritabanı kullanmadığı için bir admin paneli bulunmamaktadır. Veritabanı olmaması, ek hata kaynaklarını ortadan kaldırır ve daha kolay ölçeklenebilirlik sağlar.

Tüm konfigurasyonlar, git ile takip edilebilecek bir konfigurasyon dosyası üzerinden yönetilir. JSON, YAML, TOML gibi farklı dosya formatlarını destekliyor. KrakenD'nin kendi websitesindeki arayüz ile konfigurasyonları hızlıca oluşturabiliriz. Local geliştirme ortamında, sadece konfigurasyon dosyası üzerinden çalıştığı için hızlıca ayağa kaldırabilir ve servisinize istek atabiliriz. Hot reload özelliği ile kısa bir downtime ile konfigurasyon dosyasını güncelleyebilirsiniz. Ancak, production ortamlarında bu yöntem önerilmez, GitOps yöntemleri ile yeni bir release almanız tavsiye edilir. Enterprise versiyonunda OpenAPI importer ve exporter, gzip sıkıştırma ve response validation gibi ek özellikler bulunur.

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/krakend-designer.png" alt="KrakenD designer" loading="lazy" />

<br/>

KrakenD, Kong ve APISIX'ten çok daha basit bir Docker Compose içeriğine sahiptir, çünkü herhangi bir ek bağımlılığı yoktur. Sadece konfigurasyon dosyasının path'ini volume olarak vermeniz yeterlidir. Örnek olması açısından weather servisini Docker Compose içerisine ekledim ve krakend.json dosyasını hızlıca oluşturarak servisi ayağa kaldırdım. Performans testinde çok iyi sonuçlar verdi.

```json
// krakend.json
{
  "$schema": "https://www.krakend.io/schema/krakend.json",
  "version": 3,
  "name": "KrakenD - API Gateway",
  "timeout": "3000ms",
  "cache_ttl": "300s",
  "output_encoding": "json",
  "port": 9090,
  "endpoints": [
    {
      "endpoint": "/weather",
      "method": "GET",
      "output_encoding": "string",
      "backend": [
        {
          "url_pattern": "/weather",
          "encoding": "string",
          "sd": "static",
          "method": "GET",
          "host": [
            "http://service:8080"
          ],
          "disable_host_sanitize": false
        }
      ]
    }
  ]
}
```

```yaml
# docker-compose.yml
version: '3'
services:
  krakend:
    image: devopsfaith/krakend
    ports:
      - 9090:9090
    volumes:
      - ./krakend.json:/etc/krakend/krakend.json
    networks:
      - krakend-net

  weather-service:
    container_name: service
    build: ../service/Service.API
    networks:
      - krakend-net
    ports:
      - "8080:8080"

networks:
  krakend-net:
    external: false
```

KrakenD, kendi websitesinde de belirttiği gibi, Kong ve APISIX'ten daha hızlı çalışıyor. Benzer test sonuçlarında, Kong ortalama 1032 milisaniye, APISIX ortalama 1025 milisaniye ile cevap verirken, KrakenD ortalama 1024 milisaniye ile en iyi performansı sunuyor. CPU tüketimi %4-6 civarında sabit kalırken en yüksek 30MB memory tüketiyor. Bu sonuçlar, KrakenD'nin diğer rakiplerinden daha az kaynak tükettiğini ve buna rağmen daha hızlı olduğunu gösteriyor.

```bash
# KrakenD
# 30MB RAM | %4 - %6 CPU
ab -k -n 10000 -c 50 http://localhost:9090/weather

Server Software:
Server Hostname:        localhost
Server Port:            9090

Document Path:          /weather
Document Length:        14 bytes

Concurrency Level:      50
Time taken for tests:   206.359 seconds
Complete requests:      10000
Failed requests:        9
   (Connect: 0, Receive: 0, Length: 9, Exceptions: 0)
Non-2xx responses:      9
Keep-Alive requests:    10000
Total transferred:      2439352 bytes
HTML transferred:       139874 bytes
Requests per second:    48.46 [#/sec] (mean)
Time per request:       1031.795 [ms] (mean)
Time per request:       20.636 [ms] (mean, across all concurrent requests)
Transfer rate:          11.54 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.1      0       3
Processing:  1000 1024 122.7   1010    3021
Waiting:     1000 1024 122.7   1010    3021
Total:       1000 1024 122.8   1010    3023

Percentage of the requests served within a certain time (ms)
  50%   1010
  66%   1012
  75%   1013
  80%   1015
  90%   1018
  95%   1023
  98%   1037
  99%   1520
 100%   3023 (longest request)
```

## Sonuç

İncelediğimiz 5 API gateway ürününü karşılaştırmak için aşağıdaki gibi bir tablo hazırladım. Bu tablo, sunumun içeriğin özetini oluşturuyor ve araştırmalarım sonucunda birkaç önemli noktayı vurgulamak istiyorum.

### **Kong ve APISIX**

Eğer farklı projelere sahip takımlar, tek bir API gateway üzerinden internete açılacaksa ve canlı olarak güncellenebilen bir admin arayüzüne ihtiyaç duyuyorsa, Kong veya APISIX tercih edilebilir. Her iki gateway de güçlü özelliklere sahip ve genişletilebilir yapıları ile öne çıkıyorlar. Ayrıca, admin arayüzü sayesinde, konfigurasyonları yönetmek ve güncellemeleri canlı olarak yapmak mümkün.

### **KrakenD**

Eğer API gateway projesi, takımların ortak sorumluluğunda ise ve geliştiriciler konfigurasyon dosyasını güncelleyip pipeline çalıştırabilirlerse, yüksek performans ve düşük kaynak tüketimi hedeflenen durumlarda, KrakenD iyi bir seçim olabilir. KrakenD, Go ile geliştirilmiş olup, güçlü bir aggregation sistemi sunar ve veritabanı kullanmadığı için daha kolay ölçeklenebilir.

### **Ocelot ve YARP**

Performans ve kaynak tüketimi kritik değilse ve aşina olduğumuz bir teknoloji yeterliyse, .NET tabanlı Ocelot veya YARP ile yolumuza devam edebiliriz. Bu araçlar, benzer özellikleri farklı şekillerde destekliyorlar ve .NET ekosistemine entegrasyonları kolaydır.

### **Diğer Kriterler**

- **Deployment Yöntemleri**: Hangi gateway’in nasıl deploy edileceği, konfigurasyon dosyalarının yapısı ve düzenlenebilirliği önemlidir.
- **Community ve Enterprise Desteği**: Gateway'in ne kadar geniş bir kullanıcı kitlesine sahip olduğu ve destek alabileceğimiz kaynakların bulunup bulunmadığı da karar verirken göz önünde bulundurulmalıdır.

Tüm ihtiyaçlarımıza tek başına kusursuz bir çözüm sunacak bir ürün maalesef yok. Bu nedenle, kendi ihtiyaçlarımızı değerlendirerek, seçeceğimiz aracın özelliklerine göre karar vermeliyiz. Doğru API gateway seçimi, projenizin başarısı için kritik bir adımdır ve ihtiyaçlarınıza en uygun olanı tercih etmek her zaman en iyi yaklaşımdır.

| Feature             | YARP                                                             | Ocelot                                                           | Kong                                                                       | APISIX                                                                     | KrakenD                                                       |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Request aggregation | NO                                                               | Simple, can be done with configuration                           | NO                                                                         | YES                                                                        | Powerful,, can be done with configuration                     |
| OAuth & OpenID      | YES                                                              | YES                                                              | YES                                                                        | YES                                                                        | YES                                                           |
| Request validation  | Needs custom logic                                               | Needs custom logic                                               | Comes with enterprise                                                      | YES                                                                        | YES                                                           |
| HTTP to gRPC        | YES                                                              | NO                                                               | YES                                                                        | YES                                                                        | YES                                                           |
| Websocket           | YES                                                              | YES                                                              | ?                                                                          | YES                                                                        | Comes with enterprise                                         |
| State               | File                                                             | File                                                             | File, PostgreSQL, Cassandra, Redis, InfluxDB, Kafka                        | File, etcd                                                                 | File                                                          |
| Plugin              | C#                                                               | C#                                                               | **Native**: Lua & **IPC**: Go, Javascript, Python & **WASM**: Go, Rust vs. | **Native**: Lua & **IPC**: Go, Javascript, Python & **WASM**: Go, Rust vs. | Go & Lua                                                      |
| Performance         | **Mean response**: 1029ms, **Memory**: 100MB, **CPU**: %10 - %20 | **Mean response**: 1030ms, **Memory**: 100MB, **CPU**: %10 - %20 | **Mean response**: 1035ms, **Memory**: 280MB, **CPU**: %5 - %10            | **Mean response**: 1025ms, **Memory**: 100MB **CPU**: %5 - %10             | **Mean response**: 1024ms, **Memory**: 30MB, **CPU**: %4 - %6 |



Kaynak koduna erişmek isterseniz projenin tamamını GitHub hesabımda bulabilirsiniz:

[GitHub - berkslv/lecture-api-gateway-comparison](https://github.com/berkslv/lecture-api-gateway-comparison)

---

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme dünyasındaki en son güncellemeleri ve düşüncelerimi kaçırmayın. Bağlantıdan beni takip ederek [@berkslv](https://x.com/berkslv) ile bağlantıda ve iletişimde kalın.