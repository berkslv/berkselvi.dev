+++
title = ".NET ile Background jobs ve Hangfire"
date = "2024-09-17T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = [".NET","hangfire","background jobs"]
description = ".NET'te arka plan işlerini yönetme hakkında Task.Run(), Hosted Service ve Hangfire gibi çeşitli yöntemlerle ilgili bilgi edinin. Bu kapsamlı blog yazısı, avantajları, dezavantajları ve uygulama detaylarıyla birlikte Hangfire'a odaklanarak bu yöntemleri inceliyoruz."
showFullContent = false
readingTime = true
+++

.NET ekosisteminde bir uygulama geliştirirken, işler karmaşıklaştığında, bazı yöntemlerimizin birden fazla servise gitmesi, yanıtlarını değerlendirmesi ve bu sonuçları farklı servislere bildirmesi gerekebilir ve bu uzun zaman alabilir! Bu tür uzun süre çalışan yöntemleri bir endpoint'in arkasına yerleştirerek ve TCP bağlantımızı o HTTP isteğinin yanıtı için açık tutarak kaynakları boşa harcamak istemeyiz. Bu kullanımı on demand job olarak adlandırabiliriz çünkü bir istek yapıldığında çalışacaktır. Ayrıca, belirli günler veya haftanın belirli zamanlarında otomatik olarak çalışmasını isteyebiliriz, bunu bir recurring job olarak adlandırabiliriz; Bu tür durumlarda, işimizi uygulamanın çalıştığı main thread'den farklı bir thread başlatarak "background job" kullanabiliriz.

.NET'te arka plan işlerini yönetmenin birçok farklı yöntemi bulunmaktadır. Bu blog yazısında adım adım bu yöntemlerden bahsedeceğim, nasıl sorunları çözdüklerini ve bize hangi sorunları getirdiklerini anlatacağım ve background job'larıyla uğraşırken en çok sevdiğim paket olan Hangfire'da detaylı kullanım örnekleri sunacağım. Ayrıca, tüm kodlara repodan erişebilirsiniz:

[GitHub - berkslv/lecture-dotnet-background-jobs](https://github.com/berkslv/lecture-dotnet-background-jobs)

## Task.Run()

Background job'larına ihtiyacım olduğunda aklıma ilk gelen çözüm, Task.Run() yöntemiyle yeni bir thread oluşturmak ve bir methodu onun üzerinde çalıştırmak oldu. Birçok dış servise bağımlılığı olan ve tamamlanması 5 dakikaya kadar sürebilen bir yöntemim var ve bu yöntemi oluşturduğum bir controller aracılığıyla bir HTTP isteği üzerinden çağırıyordum, ancak bu isteğe yanıt vermek sorunluydu çünkü TCP bağlantısının 5 dakika boyunca açık kalması gerekiyordu, bu yüzden isteği çağırdığımda, işlem başarıyla başlatıldıysa, istemciye işlemin başarıyla başlatıldığını 200 durum koduyla bildirmem gerekiyor.

```cs
// TestService.cs  
  
public class TestService : ITestService  
{  
    private readonly ILogger<TestService> _logger;  
    public TestService(ILogger<TestService> logger)  
    {  
        _logger = logger;  
    }  
  
    public bool RunTests()  
    {  
        _logger.LogInformation($"{DateTime.Now} RunTests is started");  
  
        // ...  
        Thread.Sleep(5000);  
        // ...  
  
        _logger.LogInformation($"{DateTime.Now} RunTests is finished");  
        return true;  
    }  
}
```

```cs
// Program.cs  
  
// ...  
  
builder.Services.AddTransient<ITestService, TestService>();  
  
// ...
```

Task.Run() kullanmadan işlemi çağırmazsam, bu örnekte tarayıcıda /job endpoint'ine yönelik istek 3 saniye boyunca yükleniyor olacak.

```cs
// JobController.cs  
  
[ApiController]  
[Route("[controller]")]  
public class JobController : ControllerBase  
{  
    private readonly ITestService _testService;  
    public JobController(ITestService testService)  
    {  
        _testService = testService;  
    }  
  
    [HttpGet]  
    public IActionResult Get()  
    {  
        _testService.RunTests();  
  
        return Ok("Ok");  
    }  
}
```
Task.Run() ile aşağıdaki gibi kullandığımda, controller başarılı bir şekilde yanıt verecek ve RunTests yöntemim arka planda çalışmaya devam edecek.

```cs
[HttpGet]  
public IActionResult Get()  
{  
    Task.Run(() => {  
        _testService.RunTests();  
    });  
  
    return Ok("Ok");  
}
```

### Artılar

- İsteğe bağlı olarak arka planda bir işlem çalıştırabiliriz.
- Ek bir paket gerektirmez.

### Eksiler

- Mevcut durumda recurring job desteği bulunmamaktadır, özel bir sistem geliştirilmesi gerekmektedir.
- Dependency Injection kullanıldığında, enjekte edilen interface'ler main thread üzerinde kalacağından, gereken interface'ü Service scope aracılığıyla yeniden oluşturmamız gerekebilir.
- Yöntem çalışırken bir hata oluşursa ne olur?

## Hosted Service

Önceki örneğimizde uygulayamadığımız yinelenen işleri yönetmek için kendi sistemimizi geliştirmemiz gerekiyordu, ancak Hosted servis ile bu yönetimi kendimiz geliştirmemize gerek kalmaz, bunun yerine Program.cs dosyasında `AddHostedService` yöntemimizi aşağıdaki gibi çağırırız ve TestService sınıfımızı BackgroundService sınıfından türetiriz. Bu örnekte, RunTests yöntemimiz her 10 saniyede bir çalışacaktır. Bu zaman aralığı, BackgroundService abstract sınıfından miras alınan ExecuteAsync yönteminden ayarlanır.

```cs
// Program.cs  
  
// ...  
  
builder.Services.AddHostedService<TestService>();  
  
// ...
```

```cs
// TestService.cs  
  
  
public class TestService : BackgroundService, ITestService  
{  
    private readonly ILogger<TestService> _logger;  
    public TestService(ILogger<TestService> logger)  
    {  
        _logger = logger;  
    }  
  
    public bool RunTests(TestType testType)  
    {  
        var type = Enum.GetName(typeof(TestType), testType);  
  
        _logger.LogInformation($"{DateTime.Now} {type} RunTests is started");  
  
        // ...  
        Thread.Sleep(5000);  
        // ...  
  
        _logger.LogInformation($"{DateTime.Now} {type} RunTests is finished");  
          
        return true;  
    }  
  
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)  
    {  
        var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));  
        while (await timer.WaitForNextTickAsync(stoppingToken))  
        {  
            RunTests(TestType.Recurring);  
        }  
    }  
}
```

Ancak, yöntemimizi on demand olarak çalıştırmak istiyorsak, Task.Run() yönteminin yardımıyla yeni bir thread üzerinden çalışırız, bu nedenle JobController.cs'de herhangi bir değişiklik yapmamıza gerek yoktur.

### Artılar

- Recurring job yönetimi sağlar
- Ek paket kurmaya gerek yoktur

### Eksiler

- Talep üzerine çalışma için bir sistem bulunmamaktadır.
- Yöntem çalışırken bir hata alınırsa ne olur?

## Hangfire

Hangfire, job'ımızı tek bir sistem aracılığıyla talep üzerine ve recurring job'ları yönetmeyi çok daha kolay hale getirir. Diğer iki yöntemde bulunmayan job storage sistemi sayesinde, uygulama o anda çalışmıyor olsa bile cron job ile süresi gelmişse ilgili job'ı otomatik olarak çalıştırır. Belirli job'ları çalıştırabilir ve job oluşturulurken sağlanan id bilgileri ile o job'ı silme yeteneğine sahip oluruz. Ayrıca, /hangfire adresindeki bir dashboard üzerinden şu anda çalışan job'larımızı izleyebiliriz.

<img src="/img/background-jobs-and-hangife-in-net/hangfire-dashboard.webp" alt="Hangfire dashboard" loading="lazy" />
<p class="image-sub-title">Hangfire dashboard</p>

Hangfire resmi olarak Sql Server veritabanını destekler, ancak açık kaynaklı bir uzantı ile Sqlite ve Postgresql gibi sık tercih edilen veritabanları da kullanılabilir. Ayrıca, Hangfire, ücretli sürümüyle Redis veritabanı desteği ve batch job'larının çalıştırılması gibi enterprise ihtiyaçları da karşılar.

[Hangfire – Background Jobs for .NET and .NET Core](https://www.hangfire.io/extensions.html)

Bu kısa Hangfire girişten sonra, Hangfire'ı uygulamamızda nasıl kullanabileceğimiz ve yeteneklerinden kısaca bahsedelim. Örneğimizde job storage olarak Postgresql kullanacağız, ancak yukarıdaki link üzerinden istediğiniz veritabanını seçebilirsiniz. Uygulamamıza aşağıdaki paketleri yükledikten ve Docker ile bir Postgre SQL veritabanı kurduktan sonra, kodlarımıza geçelim.

```bash
dotnet add package Hangfire  
dotnet add package Hangfire.Core  
dotnet add package Hangfire.PostgreSql   
dotnet add package TimeZoneConverter  
  
docker run -d --name postgres_db -e POSTGRES_USER="root" -e POSTGRES_PASSWORD="1234" -e POSTGRES_DB="postgres" -v postgres_data:/var/lib/postgresql/data -p 5432:5432 postgres
```

İlk olarak, appsettings.json dosyasında Postgresql için connection string bilgilerini aşağıdaki gibi sağlıyoruz.

```json
"ConnectionStrings": {  
  "HangfireConnection": "Host=localhost;Port=5432;Password=1234;Username=root;Database=postgres;Pooling=true;Integrated Security=true;"  
}
```

Program.cs'de ilgili yapılandırmaları aşağıdaki gibi yapıyoruz.

TZConvert.GetTimeZoneInfo yöntemiyle gerekli zaman dilimi bilgisini işletim sisteminden alırsınız. Bu kod satırı, local makinenizin, frontend uygulamanızın ve cloud makinenizin farklı zaman dilimlerine sahip olabileceği için gereklidir.


```cs
var builder = WebApplication.CreateBuilder(args);  
  
// ...  
  
builder.Services.AddHangfire(config => {  
    config  
        .UseSimpleAssemblyNameTypeSerializer()  
        .UseRecommendedSerializerSettings()  
        .UsePostgreSqlStorage(builder.Configuration.GetConnectionString("HangfireConnection"));  
  
    var cronEveryMinute = "*/1 * * * *";  
    var recurringJobOptions = new RecurringJobOptions  
    {  
        TimeZone = TZConvert.GetTimeZoneInfo("Etc/GMT+3")  
    };  
    RecurringJob.AddOrUpdate<ITestService>("id-run-and-wait", x => x.RunTests(Guid.NewGuid(), TestType.Recurring, CancellationToken.None), cronEveryMinute, recurringJobOptions);  
});  
  
builder.Services.AddHangfireServer();  
  
var app = builder.Build();  
  
// ...  
  
app.UseHangfireDashboard();  
app.MapHangfireDashboard();  
  
app.Run();
```

To showcase Hangfire’s capabilities, we add a few more endpoints to our controller class.

**/run,** we can start a job and that method returns us a job id

**/stop,** we can stop the job related to the job id given to us by Hangfire.

**/continue,** if many different jobs are to be run but they are dependent on each other, another job can be run after the parent job is finished with the given job id.

**/reschedule,** the job’s working intervals can be dynamically adjusted by cron or TimeSpan.

**/deschedule,** recurring jobs can be deleted by their unique id.

**/trigger,** we can manually trigger a recurring job.



Hangfire'nin yeteneklerini sergilemek için, controller sınıfımıza birkaç ek endpoint ekliyoruz.

**/run,** bir job başlatabilir ve bu yöntem bize job'ın id bilgisini döndürür.

**/stop,** bize Hangfire tarafından verilen job id ile ilişkili job sürecini durdurabiliriz.

**/continue,** birçok farklı job'ın çalıştırılması gerekiyorsa, ama bunlar birbirlerine bağımlıysa, verilen job id ile ana job tamamlandıktan sonra başka bir iş çalıştırılabilir.

**/reschedule,** job'un çalışma aralıkları cron veya TimeSpan ile dinamik olarak ayarlanabilir.

**/deschedule,** recurring job'lar, job id bilgileriyle silinebilir.

**/trigger,** recurring bir job'ları manuel olarak tetikleyebiliriz.

```cs
// JobController.cs  
  
  
[ApiController]  
[Route("[controller]")]  
public class JobController : ControllerBase  
{  
    [HttpGet("/run")]  
    public IActionResult Run()  
    {  
        var jobId = BackgroundJob.Enqueue<ITestService>(x => x.RunTests(Guid.NewGuid(), TestType.OnDemand, CancellationToken.None));  
  
        return Ok(jobId);  
    }  
  
    [HttpGet("/stop")]  
    public IActionResult Stop(string jobId)  
    {  
        BackgroundJob.Delete(jobId);  
  
        return Ok("Stopped");  
    }  
  
    [HttpGet("/continue")]  
    public IActionResult Continue(string jobId)  
    {  
        BackgroundJob.ContinueJobWith<ITestService>(jobId, x => x.RunTests(Guid.NewGuid(), TestType.OnDemand, CancellationToken.None));  
  
        return Ok("Continued");  
    }  
  
    [HttpGet("/reschedule")]  
    public IActionResult Reschedule(string cron)  
    {  
        var recurringJobOptions = new RecurringJobOptions  
        {  
            TimeZone = TZConvert.GetTimeZoneInfo("Etc/GMT+3")  
        };  
        RecurringJob.AddOrUpdate<ITestService>("id-run-and-wait", x => x.RunTests(Guid.NewGuid(), TestType.Recurring, CancellationToken.None), cron, recurringJobOptions);  
        return Ok("Rescheduled");  
    }  
  
    [HttpGet("/deschedule")]  
    public IActionResult Deschedule(string id)  
    {  
        if (String.IsNullOrEmpty(id))  
        {  
            id = "id-run-and-wait";  
        }  
  
        RecurringJob.RemoveIfExists(id);  
        return Ok("Descheduled");  
    }  
  
    [HttpGet("/trigger")]  
    public IActionResult Trigger(string id)  
    {  
        if (String.IsNullOrEmpty(id))  
        {  
            id = "id-run-and-wait";  
        }  
  
        RecurringJob.TriggerJob(id);  
        return Ok("Triggered");  
    }  
}
```

Finally, error management, which is not in our toolkit previously with Task.Run and Hosted service but with Hangfire if an error occurs while running a method, Hangfire runs that method 10 more times with the same parameters at certain time intervals. As an example, we add a method called ThrowRandomly to our TestService class. With this method, we simply add a system that will throw an exception from the method that works with probability 1/2, but Hangfire will try to get successful results by re-running the methods that get errors for us. But errors that catches successfully cannot trigger the retry system. Therefore in the end of catch block we throw again.

Son olarak, önceki Task.Run() ve Hosted servis ile sahip olmadığımız hata yönetimi sayesinde Hangfire ile bir yöntem çalışırken bir hata oluşursa, Hangfire belirli zaman aralıklarında aynı parametrelerle bu yöntemi 10 kez daha çalıştırır. Bir örnek olarak, TestService sınıfımıza ThrowRandomly adında bir method ekliyoruz. Bu method ile, 1/2 olasılıkla gerçekleşen bir exception fırlatan yapı oluşturuyoruz, ancak Hangfire, bizim için hata alan methodları tekrar çalıştırarak başarılı sonuçlar elde etmeye çalışır. Ancak başarılı bir şekilde catch'lenen exception'lar, yeniden deneme sistemini tetiklemez. Bu nedenle catch bloğunun sonunda tekrar bir exception fırlatıyoruz.

```cs
// TestService.cs  
  
public class TestService : ITestService  
{  
    private readonly ILogger<TestService> _logger;  
    public TestService(ILogger<TestService> logger)  
    {  
        _logger = logger;  
    }  
  
    public bool RunTests(Guid id, TestType testType, CancellationToken cancellationToken)  
    {  
        var type = Enum.GetName(typeof(TestType), testType);  
  
        try  
        {  
            _logger.LogInformation($"{DateTime.Now} {type} RunTests is started. Id: {id}");  
  
            cancellationToken.ThrowIfCancellationRequested();  
            // ...  
            Thread.Sleep(5000);  
            ThrowRandomly();  
            // ...  
  
            _logger.LogInformation($"{DateTime.Now} {type} RunTests is finished. Id: {id}");  
            return true;    
        }  
        catch (OperationCanceledException exception)  
        {  
            _logger.LogError($"{DateTime.Now} {type} RunTests is failed. Exception: {exception.Message} Id: {id}");  
            throw;  
        }  
        catch(Exception exception)  
        {  
            _logger.LogError($"{DateTime.Now} {type} RunTests is failed. Exception: {exception.Message} Id: {id}");  
            throw;  
        }  
    }  
  
    private void ThrowRandomly()   
    {  
        var random = new Random();  
        var number = random.Next(1, 3);  
  
        if (number == 2)  
        {  
            throw new Exception("Error is throwed!");  
        }  
    }  
}
```

Ayrıca, Hangfire ayrı servis üzerinde çalışır, bu ihtiyaçlarınıza bağlı olarak iyi veya kötü olabilir. Ölçeklendirme gerektiğinde uygulama ve Hangfire sunucularını ayırabilir ve bunları farklı makinelerde çalıştırabiliriz.

### Artılar

- Güçlü bir soyutlama ile talep üzerine ve yinelenen işleri birlikte yönetebilir.
- Cron iş zamanlamasını dinamik olarak ayarlayabiliriz ve zamanlaması çok hassastır.
- Çalışan ve cron job'larımızı Dashboard ile izleyebiliriz.
- Zorunlu interface uygulaması veya başka özel bir uygulama yoktur, yalnızca Hangfire tarafından sağlanan yöntemleri kullanarak job'larımızı yönetebiliriz.

### Eksiler

- Harici depolama gereklidir, varsayılan olarak SQL Server ile çalışır.

---

## Sonuç

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme dünyasındaki en son güncellemeleri ve düşüncelerimi kaçırmayın. Bağlantıdan beni takip ederek [@berkslv](https://x.com/berkslv) ile bağlantıda ve iletişimde kalın.