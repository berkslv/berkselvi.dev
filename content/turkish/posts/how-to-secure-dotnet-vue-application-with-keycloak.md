+++
title = "Dotnet ve Vue.js uygulamasını Keycloak ile nasıl güvenliği sağlanır?"
date = "2023-08-21T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["keycloak",".NET","vue","microservices"]
description = "Dotnet ve Vue uygulamalarını Keycloak ile nasıl güvence altına alınacağını keşfedin. Bu rehber, Docker kurulumu, alan ve istemci yapılandırması, Vue.js uygulamalarını güvence altına alma, Dotnet WebAPI oluşturma, API'yi Vue'dan tüketme ve daha fazlasını içerir..."
showFullContent = false
readingTime = true
cover = "img/how-to-secure-dotnet-vue-application-with-keycloak/cover.webp"
+++

Bu yazıda, dotnet ve vue uygulamalarımızı keycloak kullanarak nasıl güvence altına alabileceğimizi konuşacağım.

Öncelikle, Keycloak uygulamamızı docker kullanarak çalıştırıyoruz, bu uygulamayı Azure veya benzeri bir bulut sağlayıcısında yayınlarsanız, production uygulamalarınızda kolayca kullanabilirsiniz.

```bash
docker run -p 8080:8080 -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:22.0.1 start-dev
```

Keycloak çalıştıktan sonra, localhost:8080/admin adresine kullanıcı adı: admin ve şifre: admin ile giriş yaptıktan sonra sol taraftan uygulamamız için bir alan (realm) oluştururuz. Ana (master) alan keycloak'un kendi kullanımına atandığından, başka bir realm üzerinde çalışmamız gerekmektedir.

<img src="/img/how-to-secure-dotnet-vue-application-with-keycloak/create-realm.webp" alt="Create realm" loading="lazy" />
<p class="image-sub-title">Create realm</p>

<img src="/img/how-to-secure-dotnet-vue-application-with-keycloak/create-realm-confirmation.webp" alt="Create realm confirmation" loading="lazy" />
<p class="image-sub-title">Create realm confirmation</p>

Realm’i oluşturduktan sonra client kısmından vue adında bir client oluşturuyoruz. Yönlendirme URL'lerimiz Vue uygulamamızın URL'sidir. production ortamı için ek güncellemeler yapmanız gerekebilir.

Vue uygulamamızda kullanmak üzere Kullanıcılar menüsünden dotnet-vue realm altında kullanıcılar oluşturabiliriz.

Uygulamamız için kullanıcı oluşturmak istiyorsak realm ayarlarında bu seçeneği açarak kullanıcılarımızın keycloak'a kayıt olmalarını sağlayabiliriz.

## Vue

Bu konfigürasyonları tamamladıktan sonra keycloak admin paneli ile işimiz bitiyor, vue uygulamamıza yetkisiz bir istek geldiğinde onu keycloak giriş sayfamıza yönlendirmemiz gerekiyor. Bunun için [Secure Vue.js app with Keycloak](https://medium.com/keycloak/secure-vue-js-app-with-keycloak-94814181e344) makalesinden yararlanıyoruz.

Vue uygulamamızı vite kullanarak şu şekilde oluşturabiliriz, sorulan sorulardan Vue ve Javascript seçip devam edebilirsiniz.

```bash
npm create vite@latest vue  
cd vue  
npm install  
npm run dev
```

Daha sonra main.js içeriğini aşağıdaki gibi güncelliyoruz. Bu komut dosyası, yetkisiz oturum açma isteklerini yeniden yönlendirir ve token'ın süresinin onTokenExpired ile sona ermesi durumunda token'ı refrest token kullanarak günceller. Bu işlem sonrasında uygulamayı npm run dev ile çalıştırıp http://localhost:5173 adresine gidersek keycloak giriş url’si yönlendirilecektir. Oluşturduğumuz kullanıcı bilgileriyle giriş yaparsak sistemimize giriş yapmış olacağız.

```js
  
import { createApp } from "vue";  
import "./style.css";  
import App from "./App.vue";  
import Keycloak from "keycloak-js";  
  
let initOptions = {  
  url: "http://localhost:8080",  
  realm: "dotnet-vue",  
  clientId: "vue",  
  onLoad: "login-required",  
};  
  
let keycloak = new Keycloak(initOptions);  
  
keycloak  
  .init({ onLoad: initOptions.onLoad })  
  .then((auth) => {  
    if (!auth) {  
      window.location.reload();  
    } else {  
      console.log("Authenticated");  
    }  
  
    createApp(App).mount("#app");  
  })  
  .catch((error) => {  
    console.log(error);  
    console.error("Authenticated Failed");  
  });  
  
keycloak.onTokenExpired = () => {  
  console.log("Token expired");  
  
  keycloak  
  .updateToken(30 * 60)  
  .then(() => {  
    console.log("Token renewed");  
  })  
  .catch(() => {  
    keycloak.login()  
  })  
}  
  
export default keycloak;
```

## .NET

.NET 6 ile aşağıdaki gibi bir webapi projesi oluşturabiliriz.

```bash
cd dotnet  
dotnet new sln -n Secured  
dotnet new webapi -o Secured.API  
cd Secured.API  
dotnet watch run
```

Keycloak ve .NET'in desteklediği standartlar sayesinde Program.cs'de yapacağımız konfigürasyonlarla özel bir kod yazmadan sadece yetkilendirebiliyoruz. Bu kodda, ihraççı ile tokenın nereden geldiğini doğruluyoruz ve IssuerSigningKey sayesinde keycloak'a gitmeden oluşturulan tokenı doğrulayabiliyoruz.

RequireHttpsMetadata yalnızca geliştirme ortamı için kullanılmalıdır; production ortamında çalışan bir uygulamanız varsa bu satırı silebilirsiniz; değeri true olarak değerlendirilecektir.

```cs
builder.Services.AddSwaggerGen();  
  
// ...  
  
var issuer = builder.Configuration["Jwt:Issuer"];  
var key = builder.Configuration["Jwt:Key"];  
builder.Services.AddAuthentication(options =>  
    {  
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;  
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;  
    })  
    .AddJwtBearer(o =>  
    {  
        o.Authority = issuer;  
        o.RequireHttpsMetadata = false;  
        o.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters  
        {  
            ValidateIssuer = true,  
            ValidateAudience = false,  
            ValidateLifetime = true,  
            ValidateIssuerSigningKey = true,  
            ValidIssuer = issuer,  
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key))  
        };  
    });  
  
// ...  
  
var app = builder.Build();  
  
// ...  
  
app.UseAuthentication();  
app.UseAuthorization();  
  
// ...  
  
app.Run();
```

Appsettings.json dosyasındaki verileri aşağıdaki gibi tutarak builder.Configuration adresinden erişebiliriz. RSA256 anahtarına keycloak admin panelinde ilgili realm altında Realm ayarları menüsündeki Keys sekmesindeki RSA256 Kid değerinden ulaşabilirsiniz.

```json
"Jwt": {  
  "Issuer": "https://localhost:8080/realms/dotnet-vue",  
  "Key": "secret-rsa-key"  
},  

```

## Consuming .NET API from Vue app

Öncelikle .NET projemize CORS ayarlarını ve Authorize niteliklerini ekliyoruz. Bunun için `Program.cs`yi aşağıdaki gibi düzenliyoruz.

```cs
  
// ...  
  
builder.Services.AddCors(options =>  
{  
    options.AddDefaultPolicy(  
        policy => policy.WithOrigins("http://localhost:5137")  
            .AllowAnyHeader()  
            .AllowAnyMethod()  
            .AllowAnyOrigin()  
    );  
});  
  
// ...  
  
var app = builder.Build();  
  
// app.UseHttpsRedirection();  
  
app.UseCors();
```

WeatherForecastController.cs dosyası aşağıdaki attirbute ile yetkilendirme gerektirir.

```cs
// ...  
  
[Authorize]  
public class WeatherForecastController : ControllerBase  
  
// ...
```

Daha sonra aşağıdaki komutla vue uygulamamıza axios kütüphanesini kuruyoruz.

```bash
npm install axios
```

Kurulumdan sonra services isimli bir klasör oluşturup `base.api.js` isimli dosyamızda axios konfigürasyonlarını yapıyoruz.

```js
  
import axios from "axios";  
import keycloak from "../main"  
  
const http = axios.create({  
  baseURL: "http://localhost:5050",  
  headers: {  
    "Content-Type": "application/json",  
  },  
});  
  
http.interceptors.request.use(  
  async (config) => {  
    const token = localStorage.getItem("vue-token");  
    config.headers = {  
      Authorization: `Bearer ${keycloak.token}`,  
      Accept: "application/json",  
    };  
    return config;  
  },  
  (error) => {  
    Promise.reject(error);  
  }  
);  
  
export default http;
```

Örnek bir endpoint olan WeatherForecast'e erişmek için, aynı dizine `weather.api.js` dosyasını oluşturuyoruz.

```js
  
import axios from "./base.api";  
  
export const getWeather = async () => {  
    const response = await axios.get(`/WeatherForecast`);  
    return response.data;  
}
```

`App.vue`da API isteğimizi yaparak verileri görüntülüyoruz, burada logout yöntemi ile çıkış yapabiliyoruz.

```vue
  
<script>  
import Keycloak from './main';  
import { getWeather } from './service/weather.api';  
  
export default {  
  name: 'App',  
  data() {  
    return {  
      weathers: []  
    }  
  },  
  async mounted() {  
    this.weathers = await getWeather();  
  },  
  methods: {  
    logout() {  
      Keycloak.logout();  
    }  
  },  
}  
  
</script>  
  
<template>  
  <button @click="logout" style="margin-bottom: 30px;">Logout</button>  
  <table>  
    <tr>  
      <th>Date</th>  
      <th>Summary</th>  
    </tr>  
    <tr v-for="weather in weathers">  
      <td>{{ weather.date }}</td>  
      <td>{{ weather.summary }}</td>  
    </tr>  
  </table>  
</template>
```

Kaynak koduna erişmek isterseniz projenin tamamını GitHub hesabımda bulabilirsiniz:

[GitHub - berkslv/lecture-dotnet-vue-keycloak](https://github.com/berkslv/lecture-dotnet-vue-keycloak)

---

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme alanındaki araştırmalarımı kaçırmamak için [@berkslv](https://x.com/berkslv) adresinden takipte kalabilirsiniz.