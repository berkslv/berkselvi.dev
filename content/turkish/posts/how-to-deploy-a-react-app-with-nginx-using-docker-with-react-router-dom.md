+++
title = "React-router-dom kullanarak bir React uygulamasını Docker ile Nginx'e nasıl deploy ederiz?"
date = "2023-01-21T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["react","nginx","docker","deployment"] 
description = "Bu adım adım kılavuzda, bir React uygulamasını Nginx kullanarak Docker ile nasıl dağıtacağınızı öğreneceksiniz. Bu kılavuz, React uygulamanız için bir Docker dosyası oluşturmaktan Docker Compose kullanımına kadar her şeyi kapsar..." 
showFullContent = false
readingTime = true
+++

Bir React uygulamasını deploy etmek istiyorsanız, web sunucusuna deployment veya Docker gibi bir container aracı kullanma gibi birkaç seçenek mevcuttur. Bu kılavuzda, bir React uygulamasını Nginx kullanarak Docker ile nasıl deploy edebileceğimizi göreceğiz. Nginx, yüksek performansı ve düşük kaynak kullanımı ile tanınan popüler bir açık kaynaklı web sunucusudur. React uygulamamız için bir Docker dosyası oluşturacağız ve uygulamayı sunmak için Nginx'i kullanacağız. Ayrıca, Nginx'e uygulamayı nasıl sunacağını söylemek için bir Nginx yapılandırma dosyası da oluşturacağız. Son olarak, uygulamamızın bir Docker image'ini oluşturacak ve uygulamayı deploy etmek için bir Docker container çalıştıracağız.

## Önkoşullar:

- Docker hakkında temel bir bilgi
- Deploy edilecek bir React uygulaması


## Step 1: Create a Dockerfile

İlk adım, React uygulamamız için bir Docker dosyası oluşturmaktır. Bu dosya, uygulamamızın bir Docker görüntüsünü nasıl oluşturacağımıza dair talimatlar içerecektir. İşte Nginx ile bir React uygulaması için bir Docker dosyası örneği:

```Dockerfile
# Use an official Node runtime as a parent image
FROM node:19-alpine as build

# Set the working directory to /app
WORKDIR /app

# Copy the package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Build the React app
RUN npm run build

# Use an official Nginx runtime as a parent image
FROM nginx:1.21.0-alpine

# Copy the ngnix.conf to the container
COPY ngnix.conf /etc/nginx/conf.d/default.conf

# Copy the React app build files to the container
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 80 for Nginx
EXPOSE 80

# Start Nginx when the container starts
CMD ["nginx", "-g", "daemon off;"]
```

Bu Docker dosyası, offical Node runtime ana image'i olarak kullanarak React uygulamasını kurmak ve derlemek için kullanır. Daha sonra React uygulamasını sunmak için resmi Nginx runtime ana image'ini base olarak kullanır.

# Step 2: Create an Nginx configuration file

Sonraki adım olarak, Nginx'e uygulamamızı nasıl sunacağını söylemek için bir Nginx yapılandırma dosyası oluşturmamız gerekiyor. İşte bir örnek yapılandırma dosyası:

```conf
server {
  listen 80;
  server_name example.com;
  root /usr/share/nginx/html;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

__Bu `nginx.conf` dosyasını Dockerfile ile aynı dizine oluşturmalısınız.__ Bu yapılandırma dosyası, Nginx'in port 80'de dinlemesini ve React uygulamasını sunmasını sağlar. try_files yönergesi, Nginx'e istenen dosyayı sunmaya çalışmasını, ardından dosyayı içeren dizini ve son olarak istenen dosya veya dizin mevcut değilse index.html dosyasını sunmaya çalışmasını söyler.

# Step 3: Build the Docker image

Docker dosyası ve Nginx yapılandırma dosyası oluşturulduktan sonra, şimdi Docker image'i oluşturabiliriz. Docker dosyasını içeren dizine gidin ve aşağıdaki komutu çalıştırın:

```bash
docker build -t my-react-app .
```

Bu komut, Docker'a mevcut dizindeki Docker dosyasını kullanarak bir image oluşturmasını ve ona my-react-app adını etiketlemesini söyler. Komutun sonundaki nokta, Docker'ın oluşturma bağlamı olarak mevcut dizini kullanmasını sağlar.

# Step 4: Run the Docker container

Oluşturulan Docker görüntüsüyle şimdi aşağıdaki komutu kullanarak bir container çalıştırabiliriz:

```bash
docker run -p 80:80 my-react-app
```

Bu komut, my-react-app Docker görüntüsünden bir konteyner oluşturur ve konteynerdeki 80 numaralı bağlantı noktasını ana makinedeki 80 numaralı bağlantı noktasına eşler. Ardından, web tarayıcınızda http://localhost adresine giderek React uygulamanıza erişebilirsiniz.

Tebrikler, bir React uygulamasını Nginx kullanarak Docker ile başarıyla dağıttınız! Artık bu yöntemi kullanarak React uygulamalarınızı Docker'ı destekleyen herhangi bir sunucuya veya sunucu platformuna kolayca deploy edebilirsiniz.

# Step 5: Use Docker Compose to deploy the app

Uygulamanızı deploy etmek için daha basit bir yaklaşımı tercih ediyorsanız, container'larınızı yönetmek için Docker Compose'u kullanabilirsiniz. Docker Compose, çoklu container Docker uygulamalarını tanımlamanıza ve çalıştırmanıza olanak tanıyan bir araçtır.

Docker Compose'u kullanmak için, projenizin root dizininde bir docker-compose.yml dosyası oluşturmanız gerekecektir. İşte önceki Docker dosyasıyla kullanabileceğiniz bir örnek docker-compose.yml dosyası:

```yaml
version: '3'

services:
  my-react-app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "80:80"
    volumes:
      - ./ngnix.conf:/etc/nginx/conf.d/default.conf
```

Bu docker-compose.yml dosyasında, my-react-app adında tek bir servis tanımlıyoruz. Oluşturma bağlamını (.) ve Docker dosyasının adını Dockerfile olarak belirtiyoruz. Ayrıca, konteynerdeki 80 numaralı bağlantı noktasını ana makinedeki 80 numaralı bağlantı noktasına ports yapılandırması kullanarak eşleriz.

Son olarak, ana makinedeki ngnix.conf dosyasını konteynerin Nginx yapılandırma dizinindeki default.conf dosyasına eşleyen bir volume bağlarız. Bu, Docker görüntüsünü yeniden oluşturmadan Nginx yapılandırmasını özelleştirmemizi sağlar.

Bu docker-compose.yml dosyasını kullanmak için, sadece dosyayı içeren dizine gidin ve aşağıdaki komutu çalıştırın:

```bash

docker-compose up -d

```
Bu komut, Docker Compose'un my-react-app servisini Docker dosyasını kullanarak oluşturmasını ve bir konteyner çalıştırmasını söyler. -d bayrağı, konteynerin arka planda çalışmasını sağlayan detached modunda çalıştırır. Ardından, web tarayıcınızda http://localhost adresine giderek React uygulamanıza erişebilirsiniz.

Tebrikler! Bir React uygulamasını Nginx kullanarak Docker ve Docker Compose ile başarıyla dağıttınız. Artık React uygulamalarınızı Docker'ı destekleyen herhangi bir sunucuya veya barındırma platformuna kolayca dağıtabilirsiniz.

---

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme dünyasındaki en son güncellemeleri ve düşüncelerimi kaçırmayın. Bağlantıdan beni takip ederek [@berkslv](https://x.com/berkslv) ile bağlantıda ve iletişimde kalın.