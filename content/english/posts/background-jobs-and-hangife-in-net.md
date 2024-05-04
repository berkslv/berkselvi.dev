+++
title = "Background jobs and Hangfire in .Net"
date = "2024-09-17T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = [".NET","hangfire","background jobs"]
description = "Learn about managing background jobs in .Net with various methods like Task.Run(), Hosted Service, and Hangfire. This comprehensive blog post explores their pros, cons, and implementation details, with a focus on Hangfire..."
showFullContent = false
readingTime = true
+++

When developing an application in the .Net ecosystem, when things get complicated, we may need some of our methods to go to multiple services, evaluate their responses, and report these results to different services and this takes long time! We do not want to waste resources by placing such long-running methods behind an endpoint and keeping our TCP connection open for the response from that HTTP request. We can call this usage on demand job because it will run when a request is made. We may also want it to run automatically at certain times of the day or week, without putting it behind an endpoint; in this case, we can call it a recurring job. In such cases, we use “background job” by starting our work on a different thread other than the main thread where the application runs.

There are many different methods of managing background jobs in .Net. This will be a blog post where I will talk about them step by step, how they solve problems and what problems they cause us, and give in-depth usage examples in Hangfire, which is the package I like the most when dealing with background jobs. You can also access all the codes from the repo:

[GitHub - berkslv/lecture-dotnet-background-jobs](https://github.com/berkslv/lecture-dotnet-background-jobs)

## Task.Run()

We can create a new thread and run a method on it with the Task.Run() method, which is the first solution that comes to my mind when I need a background job. I have a method that has dependencies on many external services that can take up to 5 minutes to complete, and I was calling this method with an HTTP request through a controller that I created, but answering this request was problematic because it is required a TCP connection to remain open for 5 minutes, so instead when I called the method, If started successfully, I had to notify the client that the process was started successfully with a 200 status code.

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

If I do not make the execution by calling with the Task.Run(), the request to my /job endpoint will be loading for 3 seconds in browser for this example.

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

If I use Task.Run instead as below, the controller will respond ok and my RunTests method will continue to run in the background.

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

### Pros

- We can run a process in the background on demand.
- Does not require an additional package.

### Cons

- It does not support recurring in its current state, a special system must be developed.
- When Dependency Injection is used, since the injected interfaces will remain on the main thread, we may need to re-generate the required interface through the Service scope.
- What happens if an error is throwed while running the Method?

## Hosted Service

We had to develop our own system to manage recurring jobs, which we could not implement in our previous example, but with the Hosted service, we do not need to develop this management ourselves, instead we call our `AddHostedService` method in Program.cs as follows and inherit our TestService class from the BackgroundService class. In this example, our RunTests method will run every 10 seconds. This time interval is set from the ExecuteAsync method inherited from BackgroundService abstract class.

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

However, if we want to run our method on demand, we work on a new thread with the help of the Task.Run() method, so we do not need to make any changes to JobController.cs.

### Pros

*   Provides recurring job management
*   No need to install additional packages

### Cons

*   It does not have a system for on demand operation.
*   What happens if an error is received while running the Method?

## Hangfire

Hangfire makes our job much easier to manage on demand and recurring jobs through a single system. With the Job Storage system, which is not available in the other two methods, if the application is not running at that moment but the cron job has expired, it automatically runs the relevant job. We can run specific jobs and delete that job with the ID information provided during job creation. Additionally, we can monitor currently running jobs via a dashboard at /hangfire.

<img src="/img/background-jobs-and-hangife-in-net/hangfire-dashboard.webp" alt="Hangfire dashboard" loading="lazy" />
<p class="image-sub-title">Hangfire dashboard</p>

Hangfire officially supports the Sql Server database, but with an open source extension, frequently preferred databases such as Sqlite and Postgresql can also be used. In addition, Hangfire, with its paid version, also meets enterprise needs such as Redis database support and running batch jobs.

[Hangfire – Background Jobs for .NET and .NET Core](https://www.hangfire.io/extensions.html)

After this brief introduction to Hangfire, let’s briefly talk about how we can use Hangfire in our application and its capabilities. In our example, we will use Postgresql as Job storage, but you can choose any database you want from the link above. After installing the following packages in our application and setting up a Postgre SQL database with docker, let’s move on to our code.

```bash
dotnet add package Hangfire  
dotnet add package Hangfire.Core  
dotnet add package Hangfire.PostgreSql   
dotnet add package TimeZoneConverter  
  
docker run -d --name postgres_db -e POSTGRES_USER="root" -e POSTGRES_PASSWORD="1234" -e POSTGRES_DB="postgres" -v postgres_data:/var/lib/postgresql/data -p 5432:5432 postgres
```

First, we provide the connection string information for Postgresql in appsettings.json as follows.

```json
"ConnectionStrings": {  
  "HangfireConnection": "Host=localhost;Port=5432;Password=1234;Username=root;Database=postgres;Pooling=true;Integrated Security=true;"  
}
```

We make the relevant configurations in Program.cs as follows.

With TZConvert.GetTimeZoneInfo method you get the neccessary time zone information from OS. This line of code is neccessary because your local machine, frontend application and Cloud machine may have different time zones.

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

Finally, error management, which is not in our toolkit previously with Task.Run() and Hosted service but with Hangfire if an error occurs while running a method, Hangfire runs that method 10 more times with the same parameters at certain time intervals. As an example, we add a method called ThrowRandomly to our TestService class. With this method, we simply add a system that will throw an exception from the method that works with probability 1/2, but Hangfire will try to get successful results by re-running the methods that get errors for us. But errors that catches successfully cannot trigger the retry system. Therefore in the end of catch block we throw again.

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

Also Hangfire runs on a seperate service, this can be good or bad depending on your needs. When you need scaling you may seperate the application and hangfire servers and place them to different machines.

### Pros

- Can manage on demand and recurring jobs together with a powerful abstraction
- We can adjust cron job timing dynamically and its timing is very precise.
- We can monitor our employee and cron jobs with Dashborad.
- There is no imposed interface implementation or any other special implementation, we can only manage our jobs by using the methods provided by Hangfire.

### Cons

- External storage is required, works with SQL Server by default.


---

## Conclusion

Thank you for reading 🎉 Don't miss out on the latest updates and insights in the world of software development. Follow me on [@berkslv](https://x.com/berkslv) to stay connected and join the conversation