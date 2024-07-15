+++
title = "RSA ile JavaScript'te Şifreleme ve .NET'te Şifre Çözme Nasıl Yapılır"
date = "2024-03-07T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["rsa", "cryptography", ".NET", "security"]
description = "In the digital world, securing communication between different systems is paramount. RSA encryption is an asymmetric encryption algorithm and provides a robust way to achieve this by using a pair of…"
showFullContent = false
readingTime = true
cover = "img/how-to-use-rsa-for-encryption-in-javascript-and-decryption-in-net/cover.webp"
+++

Dijital dünyada, farklı sistemler arasındaki iletişimin güvence altına alınması çok önemlidir. RSA şifreleme, iki adet anahtar kullanarak şifreleme ve şifre çözme için sağlam bir yol sağlar. Öte yandan, AES gibi simetrik şifreleme algoritmaları, şifreleme ve şifre çözme için tek bir anahtar kullanır. Bu nedenlerle, anahtarı halka açık olarak kullanmak ve hatta bir saldırganın eline geçse bile sorunları önlemek için asimetrik şifreleme algoritmalarından olan RSA tercih edilebilir.

Bu blog yazısında, OpenSSL ile RSA anahtar oluşturmayı, JavaScript'te şifrelemeyi ve .NET'te şifre çözmeyi, bir frontend uygulaması ile bir backend servisi arasında güvenli veri alışverişi sağlayacak uygulamayı ele alacağım.

## Understanding RSA Encryption

RSA (Rivest-Shamir-Adleman), güvenli veri iletimi için yaygın olarak kullanılan ilk açık anahtarlı kriptosistemlerden biridir. İki anahtarı içerir: açık anahtar, mesajları şifrelemek için açıkça paylaşılabilen ve onları şifrelemek için gizli tutulması gereken bir özel anahtar. RSA'nın gücü, iki büyük asal sayının çarpımını faktörleme zorluğunda yatar, bu da güvenliğini destekler.

## Generation of Public/Private key pairs with OpenSSL

RSA şifreleme ve şifre çözmenin uygulanmasındaki temel adımlardan biri, açık ve özel anahtar çiftlerinin oluşturulmasıdır. OpenSSL, kriptografi için sağlam bir açık kaynaklı araç olan bu anahtarları oluşturmanın basit bir yolunu sunar. Ancak, bu adım isteğe bağlıdır. .NET kütüphaneleri başarılı bir şekilde RSA anahtarları oluşturur. Ancak, bu gibi açık kaynaklı araçları kullanmak bize standartların güvencesini sağlar. Bu bölüm, OpenSSL'i kullanarak RSA açık/özel anahtar çifti oluşturma sürecini adım adım ele alacaktır.

Private anahtar oluşturma işlemiyle başlayabiliriz:

```bash
$ openssl genrsa -out privatekey.pem 2048  

$ cat privatekey.pem  
-----BEGIN PRIVATE KEY-----  
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDuOitcIPd5UpGN  
/4GEwNhc4fAmGP6fREJJk/byRgiLiWcyXwdoPwXdXjKSjkSIcETdz/hLAlb6+zNY  
Gi4Ap0S5flZSRiKh60xWRA4vZVgsLqhEi2IsclSlWu3R7KD5dkBGsyf5xlCfNSs4  
DbYYMgrXXZxXQ0c4qCikpnEB6OpqSzm19Cwrdq9GwophoAPxnf00d7S+y5QpRa+l  
Ca70xQ42FxBpMuK76a1g6i+JtmPgTYqXZ0FCMnUEzBq+u3N8LKoNzcSNdrLgvmHQ  
oOLFA/9BPe34YgLxoCUi+HhEiLSnvgz/Kn1yprvsz37baYizU/YWFG8s80SPmFsY  
JARxvZiJAgMBAAECggEAEboc42Jln+7Lu34NmIAUKZc7fE5EVjwpVZnP2Lfq510+  
Y2JsZe64pEAf8cVp5qA6E6pn3scKC2uZZr8t+Kj5xXbX/A/RgGyGte2jA5ZeQQ1o  
wo7/q3CHiXVyeHpMATwyLMCkoyLFeY9mi6mDiRniMiP6YAj22gmzWoszIhH/rZCO  
NjdpWRsIkFp8jIiyRhhoaBoJtZ1qV3twk8HH590rgjS7QUGJWK9uUsi5SDh69MsR  
r/SJ00gTMYFozFd6dB29aKj/p8fSk6qzh2noxU37AuiVc1A2H8Z6SAfRUDSvPkxA  
FdqVr62iLWmypBX2VYQ2p1pH1N0v8oG7NTxtrxgRTQKBgQD3YdxKNT0dWZJRGPFC  
DIRZVn86UgDAHRw29aToLARnepE5XOrLSmlGMqbK8vzRyUnlctJyG7x5ure2BMp4  
gKSLuhz48n7ZvpHyCVnNsqqkc21iM/whL/yKiI11Jz5koXmRDltz9IioQH/PwXvD  
RJbjxISHjG5YEKlVmztWtTup/QKBgQD2hqouE8JLePAUzK3SlfgVTlmaHDUeJev4  
u95RWPnMNOOwLUWbGYiKBoJ8uc2nSHmxIvEvEPGNwafR6etf0YocpwDfF5pnPDjk  
yA4hOdZrCyYa/UDqkB5pHTOZj5iVct1hBNbiANz6kL7Pl+H221U+HxD9rhaDPDez  
gdYPhLF4fQKBgQCdi2QomlkufOHS5eiXoLMU1iI2eQzjTGawlaYM+iNf503fU05w  
YxZCT3WroC3kSKXYC1T8uK9CcugWclyje4HPPpq+7GhesZ/unYfkmRlVm/EYbnTu  
icnyS96Ssohou/FYsOULJrt1M4ZyQA1aoS7bJUclsAiB6zJ8Q1z57ndt3QKBgEwa  
9p6S6wBxrWw+Y8sHETdCoNa6rotIGbkIBnIGjddE3KWe1EY1c7lomQ/4LEzgSvEs  
YFivWmLwzeY32LoT7hc6V0KH/tqv9MBsIjCPsmoJXxIl7Mx9AWZh5XQaqHg6pa01  
2UCcE5wm40EjGlcjDwXGgXBPNhP9mxSHmJXh2QfhAoGANouUrF3qv8ofb1HGrUXx  
DO/WkGMzwbkNmwwdgcGYVsGr3Dv/zx1y3TJEvqNh0ViVgmfdYveCo3VrSawq890U  
GJZXld2KFE1icEJpNoURkM9okZMzTDIMs+r4vq5Or2jB04mMuoCbG6rjfqUMtkll  
oAIFOSKH+F3TrXjNgy4/juo=  
-----END PRIVATE KEY-----
```

Başarıyla private anahtarı oluşturduktan sonra, oluşturduğumuz private anahtar ile public anahtarı oluşturabiliriz.

```bash
$ openssl rsa -in privatekey.pem -outform PEM -pubout -out publickey.pem  

$ cat privatekey.pem  
-----BEGIN PUBLIC KEY-----  
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7jorXCD3eVKRjf+BhMDY  
XOHwJhj+n0RCSZP28kYIi4lnMl8HaD8F3V4yko5EiHBE3c/4SwJW+vszWBouAKdE  
uX5WUkYioetMVkQOL2VYLC6oRItiLHJUpVrt0eyg+XZARrMn+cZQnzUrOA22GDIK  
112cV0NHOKgopKZxAejqaks5tfQsK3avRsKKYaAD8Z39NHe0vsuUKUWvpQmu9MUO  
NhcQaTLiu+mtYOovibZj4E2Kl2dBQjJ1BMwavrtzfCyqDc3EjXay4L5h0KDixQP/  
QT3t+GIC8aAlIvh4RIi0p74M/yp9cqa77M9+22mIs1P2FhRvLPNEj5hbGCQEcb2Y  
iQIDAQAB  
-----END PUBLIC KEY-----
```

## Setting Up the Environment for .NET RSA Decryption

.NET şifre çözme için .NET 8'i kullanacağım ve System.Security.Cryptography ad alanınından faydalanacağım. RSA şifre çözme için başka bir nuget paketine ihtiyacımız yoktur, bunun için şöyle bir Helper sınıf oluşturdum.

RsaKey'i appsettings.json dosyasından okuyoruz. RsaKey alanında yeni satırlar için \n eklemeniz gerekir. Bu anahtarı appsettings.json dosyasına koyduk çünkü her istekte aynı anahtarı kullanmak istiyoruz. Ancak .NET kütüphanesinin sorumluluğuna bırakırsanız, her başlangıçta yeni bir anahtar oluşturulacaktır.

```json
// appsettings.json  
{  
  "Logging": {  
    "LogLevel": {  
      "Default": "Information",  
      "Microsoft.AspNetCore": "Warning"  
    }  
  },  
  "AllowedHosts": "*",  
  "RsaKey": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCuan+y++Eqc2Vx3QIt9gv0r6rzfcxpsBRubcWCmI+8tqb40oflv5dViPSiCSWNgg5xKk7K8WTeEQQ6NDg1IJ2OwoQ2dfzat5qlpfV9EeF3u8iTY/hyQaaYFwB77cV9t5Czb8oG/+IIOByorJVds9tAoKjssKUZ3W9IU7ffElZjZrbjoiy/H4z8u9fOq8IL9Zf3pHgzv2FxF4BPJamqr4s1VtMqGJ5g18wV1OD9gcz9pJOHHUVieZ0+xP4WD4+1wCv/uwEgIcqmEs0os6birHZL1X/CSqBSPc8e/+kkZyyzoF+MBWPzvAwmW32alIxz2ZV0Z+jJtoOrh/qVqbrGAf+RAgMBAAECggEAEWYu4IJHg0ZZOZtgRwj7RtjKXzluraFi3GRHdoB1IFCBRiOsamMrO91qeAqdDCmL+saLbyvXEd8VMqA4djZPeWkWqt8ozwHPY9RzMZuZyCm7t9Zad71sWtI6mmJNF/46qWfOudWHbSX51+rFiMAzMFaGm3wAsFyaaBbv6gkohIhVrrMvpIuV8X8JNI8/VNlOR6vExHd/3uWKi8vPrFEFTNQ1UE+WJDkVojcmx0t63jlP8C/O4ofaJeCYRkAaM9+FXnM+jVNf0qZU+3JGYmy1R/B7L+LyrbG2uYTaBa1Ba9zGsXD1HQ4dctK+MltBd4p+MWgHAQV+xuVmGGDkylpb8QKBgQDP9zY4UzLmnt0werJF9SGmAJU51Y/+gannUC/+XYqnK/NA5iUDR86rlYCJbqQCceyMYJSYuePumygWOVL9rHnu1/fTMG/sXnRktmTSFemgeCYfPyn8/KeZKn6E5xw8GbtfLJLA8uM4DakDf9vSpilKDYT4UbZyKgq7/yodPXbgCQKBgQDWs4gL4yOtDLAY/OQKZvoyXClapldkVFRzf97pBJQGLYfdTzkVFviWsgI/yrA+t5tlzaWtZieuv2KsSmazVyO2W5ei9HILx4yRFK7K56OM5o7wqjN62ZmF0R+422YNaAyqYAd9nhLjgdsrmZ9FTxhQ91asBSH1AO3j6xaZUvh1SQKBgAZuo/ur/xgI89hrAxaM1WSYAgWO6Gw7wHCKF2HrrL0s69InDCAE2YyPDDGz/ViiA2n4FsB+h2E65UuCrGFyMzdC8MRUbDHIXhs7VPT2fopbDPrMblUHz3s6SD1+FG57cUMpUsSq/oIeUgrsqnTidMZ4kpNHm7f+OuTDqJ7M5t9ZAoGAAfm2570YR/BU8nXpNztJVAtLCh17sl2gRUvI5kX3grMKi/u9n7cNZH2Qzbt0sa8Iy///ZUAKX249Xy50EXRczMG8/G/ZWMhmP7N8BDvrYlGAwTAftyKnafbJnu7N2pO5ghvOFdbNf7BjLtyD/aRDqgMMlhqZ/GIczjsMgy6jQJkCgYATxkjdW/mnWLDDZAYm1V10Gnm7YDMwX3gKdhpoYleeeapZiDlurkR3YAEvQezcnhv3NpjaKQtF1/3Q0fZJ0wBc5FflaevHRjHTa0IrU5QIa48dLDx+jxn+cUCFx9kirkb7JcfJLZWtToPMLfCZt324P2ogZgWBwweVPiz1/voEXw==\n-----END PRIVATE KEY-----"  
}
```

```cs
// Helpers/RsaEncryptionHelper.cs  
public class RsaEncryptionHelper  
{  
    private readonly RSA _rsa = RSA.Create();  
      
    public RsaEncryptionHelper(IConfiguration configuration)  
    {  
        var privateKeyPem = configuration["RsaKey"];  
        if (string.IsNullOrEmpty(privateKeyPem)) throw new ArgumentNullException(nameof(privateKeyPem));  
        ImportKey(privateKeyPem);  
    }  
     
      
    public void ImportKey(string privateKey)  
    {  
        _rsa.ImportFromPem(privateKey.ToCharArray());  
    }  
      
    public string GetPublicKey()  
    {   
        var publicKey = _rsa.ExportSubjectPublicKeyInfoPem();  
        return publicKey;  
    }  
      
    public string GetPrivateKey()  
    {  
        var privateKey = _rsa.ExportPkcs8PrivateKeyPem();  
        return privateKey;  
    }  
      
    public string Encrypt(string data)  
    {  
        var dataBytes = Encoding.UTF8.GetBytes(data);  
        var encryptedData = _rsa.Encrypt(dataBytes, RSAEncryptionPadding.OaepSHA256);  
        return Convert.ToBase64String(encryptedData);  
    }  
      
    public string Decrypt(string data)  
    {  
        var dataBytes = Convert.FromBase64String(data);  
        var decryptedData = _rsa.Decrypt(dataBytes, RSAEncryptionPadding.OaepSHA256);  
        return Encoding.UTF8.GetString(decryptedData);  
    }  
}
```

Ve bu helper sınıfı EncryptionController içinde kullanarak helper sınıfın methodlarını kullanın. Production ortamlarında, PrivateKey'in kimseye açığa çıkarılmaması gerekir. Bu gizli tutulmalıdır.

```cs
// Controllers/EncryptionController.cs  
[ApiController]  
[Route("api/[controller]")]  
public class EncryptionController : ControllerBase  
{  
    private readonly RsaEncryptionHelper _rsaEncryptionHelper;  
      
    public EncryptionController(RsaEncryptionHelper rsaEncryptionHelper)  
    {  
        _rsaEncryptionHelper = rsaEncryptionHelper;  
    }  
      
    [HttpPost("Encrypt")]  
    public string Encrypt([FromBody] EncryptionRequest request)  
    {  
        return _rsaEncryptionHelper.Encrypt(request.Data);  
    }  
      
    [HttpPost("Decrypt")]  
    public string Decrypt([FromBody] EncryptionRequest request)  
    {  
        return _rsaEncryptionHelper.Decrypt(request.Data);  
    }  
      
    [HttpGet("PublicKey")]  
    public string PublicKey()  
    {  
        return _rsaEncryptionHelper.GetPublicKey();  
    }  
      
    [HttpGet("PrivateKey")]  
    public string PrivateKey()  
    {  
        return _rsaEncryptionHelper.GetPrivateKey();  
    }  
      
    [HttpPost("ImportKey")]  
    public void ImportKey([FromBody] ImportKeyRequest request)  
    {  
        _rsaEncryptionHelper.ImportKey(request.PrivateKey);  
    }  
      
}  
  
public record ImportKeyRequest  
{  
    public string PrivateKey { get; init; } = null!;  
}  
  
public record EncryptionRequest  
{  
    public string Data { get; init; } = null!;  
}
```

Bu backend tarafında yaptığımız geliştirmelerden sonra JavaScript tarafına geçerek devam edebiliriz. Yaptıklarımız sayesinde, public anahtarımızı istemciyle endpoint'ten paylaşabiliriz, ardından istemciler bu public anahtarı kullanarak verilerini güvenli iletişim için şifreleyebilirler.

## Setting Up the Development environment for JavaScript RSA Encryption

rnekte, modern tarayıcılara yerleşik olan ve RSA şifrelemeyi içeren kriptografik işlemleri sağlayan Web Crypto API'sini kullanacağız. Bu nedenle, herhangi bir npm paketi indirmenize gerek yoktur.

JavaScript ile tarayıcı uygulaması geliştireceksem genellikle Vite ile başlarım. Bunu yapmak için, aşağıdaki komutu girerek vanilla js veya React ile bir proje başlatabiliriz. Gösterim amaçlı küçük bir React projesi geliştireceğim, ancak vanilla js ile devam etmeniz durumda bile yeterli olacaktır.

```bash
npm create vite@latest
```

Bundan sonra src/utils/RsaEncryptionHelper.js dosyasını oluşturup o dosyayı aşağıdaki gibi dolduracağım. Bu dosyanın method'larıyla RSA algoritması ile şifreleyebilir ve şifresini çözebilirsiniz, ancak şifre çözme genellikle backend sorumluluğundadır çünkü şifre çözme private anahtar gerektirir ve güvenlik nedenlerinden dolayı javascript istemcisinin private anahtarları herkese açık olarak saklamaması veya private anahtarlara erişmemesi gerekir. Ancak SSL'deki gibi iki yönlü anahtar şifrelemeye benzer bir şey denemek isteyen olursa diye bunuda paylaşıyorum.

```js
// src/utils/RsaEncryptionHelper.js  
const encryptAlgorithm = {  
  name: "RSA-OAEP",  
  modulusLength: 2048,  
  publicExponent: new Uint8Array([1, 0, 1]),  
  extractable: true,  
  hash: {  
    name: "SHA-256",  
  },  
};  
  
function arrayBufferToBase64(arrayBuffer) {  
  const byteArray = new Uint8Array(arrayBuffer);  
  let byteString = "";  
  for (let i = 0; i < byteArray.byteLength; i++) {  
    byteString += String.fromCharCode(byteArray[i]);  
  }  
  const b64 = window.btoa(byteString);  
  return b64;  
}  
  
function base64StringToArrayBuffer(b64str) {  
  const byteStr = atob(b64str);  
  const bytes = new Uint8Array(byteStr.length);  
  for (let i = 0; i < byteStr.length; i++) {  
    bytes[i] = byteStr.charCodeAt(i);  
  }  
  return bytes.buffer;  
}  
  
function convertPemToArrayBuffer(pem) {  
  const lines = pem.split("\n");  
  let encoded = "";  
  for (let i = 0; i < lines.length; i++) {  
    if (  
      lines[i].trim().length > 0 &&  
      lines[i].indexOf("-----BEGIN RSA PRIVATE KEY-----") < 0 &&  
      lines[i].indexOf("-----BEGIN PRIVATE KEY-----") < 0 &&  
      lines[i].indexOf("-----BEGIN PUBLIC KEY-----") < 0 &&  
      lines[i].indexOf("-----END RSA PRIVATE KEY-----") < 0 &&  
      lines[i].indexOf("-----END PRIVATE KEY-----") < 0 &&  
      lines[i].indexOf("-----END PUBLIC KEY-----") < 0  
    ) {  
      encoded += lines[i].trim();  
    }  
  }  
  return base64StringToArrayBuffer(encoded);  
}  
  
export const encryptRsa = async (str, pemString) => {  
  try {  
    // convert string into ArrayBuffer  
    const encodedPlaintext = new TextEncoder().encode(str).buffer;  
    const keyArrayBuffer = convertPemToArrayBuffer(pemString);  
    // import public key  
    const secretKey = await crypto.subtle.importKey(  
      "spki",  
      keyArrayBuffer,  
      encryptAlgorithm,  
      true,  
      ["encrypt"]  
    );  
    // encrypt the text with the public key  
    const encrypted = await crypto.subtle.encrypt(  
      {  
        name: "RSA-OAEP",  
      },  
      secretKey,  
      encodedPlaintext  
    );  
    // store data into base64 string  
    return arrayBufferToBase64(encrypted);  
  } catch (error) {  
    console.error("Encryption Error:", error);  
  }  
};  
  
export const decryptRsa = async (str, pemString) => {  
  try {  
    // convert base64 encoded input string into ArrayBuffer  
    const encodedPlaintext = base64StringToArrayBuffer(str);  
    const keyArrayBuffer = convertPemToArrayBuffer(pemString);  
    // import private key  
    const secretKey = await crypto.subtle.importKey(  
      "pkcs8",  
      keyArrayBuffer,  
      encryptAlgorithm,  
      true,  
      ["decrypt"]  
    );  
    // decrypt the text with the public key  
    const decrypted = await crypto.subtle.decrypt(  
      {  
        name: "RSA-OAEP",  
      },  
      secretKey,  
      encodedPlaintext  
    );  
    // decode the decrypted ArrayBuffer output  
    const uint8Array = new Uint8Array(decrypted);  
    const textDecoder = new TextDecoder();  
    const decodedString = textDecoder.decode(uint8Array);  
    return decodedString;  
  } catch (error) {  
    console.error("Decryption Error:", error);  
  }  
};
```

Bu yardımcı yöntemleri kullanarak küçük bir React projesi geliştirdim. Verileri şifrelemek ve şifresini çözmek için .NET API'den paylaşılacak genel ve özel anahtarlarınızı kullanabilirsiniz, ancak şifre çözme işleminin arka uçta gizli tutulan özel anahtarla yapılması gerektiğini unutmayın.

<a href="https://lecture-rsa-dotnet-javascript.vercel.app" target="_blank">

<img src="/img/how-to-use-rsa-for-encryption-in-javascript-and-decryption-in-net/rsa-encryption.webp" alt="RSA Encryption (lecture-rsa-dotnet-javascript.vercel.app)" loading="lazy" />
<p class="image-sub-title">RSA Encryption (lecture-rsa-dotnet-javascript.vercel.app)</p>

</a>


Kaynak koduna erişmek isterseniz projenin tamamını GitHub hesabımda bulabilirsiniz:

[GitHub - berkslv/lecture-rsa-dotnet-javascript](https://github.com/berkslv/lecture-rsa-dotnet-javascript)


---

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme alanındaki araştırmalarımı kaçırmamak için [@berkslv](https://x.com/berkslv) adresinden takipte kalabilirsiniz.