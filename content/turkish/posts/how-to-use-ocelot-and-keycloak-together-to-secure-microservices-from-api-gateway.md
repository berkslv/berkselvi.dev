+++
title = "Ocelot ve Keycloak'i birlikte kullanarak API Gateway'den Mikroservis güvenliğini nasıl sağlarız?"
date = "2024-01-30T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["keycloak","ocelot","microservices","api gateway","oauth"]
description = "Mikroservis mimarisinin dinamik dünyasında, güçlü bir güvenliğe olan ihtiyaç çok daha önemli hale gelmiştir. Kuruluşlar uygulamalarını daha küçük, bağımsız bir şekilde deploy edilebilir servislere böldükçe…"
showFullContent = false
readingTime = true
+++

Mikroservis mimarisinin dinamik dünyasında, güçlü bir güvenliğe olan ihtiyaç çok daha önemli hale gelmiştir. Kuruluşlar uygulamalarını daha küçük, bağımsız bir şekilde deploy edilebilir servislere böldükçe, bu servisler arasında alınan ve gönderilen verilerin bütünlüğünü ve gizliliğini sağlamak kritik bir önem haline gelir.

Bu blog yazısında, Ocelot'u kullanan ve güçlü bir açık kaynak kimlik ve erişim yönetimi çözümü olan Keycloak ile mikroservisleri güvence altına almak için kapsamlı bir çözümü keşfedeceğiz. Keycloak'u API Gateway'in arkasına yerleştirerek, bu entegrasyonun kaynakları koruduğunu, diğer hizmetlere yönelik istekleri kimlik doğruladığını ve taleplere erişimi yetkilendirdiğini claim yapılarını kullanarak sunar. Bu, mikroservis ekosisteminiz için sorunsuz ve güvenli bir iletişim çerçevesi sunar. Başlayalım.

## Create Keycloak instance

Docker içinde Keycloak'u çalıştırmak çok kolaydır. Bu Docker dosyasını projenizin /Identity dizinine yerleştirin. Tüm kodları yazının sonundaki GitHub reposunda bulabilirsiniz.

```Dockerfile
FROM quay.io/keycloak/keycloak:latest as builder  
  
# Enable health and metrics support  
ENV KC_HEALTH_ENABLED=true  
ENV KC_METRICS_ENABLED=true  
  
# Configure a database vendor  
ENV KC_DB=postgres  
  
WORKDIR /opt/keycloak  
# for demonstration purposes only, please make sure to use proper certificates in production instead  
RUN keytool -genkeypair -storepass password -storetype PKCS12 -keyalg RSA -keysize 2048 -dname "CN=server" -alias server -ext "SAN:c=DNS:localhost,IP:127.0.0.1" -keystore conf/server.keystore  
RUN /opt/keycloak/bin/kc.sh build  
  
FROM quay.io/keycloak/keycloak:latest  
COPY --from=builder /opt/keycloak/ /opt/keycloak/  
  
# change these values to point to a running postgres instance  
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
```

And create docker-compose.yml file that access /Identity/Dockerfile and builds image from it. We can use base image rather than custom Dockerfile but with this approach you can customize much more features of Keycloak like frontend theme and secret keys.

/Identity/Dockerfile dosyasına erişen ve ondan bir image oluşturan docker-compose.yml dosyasını oluşturun. Özel Docker dosyası yerine bir temel image kullanabiliriz, ancak bu yaklaşımla Keycloak'un frontend teması ve secret key bilgileri gibi çok daha fazla özelliğini özelleştirebilirsiniz.

```yaml
version: "3"  
  
services:  
  # PostgreSQL for keycloak  
  secured-identity-db:  
    container_name: secured-identity-db  
    image: postgres:16-alpine  
    ports:  
      - 6063:5432  
    expose:  
      - 6063  
    volumes:  
      - ./data/secured-identity-db:/var/lib/postgresql/data  
    restart: always  
    environment:  
      - POSTGRES_PASSWORD=myStrongPassword123  
      - POSTGRES_USER=keycloak  
      - POSTGRES_DB=keycloak  
    networks:  
      - secured-network  
  
  # Keycloak  
  secured-identity:  
    container_name: secured-identity  
    build: ./Keycloak  
    command: ["start-dev"]  
    ports:  
      - 5053:8080  
    expose:  
      - 5053  
    environment:  
      - KEYCLOAK_ADMIN=admin  
      - KEYCLOAK_ADMIN_PASSWORD=admin  
      - KC_HOSTNAME_URL=http://localhost:5050/identity  
      - KC_DB=postgres  
      - KC_DB_USERNAME=keycloak  
      - KC_DB_PASSWORD=myStrongPassword123  
      - KC_DB_URL=jdbc:postgresql://secured-identity-db:5432/keycloak  
    depends_on:   
      - secured-identity-db  
    networks:  
      - secured-network  
  
networks:  
  secured-network:  
    driver: bridge  
  
volumes:  
  secured-data:  
    driver: local
```

Ve sadece bu docker-compose.yml dosyasından docker'ı çalıştırmamız yeterlidir.

```bash
docker compose build  
docker compose up -d
```

## Put keycloak behind Ocelot API Gateway to protect resources

<img src="/img/how-to-use-ocelot-and-keycloak-together-to-secure-microservices-from-api-gateway/Microservice-architecture-with-Ocelot-and-Keycloak.webp" alt="Microservice architecture with Ocelot and Keycloak" loading="lazy" />
<p class="image-sub-title">Microservice architecture with Ocelot and Keycloak</p>

Kimlik hizmetinizin (keycloak) güvenliğini sağlamak ve diğer hizmetler gibi istek alabilecek uç noktaları sınırlandırarak saldırı vektörünü azaltmak önemlidir. Keycloak admin paneline harici bir ağdan erişilmemelidir, bu özelliğe yalnızca bu ağdaki kişiler erişebilir. Daha fazla bilgi edinmek için [reverse proxy kullanma](https://www.keycloak.org/server/reverseproxy) hakkındaki Keycloak dökümantasyonunu göz atın.

<img src="/img/how-to-use-ocelot-and-keycloak-together-to-secure-microservices-from-api-gateway/Exposed-path-recommendations.webp" alt="Exposed path recommendations" loading="lazy" />
<p class="image-sub-title">Exposed path recommendations</p>

Öncelikle Ocelot projesini oluşturalım. Burada .NET 8 kullanıyorum

```bash
dotnet new sln -n Secured  
dotnet new webapi -o Secured.ApiGateway  
cd Secured.ApiGateway/  
dotnet add package Ocelot --version 22.0.1
```

Projeyi başarıyla oluşturduktan sonra Program.cs dosyasını aşağıdaki gibi değiştirip root dizinde ocelot.json dosyasını oluşturun.

```cs
var builder = WebApplication.CreateBuilder(args);  
  
builder.Configuration.AddJsonFile("ocelot.json", optional: false, reloadOnChange: true);  
  
builder.Services.AddOcelot(builder.Configuration);  
  
var app = builder.Build();  
  
await app.UseOcelot();  
await app.RunAsync();
```

Bundan sonra bu ocelot.json dosyasını localhost:5053 üzerinde çalışan keycloak uygulamamıza erişimi sınırlamak için kullanabiliriz.

```json
{  
  "Routes": [  
    {  
      "DownstreamPathTemplate": "/realms/{everything}",  
      "DownstreamScheme": "http",  
      "DownstreamHostAndPorts": [  
        {  
          "Host": "localhost",  
          "Port": 5053  
        }  
      ],  
      "UpstreamPathTemplate": "/identity/realms/{everything}",  
      "UpstreamHttpMethod": [ "Get", "Post", "Put", "Delete" ]  
    },  
    {  
      "DownstreamPathTemplate": "/resources/{everything}",  
      "DownstreamScheme": "http",  
      "DownstreamHostAndPorts": [  
        {  
          "Host": "localhost",  
          "Port": 5053  
        }  
      ],  
      "UpstreamPathTemplate": "/identity/resources/{everything}",  
      "UpstreamHttpMethod": [ "Get" ]  
    },  
    {  
      "DownstreamPathTemplate": "/js/{everything}",  
      "DownstreamScheme": "http",  
      "DownstreamHostAndPorts": [  
        {  
          "Host": "localhost",  
          "Port": 5053  
        }  
      ],  
      "UpstreamPathTemplate": "/identity/js/{everything}",  
      "UpstreamHttpMethod": [ "Get" ]  
    }  
  ],  
  "GlobalConfiguration": {  
    "BaseUrl": "https://localhost:5050"  
  }  
}
```

Bu yapılandırmalardan sonra, API Gateway'in adresi olan localhost:5050'den keycloak'a erişebilirsiniz. Ancak, bu adres aracılığıyla Keycloak yönetici paneline erişemezsiniz çünkü erişimi sınırladık.

Keycloak yapılandırmalarımızı yapmak için, hala local olarak erişilebilen keycloak adresinde, yani localhost:5053'te yönetici paneline giriş yapabiliriz. Deployment senaryosunda, yalnızca Ocelot'un harici internete erişimi olduğundan emin olacağız.

localhost:5053 adresine admin kullanıcı adı ve admin şifresiyle giriş yapabiliriz. Bu kimlik bilgilerini docker-compose.yml dosyasından değiştirebiliriz.

<img src="/img/how-to-use-ocelot-and-keycloak-together-to-secure-microservices-from-api-gateway/keycloak-1.webp" alt="Keycloak" loading="lazy" />

Giriş yaptıktan sonra, kullanıcıları yönetmek için yeni bir alan (realm) oluşturmak ve uygulamamız için istemci oluşturmak için bu açılır menüden yeni alan (realm) oluştur seçeneğine tıklıyoruz. "Yeni alan (realm) oluştur" düğmesine tıkladıktan sonra, basitçe **secured**'ı alan (realm) adı olarak girin ve diğer her şeyi olduğu gibi bırakın.

<img src="/img/how-to-use-ocelot-and-keycloak-together-to-secure-microservices-from-api-gateway/keycloak-2.webp" alt="Keycloak" loading="lazy" />

Clients sekmesinde client oluştur'a tıklayın. Client ID alanını **postman** olarak adlandırın ve geçerli redirect URL'sini [**https://oauth.pstmn.io/v1/callback**](https://oauth.pstmn.io/v1/callback) olarak adlandırın. diğer şeyleri olduğu gibi bırakın.

<img src="/img/how-to-use-ocelot-and-keycloak-together-to-secure-microservices-from-api-gateway/keycloak-3.webp" alt="Keycloak" loading="lazy" />

Kullanıcılar sekmesinde Keycloak'ta oturum açacak kullanıcıları ekleyin.

<img src="/img/how-to-use-ocelot-and-keycloak-together-to-secure-microservices-from-api-gateway/keycloak-4.webp" alt="Keycloak" loading="lazy" />

Bu adımlardan sonra, yeni oluşturulan kullanıcıyla Keycloak'a giriş yaparak erişim belirteci alabiliriz. API gateway'e erişmek için Postman kullanıyorum. Postman'de Keycloak ile oturum açabilirsiniz. Yetkilendirme bölümünde OAuth 2.0'ı seçin ve aşağıdaki gibi yapılandırın ve Yeni Erişim Belgesi Al'a tıklayın. Postman, tarayıcı penceresini açacak ve sizi Keycloak giriş sayfasına yönlendirecektir, yeni kullanıcınızın kimlik bilgilerini girin. Admin kimlik bilgilerini girmeyin, bu kimlik bilgileri yalnızca ana (master) alan için geçerlidir.

```txt
Grant type: Authorization code  
Auth URL: http://localhost:5050/identity/realms/secured/protocol/openid-connect/auth  
Access Token URL: http://localhost:5050/identity/realms/secured/protocol/openid-connect/token  
Client ID: postman  
Scope: openid profile roles
```

Her şeyi doğru yaptıysanız, Postman ile API Gateway'in arkasındaki Keycloak'a başarıyla kimlik doğrulaması yaptınız 🎉

## Authenticate requests to other services

Ocelot'ta bir isteğin kimliğini doğrulamak istiyorsanız Program.cs ve ocelot.json'da aşağıdaki güncellemeleri yapın. MetadataAddress, JWT doğrulaması için gerekli anahtarları alır. Ancak ekstra network isteklerinden kaçınmak istiyorsanız anahtarları appsettings.json dosyasına yerleştirip kullanabilirsiniz.

Ocelot.json dosyasındaki AuthenticationOptions ile kimlik doğrulama tamamlandı, burada JWT tokenımızı Bearer önekiyle birlikte göndereceğimizi ve JWT token doğrulamasını Program.cs'den yapılandırma ile yapacağımızı söylüyoruz.

```cs
var builder = WebApplication.CreateBuilder(args);  
  
builder.Services  
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)  
    .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, o =>  
    {  
        o.MetadataAddress = "http://localhost:5050/identity/realms/secured/.well-known/openid-configuration";  
        o.RequireHttpsMetadata = false;  
        o.Authority = "http://localhost:5050/realms/secured";  
        o.Audience = "account";  
    });  
  
builder.Configuration.AddJsonFile("ocelot.json", optional: false, reloadOnChange: true);  
  
  
builder.Services.AddOcelot(builder.Configuration);  
  
var app = builder.Build();  
  
app.UseAuthentication();  
app.UseAuthorization();  
  
await app.UseOcelot();  
await app.RunAsync();
```

```json
{  
    "Routes": [  
      {  
        "DownstreamPathTemplate": "/get",  
        "DownstreamScheme": "https",  
        "DownstreamHostAndPorts": [  
          {  
            "Host": "httpbin.org",  
            "Port": 443  
          }  
        ],  
        "UpstreamPathTemplate": "/test",  
        "UpstreamHttpMethod": [ "Get" ],  
        "AuthenticationOptions": {  
          "AuthenticationProviderKey": "Bearer"  
        }  
      },  
  
//...
```

## Authorize requests to other services

Yetkilendirme biraz daha zor ve ek çalışma gerektirir çünkü Keycloak, kullanıcı rollerini JWT yükünde nested yani iç içe geçmiş olarak yerleştirir. Aşağıdaki gibi bir şeydir. Görüldüğü gibi, roller alanı realm_access alanı altına yerleştirilir. Bu, Ocelot'ta karışıklığa neden olur, çünkü Ocelot, talepleri string veya object değerleri olarak okur ve nested alanları değerlendirmez. Bu sorunu önlemek için Keycloak token eşlemesini yapılandırırız ve nested biçimi kullanmayız.

```json
{  
  //...  
  "exp": 1706600524,  
  "realm_access": {  
    "roles": [  
      "offline_access",  
      "default-roles-microcommerce",  
      "uma_authorization",  
      "customer"  
    ]  
  },  
  "resource_access": {  
    "account": {  
      "roles": [  
        "manage-account",  
        "manage-account-links",  
        "view-profile"  
      ]  
    }  
  },  
  "scope": "openid email profile",  
  "preferred_username": "berkslv",  
}
```

Bu özel eşleme için sol menüden Client scopes'a tıklayın ve rolleri seçin.

<img src="/img/how-to-use-ocelot-and-keycloak-together-to-secure-microservices-from-api-gateway/keycloak-5.webp" alt="Keycloak" loading="lazy" />

Rollerin altında, Mappers bölümünü seçin ve ardından realm roles'a tıklayın.

<img src="/img/how-to-use-ocelot-and-keycloak-together-to-secure-microservices-from-api-gateway/keycloak-6.webp" alt="Keycloak" loading="lazy" />

Açılan menüde Token Claim Name seçeneğine realm_access.roles hali hazırda girilidir. Bunu **realm_roles** olarak güncelliyoruz.

<img src="/img/how-to-use-ocelot-and-keycloak-together-to-secure-microservices-from-api-gateway/keycloak-7.webp" alt="Keycloak" loading="lazy" />

Bu konfigürasyonları yaptıktan sonra Postman üzerinden tekrar giriş yaparak tokenımızı güncelliyoruz. Güncellenen token ile yaptığımız isteklerin Ocelot tarafından talep kontrolüne tabi olması için ocelot.json dosyasında aşağıdaki güncellemeyi yapıyoruz. Kullanıcımızda **customer** rolü yoksa 403 yanıtı alıyoruz. Keycloak yönetici panelinde özel rollerinizi oluşturabilir ve atayabilirsiniz.

```json
{  
    "Routes": [  
      {  
        "DownstreamPathTemplate": "/get",  
        "DownstreamScheme": "https",  
        "DownstreamHostAndPorts": [  
          {  
            "Host": "httpbin.org",  
            "Port": 443  
          }  
        ],  
        "UpstreamPathTemplate": "/test",  
        "UpstreamHttpMethod": [ "Get" ],  
        "AuthenticationOptions": {  
          "AuthenticationProviderKey": "Bearer"  
        },  
        "RouteClaimsRequirement": {  
          "realm_roles": "customer"  
        }  
      },  
  
//...
```

Kaynak koduna erişmek isterseniz projenin tamamını GitHub hesabımda bulabilirsiniz:

[GitHub - berkslv/lecture-ocelot-and-keycloak](https://github.com/berkslv/lecture-ocelot-and-keycloak)

---

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme dünyasındaki en son güncellemeleri ve düşüncelerimi kaçırmayın. Bağlantıdan beni takip ederek [@berkslv](https://x.com/berkslv) ile bağlantıda ve iletişimde kalın.