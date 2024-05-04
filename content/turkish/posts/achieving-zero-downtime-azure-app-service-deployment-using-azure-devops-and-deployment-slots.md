+++
title = "Zero downtime ile Deployment: Azure DevOps Deployment Slots Kullanarak Azure App Service Deployment işlemi"
date = "2023-05-21T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["ci/cd","azure devops","azure app service",".NET","azure"]
description = "Azure App Service'te tek örnek olarak çalışan uygulamamızı Azure DevOps pipeline ile deploy ederken büyük olasılıkla birkaç saniyelik kesinti yaşanacaktır. Çünkü uygulama…"
showFullContent = false
readingTime = true
+++

Selamlar! Azure App Service'te tek instance olarak çalışan uygulamamızı Azure DevOps işlem hatlarını kullanarak dağıtırken büyük olasılıkla birkaç saniyelik kesinti yaşanacaktır. Çünkü tek instance olarak çalışan uygulamanın yeni sürüme güncellenmesi için yeniden başlatılması gerekecektir. En kötü senaryoda, uygulama sürümlerimizin geçişinde bir hata oluşması durumunda geri alma nedeniyle kesinti süresi uzayacaktır.

Bu özel sorunu app servisi için deployment slot özelliğini kullanarak çözebiliriz. Bu özellikle, genellikle ayrı örnekler olarak aynı app servis planında çalışan iki farklı örnek, genellikle staging ve production uygulamaları, birbirinden ayrı örnekler olarak çalışır ve production ortamına geçiş yapıldığında app servisi tarafından değiştirme işlemi yönetilir ve kesinti yaşanmaz.

Bu yazıda, çok basit bir Dotnet Web API projesi oluşturacak, Azure DevOps Repository kullanarak barındıracak, Azure DevOps pipeline ile CI/CD pipeline oluşturarak Azure App Service'e dağıtacak ve deployment slot özelliği ile kesintisiz deployment yapacağız. Aşağıdaki adımları takip ederek süreci 5 adımda tamamlayacağız. Başlayalım.

1.  Uygulamanın Oluşturulması
2.  Azure DevOps Repo
3.  Azure DevOps build pipeline
4.  Azure App service
5.  Zero downtime testing

## Uygulamanın Oluşturulması

Deploy etmek için basit bir Dotnet Web API projesi oluşturuyoruz. Bunun için aşağıdaki komutları kullanıyoruz.

```bash
mkdir backend  
cd ./backend  
dotnet new sln -n Slot  
dotnet new webapi -n Slot.API  
dotnet sln add ./Slot.API/
```
properties/launchSetting.json dosyasındaki _profiles.http_ özelliğini aşağıdaki gibi güncelliyoruz. Burada yalnızca _applicationUrl_ ve _launchBrowser_ özelliklerini güncelledik.

```json
// ...  
  "profiles": {  
    "http": {  
      "commandName": "Project",  
      "dotnetRunMessages": true,  
      "launchBrowser": false,  
      "launchUrl": "swagger",  
      "applicationUrl": "http://localhost:5050",  
      "environmentVariables": {  
        "ASPNETCORE_ENVIRONMENT": "Development"  
      }  
    },  
// ...
```

Aşağıdaki güncellemeyi Program.cs dosyasında yaparak, uygulamanın erişilebilir ve /health uç noktasına yapılan isteklere yanıt verebileceğini test edeceğiz. Uygulamanızda bir veritabanı kullanıyorsanız, [AddDbContextCheck](https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.dependencyinjection.entityframeworkcorehealthchecksbuilderextensions.adddbcontextcheck?view=dotnet-plat-ext-8.0) yöntemi ile veritabanına erişimde bir sorun olup olmadığını da test edebilirsiniz.

```cs
var builder = WebApplication.CreateBuilder(args);  
  
// ...  
  
builder.Services.AddHealthChecks();  
  
var app = builder.Build();  
  
// ...  
  
// app.UseHttpsRedirection();  
  
app.MapControllers();  
  
app.UseHealthChecks("/health");  
  
app.Run();
```

Uygulamamız için bu kadar! Şimdi şu komutları çalıştırarak localhost:5050/health adresine erişebiliriz.

```bash
cd ./Slot.API  
dotnet run  
curl -4 http://localhost:5050/health  
# Healthy
```

Daha sonra uygulamamızı dağıtmak için Docker kullanacağız, bu yüzden Dockerfile dosyamızı sln dosyamızla aynı dizine koyuyoruz.

```Dockerfile
# Build Stage  
FROM mcr.microsoft.com/dotnet/aspnet:7.0-alpine AS base  
WORKDIR /app  
EXPOSE 8080  
  
  
# Publish Stage  
FROM mcr.microsoft.com/dotnet/sdk:7.0-alpine AS build  
COPY ["Slot.API/Slot.API.csproj", "Slot.API/"]  
RUN dotnet restore "Slot.API/Slot.API.csproj"  
COPY . .  
WORKDIR "/Slot.API"  
RUN dotnet build "Slot.API.csproj" -c Release -o /app/build  
  
FROM build AS publish  
RUN dotnet publish "Slot.API.csproj" -c Release -o /app/publish /p:UseAppHost=false  
  
FROM base AS final  
WORKDIR /app  
COPY --from=publish /app/publish .  
ENV ASPNETCORE_URLS=http://*:8080  
ENV ASPNETCORE_ENVIRONMENT=Production  
ENTRYPOINT ["dotnet", "Slot.API.dll"]
```

Aşağıdaki iki komutu kullanarak imajı başarıyla oluşturup container'ı build edip çalıştırabiliriz.


```bash
docker build -t deployment-slots-demo .  
docker run -it -p 80:8080 deployment-slots-demo -n deployment-slots-demo-container
```

## Uygulamanın Çalışıyor Olduğunu Doğrulayın


Önceki adımda sağlık kontrolü özelliği ile uygulamamızı oluşturduktan sonra, bu adrese her saniye bir istek yaparak uygulamanın erişilebilir olduğunu doğrulayabiliriz. Bu şekilde, Azure'a dağıtıldığında erişilebilir olduğunu doğrulamış olacağız.

Bu bölümde, uygulamanın her 50 milisaniyede bir istek yaparak erişilebilir olup olmadığını doğrulamak için basit bir Node.js script'i yazacağız. Bunun için aşağıdaki komutları kullanıyoruz.

```bash
mkdir health-check  
npm init -y  
touch index.js  
npm install node-fetch
```

Aşağıdaki kısmı package.json dosyasına ekliyoruz.

```json
// ...  
"scripts": {  
  "start": "node index.js"  
},  
"type": "module",  
// ...
```

index.js dosyamızı aşağıdaki gibi oluşturabiliriz. Bu kod ile belirtilen url'e her 50 milisaniyede bir istek yapacak ve yanıtı konsola yazacaktır.

```js
import fetch from "node-fetch";  
  
const check = async (url) => {  
  try {  
    const response = await fetch(url, {  
      method: "GET",  
    });  
    const result = await response.text();  
  
    if (result !== "Healthy") {  
      console.log(`${new Date().toISOString()}, ${url} result is not OK`);  
    }  
  } catch (error) {  
    console.log(`${new Date().toISOString()}, ${url} error is ${error.message}`);  
  }  
};  
  
(() => {  
  setInterval(() => {  
    check("http://localhost:5050/health");  
  }, 50);  
  setInterval(() => {  
    check("http://localhost:5050/health");  
  }, 50);  
})();
```

API projemizde UseHttpsRedirection middleware'ini kapatmazsanız, geçersiz bir SSL sertifikası hatası alabilirsiniz. Bunu aşağıdaki gibi düzeltebilirsiniz.

```js
import fetch from "node-fetch";  
import https from "https";  
  
const httpsAgent = new https.Agent({  
  rejectUnauthorized: false,  
});  
  
const check = async (url) => {  
  try {  
    const response = await fetch(url, {  
      method: "GET",  
      agent: httpsAgent,  
    });  
    const result = await response.text();  
  
    if (result !== "Healthy") {  
      console.log(`${new Date().toISOString()}, ${url} result is not OK`);  
    }  
  } catch (error) {  
    console.log(`${new Date().toISOString()}, ${url} error is ${error.message}`);  
  }  
};  
  
(() => {  
  setInterval(() => {  
    check("https://localhost:5051/health");  
  }, 50);  
  setInterval(() => {  
    check("https://localhost:5051/health");  
  }, 50);  
})();
```

## Azure DevOps Repo

Azure DevOps hesabımıza giriş yapıyoruz ve aşağıdaki gibi yeni bir repo oluşturuyoruz.

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-1.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-2.webp" alt="Azure deployment" loading="lazy" />

Bu repo'yu bilgisayarımıza klonluyoruz, yazdığımız kodu bu repo klasörüne taşıyoruz ve kodları origin'e iletiyoruz.

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-3.webp" alt="Azure deployment" loading="lazy" />

```bash
git add .  
git commit -m "inital commit"  
git push origin
```

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-4.webp" alt="Azure deployment" loading="lazy" />

## Azure DevOps build pipeline

Pipeline ekranında, en sağ üstteki New pipeline düğmesine tıklıyoruz. Ardından aşağıdaki adımları izleyerek docker dosyasını oluşturup ve Azure Container Registry'e iteleriyoruz.


<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-5.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-6.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-7.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-8.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-9.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-10.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-11.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-12.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-13.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-14.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-15.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-16.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-17.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-18.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-19.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-20.webp" alt="Azure deployment" loading="lazy" />

Şimdi Azure Container Registry'de image deployment işlemimizin başarılı olduğunu kontrol ediyoruz.

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-21.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-22.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-23.webp" alt="Azure deployment" loading="lazy" />

Görüldüğü gibi, boru hattı çalıştırıldığında, Docker image'i başarıyla Azure Container Registry'de oluşturulmuş ve kullanılmak üzere bizi bekliyor. Bu ayarların ardından, main branch'de /backend dizininde yapılan her değişiklik ile tetiklenerek yeni bir Docker image'i oluşturulacak.

## Azure App service

Azure App servisi, güvenlik, yük dengeleme, otomatik ölçeklendirme gibi özellikleriyle Azure tarafından yönetilen web uygulamalarını dağıtmamıza olanak tanır. Azure app servisleri ekranı üzerinden yeni bir app servisi oluşturabiliriz.

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-24.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-25.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-26.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-27.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-28.webp" alt="Azure deployment" loading="lazy" />

App servisini oluşturduktan sonra, Container Registry şifresini yapılandırma sekmesinden güncellemeniz gerekebilir.

## Azure DevOps release pipeline

release pipeline ile, build pipeline tarafından oluşturulan Docker image'i kullanarak App servisine deploy edilir ve uygulamamızı yayınlamış oluruz.

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-29.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-30.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-31.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-32.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-33.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-34.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-35.webp" alt="Azure deployment" loading="lazy" />

Staging dağıtımına girdiğimizde, staging versiyonumuz için dağıtım alırız ve Docker image'inde yaptığımız değişikliklerin canlı hale gelmesini sağlamak için uygulama servisimizi yeniden başlatırız.

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-36.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-37.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-38.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-39.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-40.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-41.webp" alt="Azure deployment" loading="lazy" />

production aşamasında, app service'de bir deployment yapmıyoruz, bunun yerine staging aşamasıyla değişim işlemini gerçekleştiriyoruz ve bu şekilde, production erişiminde herhangi bir kesinti yaşamadan staging'de çalışan uygulamamızı production ile değiştirdiğimiz için production uygulamamıza erişebiliyoruz.

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-42.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-43.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-44.webp" alt="Azure deployment" loading="lazy" />

<br/>

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-45.webp" alt="Azure deployment" loading="lazy" />

Şimdi, main bracnh'te yapılan herhangi bir değişiklik önce build pipeline (CI) ile geçecek, ardından release pipeline (CD) geçecek ve release, staging ortamına yapılacak. Production ortamına geçmek isterseniz, production deployment işlemi manuel olarak release ekranından tetiklenmelidir.

<img src="/img/achieving-zero-downtime-azure-app-service-deployment-using-azure-devops-and-deployment-slots/azure-deployment-46.webp" alt="Azure deployment" loading="lazy" />

## Zero downtime testing

Uygulamamız için gerekli pipeline'ları başarıyla oluşturduk, bundan sonra release sırasında herhangi bir kesinti olup olmadığını test etmemiz gerekecek. Bunun için _health-check/index.js_ dosyamızı aşağıdaki gibi güncelliyorum ve uygulamayı npm run start komutuyla çalıştırıp pipeline'ı tetikliyorum. Ardından, konsolda herhangi bir hata mesajı almadan, yani herhangi bir kesinti olmadan deployment sürecini tamamlıyorum!

```js
import fetch from "node-fetch";  
  
const check = async (url) => {  
  try {  
    const response = await fetch(url, {  
      method: "GET",  
    });  
    const result = await response.text();  
  
    if (result !== "Healthy") {  
      console.log(`${new Date().toISOString()}, ${url} result is not OK`);  
    }  
  } catch (error) {  
    console.log(`${new Date().toISOString()}, ${url} error is ${error.message}`);  
  }  
};  
  
(() => {  
  setInterval(() => {  
    check("https://deployment-slot-demo.azurewebsites.net/health");  
  }, 50);  
  setInterval(() => {  
    check("https://deployment-slot-demo-staging.azurewebsites.net/health");  
  }, 50);  
})();
```

Benzer bir işlemi deployment slots özelliği uygulamayan bir App Service ile denersek, aşağıdaki gibi bir hata alırız.

```bash
2023-11-14T12:28:39.506Z, [some-url]/health error is request to [some-url]/health failed, reason: connect ETIMEDOUT 100.100.100.100:443
```

---

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme dünyasındaki en son güncellemeleri ve düşüncelerimi kaçırmayın. Bağlantıdan beni takip ederek [@berkslv](https://x.com/berkslv) ile bağlantıda ve iletişimde kalın.