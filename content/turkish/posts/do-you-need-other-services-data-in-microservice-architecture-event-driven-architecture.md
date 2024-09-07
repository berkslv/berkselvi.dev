+++
title = "Event-Driven Architecture: Mikroservis mimarisinde başka servislerin verilerine mi ihtiyacınız var"
date = "2024-09-07T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["microservices", "event", "service to service comminication", "synchronous communication", "asynchronous communication"]
description = "Mikroservis mimarisinde, servisler arasındaki veri bağımlılığı senkron veya asenkron iletişimle yönetilebilir. Senkron iletişim, sıkı servis bağlantısı nedeniyle ölçeklenebilirlik ve erişilebilirlik sorunlarına neden olabilirken, asenkron iletişim bağımlılığı azaltarak servislerin bağımsız olarak çalışmasına olanak tanır. Doğru yöntemi seçmek belirli senaryoya bağlıdır, ancak asenkron iletişim genellikle daha ölçeklenebilir ve erişilebilir çözümler sunar."
showFullContent = false
readingTime = true
cover = "img/do-you-need-other-services-data-in-microservice-architecture-event-driven-architecture/cover.jpg"
+++

Microservice mimarisinde geliştirilen uygulamalarda domainler genellikle birbirlerinden sıkı bir şekilde ayrılmaya çalışılıyor, inceleyeceğimiz örnekte ürün ile ilgili tüm logic ve data product servisinde yer alırken, bu ürün ile sipariş oluşturabilecek satış danışmanlarını yöneten organization serviside kendi logic ve datasını barındırıyor. 

Ancak organization servisinde satış danışmanı oluşturmak için yapacağımız `createUnit()` isteği validasyon sebepleri için product servisinin verisine ihtiyaç duyacaktır. Var olmayan bir ürün için oluşturma izni unit’e verilmemeli değil mi? Bu durumda organization servisi kendi domain’inde yer almayan ve kendi sorumluluğunda olmayan product servisinin verisine ihtiyaç duyacak.

Bu veriye senkron veya asenkron olarak erişebiliriz. ilk olarak senkron olarak erişecek ve yaşayacağımız sorunları ele aldıktan sonra, asenkron methodu kullanıp yaşayabileceğimiz sorunları ele alacağız, hadi başlayalım.

## Synchronous communication

Organization servisimize rest ile göndereceğimiz istek ile, createUnit() methodunu tetikletecek ve unit oluşturacağız, ancak bu servis product verisine validasyon sebebiyle için ihtiyaç duyacağı için bu veriyi senkron olarak, HTTP REST yardımıyla yapacağı `getProduct()` isteği ile getirmesi gerekecektir. 

runtime sırasında, createUnit methodunun işlenebilmesi için organization servisine ek olarak product servisininde ayakta ve erişilebilir olması, aradaki network bağlantısında bir sorun olmaması gerekiyor. Eğer product servisi çalışmıyorsa, organization serviside çalışmayacaktır. Her iki serviste ayakta ve erişilebilir olduğu durumlarda ise product servisi yavaş çalışıyorsa, senkron yapacağımız istek akışı bloklayacağı için, organization serviside yavaş çalışacaktır. Bu sorunu aşmak için organization servisinin yoğun istek aldığı durumlarda scale edilecektir. Ancak runtime bağımlılığı bulunan product servisininde organizationdan gelecek bol miktarda isteği karşılayabilmek için aynı şekilde scale etmemiz gerekecektir. Bu pratiği tüm servislere uyguladığımız senaryoda, tüm servislerin beraber scale edilmesi gerekecektir. Bu sebeple Organization servisi, Product servisine son derece bağımlı olup, yaşamlarına kendi başlarına değil, beraber devam etmek zorunda kalacaklardır. Eğer microservice mimarimizdeki tüm servislerimiz birbirlerine bu şekilde bağımlı olursa tek bir servisin erişilemez olması diğer tüm servislerin erişilemez olmasına yol açabilir. 

design time sırasında ise product servisinin getProduct API’ında yapılacak olan bir geliştirme sonrası Organization servisinin geliştirici takımıda aynı değişikliği kendi Product HTTP Client entegrasyonlarında yapmaları gerekecektir. Bu değişiklik büyük olasılıkla organization servisinin iş akışlarındada kod değişikliğe yol açacaktır.

Sonuç olarak hem runtime’da hemde design time’da coupling ortaya çıkacağı için iki servis birbirine göbekten bağlı olacaktır, Jonathan Tower’ın tabiriyle [distributed monolith](https://www.youtube.com/watch?v=p2GlRToY5HI&t=1203s) geliştirmiş olacağız. Bir servisimizde yapılacak olan değişiklik, diğer serviside direk olarak etkileyeceğinden ötürü, sürekli değişen iş gereksinimlerine hızlıca cevap veremeyeceğiz. Product servisinin getProduct() methodunda yapılan herhangi bir geliştirmeye istinaden, bu ucu kullanan diğer servislerinde aynı geliştirmeyi kendi servislerinde yapması gerekecektir. Geliştirmeyi bir şekilde tamamladıktan sonrada son kullanıcıların uygulamamızı kullanabilmesi için senkron olarak birbirlerine bağlı olan tüm servislerin erişilebilir olması gerekecektir.

<img src="/img/do-you-need-other-services-data-in-microservice-architecture-event-driven-architecture/synchronous-communication.png" alt="Synchronous communication" loading="lazy" />
<p class="image-sub-title">Synchronous communication</p>


Müşterimize bir SLA garantisi vermek istediğimiz senaryoda, iyimser olarak Product ve Organization servislerimiz için %99.5 uptime garantisi verecek olursak yıllık 43 saat downtime yaşanabileceğini kabul ediyoruz. product ve organization servislerinin runtime’da bağımlı olacağı senaryoda $0.995 * 0,995 = 0.990$ hesabıyla senkron iletişimle beraber çalışan servislerimiz ile yaşanan bağımlılık sonucunda, her bir servisimiz iki kat daha kötü uptime garanti ederek, yıllık 87 saat downtime yaşayabileceklerini görüyoruz.

|  | Product | Organization | Product & Organization |
| --- | --- | --- | --- |
| Uptime percentege | 99.5 | 99.5 | 99.0 |
| Month | 716 | 716 | 712 |
| Downtime in month | 4 | 4 | 7 |
| Year | 8716 | 8716 | 8672 |
| Downtime in year | 43 | 43 | 87 |

Peki başımızı bu kadar ağrıtabileceğini ön gördüğümüz bu yöntemden nasıl kaçınacağız? Servisler arası iletişimdeki diğer çözüm önerimize bir bakalım. 

## Asynchronous communication

Senkron iletişim, servisler arası bağımlılığı mümkün olan her yönde arttırdığı için bu seçeneği tercih etmek istemezsek, diğer seçeneğimiz olan asenkron iletişimle devam edebiliriz. Asenkron yöntemle okları tersine çevirerek Product servisinin Product tablosunda bir güncelleme yaşanması durumunda ProductCreatedEvent isminde bir domain event publish ediyoruz. Bu eventi dinleyen tüm servisler, kendi veritabanlarında tuttukları products tablolarını güncelliyorlar.

Organization servisi product verisine ihtiyaç duyduğunda kendi veritabanında yer alan products tablosundan okuma yapacaktır. Bu tablo organization’ın iş akışlarından etkilenmeden, sadece okuma yapılacaktır. Bu şekilde createUnit() methodumuzda ihtiyacımız olacak ürün bilgisini sorgulamak için unit verisini kaydedeceğimiz aynı veritabanından okuma yaparak ilgili veriye ulaşmış oluruz. 

<img src="/img/do-you-need-other-services-data-in-microservice-architecture-event-driven-architecture/asynchronous-communication.png" alt="Asynchronous communication" loading="lazy" />
<p class="image-sub-title">Asynchronous communication</p>

Bu yöntemle createUnit() akışımızda product verisine organization’ın kendi veritabanından erişerek, Product servisimize runtime sırasındaki bağımlılığımızı ortadan kaldırıyoruz. 

Bu sayede, run time sırasındaki bağımlılık ortadan kalkıyor, çünkü product servisinin verdiği getProduct() ucunu senkron bir şekilde sorgulamayı bıraktık. design time sırasındada geliştirme yaparken yaşadığımız bağımlılıkta ortadan kalkmış oluyor. Çünkü Product servisinin getProduct() methodunda yaptığımız bir değişiklik sonrasında Organization servisine sahip olan takımın kendi servislerinde bir değişiklik yapması gerekmiyor. 

Design time sırasındada asenkron bir bağımlılığımız var, sadece ihtiyacımız olduğu durumlarda ilgili değişiklikleri yapmamız gerekiyor. Eğer Product servisinin product domain modelinde bir değişiklik yapılarak yeni bir kolon eklenirse, bu kolon direk olarak event’e yeni bir field olarak eklenebilir. Eğer product tablosunda bir kolon silindiyse, bu kolon, event tipinde silinmeden default değerleri ile gönderilmeye başlanıp, obsolete olarakta işaretlenebilir. Bu eklenip çıkartılan kolonlara diğer servisler diledikleri gibi cevap verebilir veya hiç bir değişiklik yapmadan kendi hayatlarına devam edebilirler. 

Publish edilen eventin, kimler tarafından işlendiği publish eden taraf olan Product servisini ilgilendirmez. Artık bu veriye ihtiyacı olan herkes bu eventi consume edip, kendi veritabanlarında product verisinin bir kopyasını tutarak, Product servisiyle senkron bir iletişime geçmeden kendi işlerini kendi başlarına halledebiliyorlar. Bu şekilde daha scale edilebilir ve daha erişilebilir uygulamalar ortaya çıkarmış oluyoruz, çünkü artık uygulamalarımızın farklı bir servise bağımlılığı bulunmadan kendi başlarına hareket edilebiliyorlar.

Eğer tablolarımızın domain bazında karışacağını düşünüyorsak farklı domainlerden gelecek olan tabloları aşağıdaki örnekteki gibi farklı bir veritabanı şemasında tutabiliriz. 

<img src="/img/do-you-need-other-services-data-in-microservice-architecture-event-driven-architecture/asynchronous-communication-2.png" alt="Asynchronous communication" loading="lazy" />
<p class="image-sub-title">Asynchronous communication 2</p>

## Eventual consistency

Bu yöntemin karşımıza çıkartacağı en büyük sorun, eventual consistency yaratacak olmasıdır. Product servisine eklenen bir ürünün, organization servisindeki ilgili tabloya yansıması aynı t anında değil, aradaki message broker’ın erişilebilirlik durumuna göre, birkaç milisaniye veya saniye gecikme ile yaşanacaktır. 

Bu durumu CAP teorisiylede açıklayabiliriz. CAP teorisinin 3 bacağından biri olan Partition tolarence bacağını sabit tutarsak, Consistency ve Availability bacaklarından birisi artarken diğeri azalacaktır. Dolayısıyla bu üç seçeneği aynı anda sağlayamayacağız. Buradada çalıştığımız iş akışına göre karar vermemiz gerekiyor. 

Örneğin bir eticaret sisteminde sepete ekleme özelliğinin highly avaliable olması gerekebilir, çünkü sepete ekleme özelliği çalışmıyorsa, lütfen daha sonra tekrar deneyin gibi bir hata alıyorsak, o sitede değil rakip sitede alışverişe devam etmemiz olasıdır. Ancak sepete devam ettiğimizde istediğimiz üründen 1 değil 2 adet görürsek ilgili düzeltmemizi yapıp ödemeye devam edebiliriz. 

Fakat aynı durumu otel rezervasyonlarında uygulayamayabiliriz. Sepet örneğimizin tersine consistency muhtemelen daha önemli olacaktır. Aynı odayı birden çok kişiye kiralamak yerine, lütfen daha sonra tekrar deneyin gibi bir hata dönmek çok daha mantıklı olabilir.

Sonuç olarak senkron iletişimin uygun olduğu immediate consistency isteyen akışlar için senkron iletişim, high avalability ihtiyacı olan akışlar için ise asenkron iletişimden faydalanabiliriz. Burada küçük bir yorum olarak microservice mimarisindeki akışlarda genellikle high avalability tercih edilmesi gerekiyor, çünkü diğer senkron iletişim yöntemiyle tüm servislerimiz göbekten birbirlerine bağımlı olacaklardır.

<img src="/img/do-you-need-other-services-data-in-microservice-architecture-event-driven-architecture/high-avalability-vs-immidiate-consistency.png" alt="High avalability vs Immidiate consistency" loading="lazy" />
<p class="image-sub-title">High avalability vs Immidiate consistency</p>

## Edge cases in asynchronous communication

Eğer servisleriniz arasındaki iletişimde, event driven architecture ile ilerlemeye karar verdiyseniz sistemdeki veri tutarlılığını sağlamak içinde bir şeyler yapmanız gerekecektir. Bir servisimize create isteği gelir ve CreatedEvent publish edersek, ilk önce veritabanını güncelleyip, sornasında event publish ettiğimiz durumda, eğer veritabanında yürüttüğümüz transaction hatayla sonuçlanır, ve bunu takip etmeden eventi publish edersek, veya veritabanında yürüttüğümüz transaction başarıyla sonuçlanır, ancak sonrasında event bus’a erişilemezse, uygulamalarımızda dağıtık olarak duran veri, insonsistent state’e düşebilir. Bu durumun önüne geçmek için product servisi kendi veritabanındaki product verisini güncellerken aynı zamanda aynı veritabanında yer alan outbox tablosunada ilgili eventi ekledikten sonra, farklı bir thread bu tabloyu devamlı olarak tarayarak yeni gelen eventleri publish eder. Veritabanına yaptığımız kayıt atomic olarak işleneceği için product verisi oluşturulurken event verisininde outbox tablosunda oluşturulacağı garanti edilir. Fakat birden çok instance olarak çalışan bir uygulamada bir eventin aynı outbox tablosundan 2 defa okuyup, 2 defa publish etmesi gibi durumlarla karşılaşılabilir. Bu durumda zaten idempotency sorununa çıkıyor.

Bir metodun bir defa çağrıldığında alınan sonuç ile birden fazla kez çağrıldığında alınan sonuç aynı ise bu bir idempotent metottur. Bir eventin, farklı sebeplerden ötürü, birden çok kez işlenip sistemdeki veri tutarlılığını bozulmasını önlemek için, eventlerin benzersiz message id değerlerini consume edildikten sonra veritabanına kaydedip, yeni bir event consume edileceği zaman, message id değeri veritabanında yoksa işleme devam etmemiz gerekecektir. Chris Richardson (microservices.io) bu konuya Pattern: Idempotent Consumer isimli yazısındada değiniyor. 

<img src="/img/do-you-need-other-services-data-in-microservice-architecture-event-driven-architecture/without-outbox-idempotency.png" alt="Without Outbox & Idempotency" loading="lazy" />
<p class="image-sub-title">Without Outbox & Idempotency</p>

<img src="/img/do-you-need-other-services-data-in-microservice-architecture-event-driven-architecture/outbox-idempotency.png" alt="Outbox & Idempotency" loading="lazy" />
<p class="image-sub-title">Outbox & Idempotency</p>

Sonuç olarak Computer Science alanındaki çoğu problemle sunulan çözüm önerilerinde olduğu gibi elimizde bir silver bullet bulunmuyor. Her iki yönteminde avantajları ve dezavantajlarını kapsamlı bir şekilde, çalıştığımız domain’inde aklımızda bulundurup değerlendirdikten sonra dilediğimiz yöntemle devam edebiliriz. Ancak benim önerim, servisler arasındaki bağımlılığı mümkün olduğu durumlarda asenkron iletişim kullanarak ortadan kaldırmak olacaktır.

Asenkron ve senkron veri iletişimiyle çalışırken yaşanbilecek durumları simule etmek için geliştirdiğim .NET projesine aşağıdaki github reposundan ulaşabilirsiniz. Örnekte outbox yapısı için MassTransit tarafından sağlanan altyapı kullanılarak bu özellik için özel bir geliştirme yapılmamıştır.

[GitHub - berkslv/lecture-fetch-other-service-data-with-event-driven-architecture](https://github.com/berkslv/lecture-fetch-other-service-data-with-event-driven-architecture)


## Resources

[Don’t Build a Distributed Monolith - Jonathan "J." Tower - NDC London 2023](https://www.youtube.com/watch?v=p2GlRToY5HI&t=1203s)

[The Many Meanings of Event-Driven Architecture • Martin Fowler • GOTO 2017](https://www.youtube.com/watch?v=STKCRSUsyP0)

[Solving distributed data problems in a microservice architecture | Microservices.io](https://www.youtube.com/watch?v=AEbJgpamZ4w&t=898s)

[You Keep Using That Word • Sam Newman • GOTO 2023](https://www.youtube.com/watch?v=rZxIzrjvSGg&t=716s)

[Microservices Pattern: Pattern: Idempotent Consumer](https://microservices.io/patterns/communication-style/idempotent-consumer.html)

[The Reactive Manifesto](https://www.reactivemanifesto.org/en)

---

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme alanındaki araştırmalarımı kaçırmamak için [@berkslv](https://x.com/berkslv) adresinden takipte kalabilirsiniz.