+++
title = "Real-Time Communication with SignalR: A Deep Dive"
date = "2024-11-29T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["signalr", "websocket", ".NET", "long polling"]
description = "Discover the power of real-time communication with SignalR! In this blog post, learn how SignalR simplifies adding live features to your .NET applications by abstracting complex protocols like WebSockets, Server-Sent Events, and Long Polling. From setting up SignalR in your project to advanced features like targeting specific clients and scaling with Redis, this guide has everything you need to create responsive and dynamic applications. Let's dive into the world of SignalR!"
showFullContent = false
readingTime = true
cover = "img/realtime-communication-with-signalr-a-deep-dive/cover.webp"
+++

In today's world where data is moving very quickly, real-time communication is a must for modern applications to give users smooth experiences. SignalR is an essential library when you want to create .NET application that communicates in real-time with others. When using SignalR, all communication and network requirements are abstracted by the library and you only need to call the method like in the RPC. By leveraging SignalR, you can easily create live dashboards, chat applications, or simple notification features that many web applications need. Let’s get started.

## Why SignalR?

Traditional models of client-server communication revolve around the request-response model, which is considered less efficient and limited for high interaction needs, and requires the client to making a request when data is needed. SignalR is designed to eliminate these challenges by keeping the same connection alive from the client to the server.

### Key Advantages of SignalR:

- **Real-Time Communication:** Clients receive the updates as soon as possible without necessarily making new requests.
- **Cross-Platform Support:** SignalR now has a full range of functionality independent of any platform and browsers.
- **Abstraction of Complex Protocols:** SignalR has the ability to use WebSocket, Server-Sent Events and Long Polling protocols, which provide a better relationship between the client and the server and allow them to choose the most efficient protocol. If the WebSocket protocol is not available by the client, SignalR tries to use other methods by selecting them according to its internal algorithm. (https://learn.microsoft.com/en-us/aspnet/signalr/overview/getting-started/introduction-to-signalr#transport-selection-process)
- **Integration with .NET apps:** Effective incorporation of .NET successfully guarantees the smooth through incorporation to modern .NET applications.

### Getting Started with SignalR

To implement SignalR in your .NET project, you can follow these steps:

### 1. SignalR NuGet Package

SignalR comes with .NET system libraries therefore you don’t need to install any additional packages. However if Visual Studio goes crazy you may want to try install the `Microsoft.AspNetCore.SignalR` package.

### 2. Create a Hub Class

The Hub acts as the central component that manages connections and sends messages to clients. You can compare this class to Controllers where you accept HTTP requests, except here we can accept requests or make a request directly to the client. Here’s a simple example, clients invoke `SendNotification(string content)` method to make a call to server and server send a message to all or specific clients with `Clients.All.SendAsync("ReceiveNotification", content)` method:

```csharp

using Microsoft.AspNetCore.SignalR;

public class NotificationsHub : Hub
{
    public async Task SendNotification(string content)
    {
        await Clients.All.SendAsync("ReceiveNotification", content);
    }
}

```

### 3. Configure the Hub in `Program.cs`

Just register SignalR services and map the hub endpoint as follows:

```csharp
var builder = WebApplication.CreateBuilder(args);

//...

builder.Services.AddSignalR();

var app = builder.Build();

//...

app.MapHub<NotificationsHub>("hubs/notification");

app.Run();

```

### 4. SignalR Client

SignalR supports various client platforms, including Javascript, .NET, and Java. If you don’t want to implement SignalR library in that platforms, you can simply use Postman to test your endpoint. But you must insert **0x1E** character at the end of the json. This is a requirement of the SignalR internal protocol. If you use Javascript library to implement SignalR you don’t need to deal with this kind of details.

```json

{
  "protocol": "json",
  "version": 1
}

```

After specifying the protocol, you can send and receive message from SignalR Hub as follows:

```json

{
    "arguments" : ["hello world"],
    "target" : "SendNotification",
    "type" : 1
}

```

Here is a quick demo:

<img src="/img/realtime-communication-with-signalr-a-deep-dive/postman-signalr-demo.gif" alt="SignalR and Postman demo" loading="lazy" />
<p class="image-sub-title">SignalR and Postman demo</p>

## Advanced Features

### 1. Strongly Typed Hubs

For better maintainability, use strongly typed hubs to specify interface of the hub:

```csharp

public interface INotificationsClient
{
    Task ReceiveNotification(string content);
}

public class NotificationsHub : Hub<INotificationsClient>
{
    public async Task SendNotification(string content)
    {
        await Clients.All.ReceiveNotification(content);
    }
}

```

### 2. Targeting Specific Clients

SignalR enables sending messages to specific users or groups. You can use this feature to send notification to only related ones, just add user to group using their userId or groupName, then send a notification to this userId:

```csharp

await Clients.User(userId).ReceiveNotification("Hello, User!");
await Clients.Group(groupName).ReceiveNotification("Hello, Group!");

```

If you want to target specific clients with SignalR using userId, you have to implement `IUserIdProvider` that coming from SignalR package like that:

```csharp

public class UserIdProvider : IUserIdProvider
{
    public string GetUserId(HubConnectionContext connection)
    {
        return connection.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }
}

```

```csharp

// Program.cs
services.AddSingleton<IUserIdProvider, CustomUserIdProvider>();

```

### 3. Using `IHubContext` to access the hub from outside the hub

You can send message to clients in outside of the hub as follows. Just Inject the IHubContext of type, and send a message to them. 

You can trigger the hub when some event is occured in your system with this greate feature. For example, when a long running batch job is completed you can notify your users about the result. 

Just a quick note, your code can be much cleaner if you abstract this IHubContext interface with another interface like `INotificationDispatcher`

```csharp

public class NotificationDispatcher(IHubContext<NotificationsHub> hubContext) : INotificationDispatcher
{
    public async Task SendNotification(string content)
    {
        await hubContext.Clients.All.SendAsync("ReceiveNotification", content);
    }

    public async Task SendNotificationToUser(string userId, string content)
    {
        await hubContext.Clients.User(userId).SendAsync("ReceiveNotification", content);
    }

    public async Task SendNotificationToGroup(string groupName, string content)
    {
        await hubContext.Clients.Group(groupName).SendAsync("ReceiveNotification", content);
    }
}

```

### 4. Securing SignalR

By default, SignalR hubs can be accessed by any client. To restrict access, use the classic `[Authorize]` attribute. Ensure that users authenticate using mechanisms like JWT, which SignalR leverages to identify connected users:

```csharp

[Authorize]
public class NotificationsHub : Hub
{
    // Hub methods
}

```

### 5. Scaling SignalR with Redis backplane

Scaling SignalR across multiple servers ensures reliable real-time communication for high-demand applications that running in multiple instances. A **Redis backplane** synchronizes messages between SignalR servers, ensuring clients connected to different servers receive messages seamlessly. Here is a quote from microsoft docs:

> The SignalR Redis backplane uses the pub/sub feature to forward messages to other servers. When a client makes a connection, the connection information is passed to the backplane. When a server wants to send a message to all clients, it sends to the backplane. The backplane knows all connected clients and which servers they're on. It sends the message to all clients via their respective servers.
> 

```bash

dotnet add package Microsoft.AspNetCore.SignalR.StackExchangeRedis

```

```csharp

// Program.cs

builder.Services.AddSignalR()
    .AddStackExchangeRedis("localhost:6379", options =>
    {
        options.Configuration.ChannelPrefix = "SignalR";
    });

```

If you don’t belive me, you can try to run your signalr app in more than one instance in the local testing enviroment with docker compose:

```yaml

services:
  signalr:
    image: your-app
    ports:
      - "5000:5000"
    depends_on:
      - redis
  redis:
    image: redis:latest
    ports:
      - "6379:6379"

```

```bash

docker-compose up --scale signalr=3

```

## SignalR Communication Models

SignalR abstracts multiple transport methods to ensure compatibility and performance:

### **WebSocket (**`webSockets`**)**:

WebSockets is the most efficient and preferred transport for real-time, bi-directional communication in SignalR. It establishes a persistent, full-duplex connection over a single TCP channel, allowing simultaneous message exchange between the client and server. This makes it ideal for applications that require low-latency, high-throughput interactions, such as live chats, collaborative editing tools, online gaming, and financial tickers.

WebSockets transitions to its own lightweight protocol (`ws://` or `wss://`) after an initial HTTP handshake, reducing the overhead associated with traditional HTTP-based communication. However, scaling WebSockets requires specialized infrastructure, such as WebSocket-aware load balancers and sticky sessions, to maintain connection affinity. SignalR simplifies these complexities, managing connection persistence, automatic reconnections, and fallback to alternative protocols when WebSockets are unavailable.

### **Server-Sent Events (**`serverSentEvents`**):**

SSE provides a lightweight, HTTP-based mechanism for one-way communication, where the server streams real-time updates to the client over a long-lived connection. It uses the standardized EventSource API and transmits data formatted as `text/event-stream`. This makes SSE simple to implement and efficient for use cases like live dashboards, notifications, and news feeds, where only server-to-client communication is needed.

Because it operates over standard HTTP, SSE integrates easily with existing HTTP infrastructure and does not require specialized proxies or load balancers, making it easier to scale compared to WebSockets. However, it lacks support for Internet Explorer and does not natively allow client-to-server communication, which must be handled through separate HTTP requests. SignalR automatically leverages SSE when WebSockets is unavailable, providing a seamless fallback for environments with restricted capabilities.

### **Long Polling (**`longPolling`**):**

Long Polling emulates real-time communication by continuously opening and closing HTTP connections. The client sends a request to the server and keeps it open until the server has data to send. Once the data is delivered, the client immediately establishes a new request. This approach minimizes latency between updates and creates the appearance of a push-based connection.

While Long Polling works with all browsers and is easy to implement, it incurs more overhead due to frequent HTTP requests and responses. It is less efficient compared to persistent connections like WebSockets or SSE, especially for high-frequency updates. In SignalR, Long Polling serves as a fallback when neither WebSockets nor SSE is supported, ensuring compatibility across legacy systems and restricted environments.

### **Forever Frame (**`foreverFrame`**):**

Forever Frame is a legacy protocol specific to older versions of Internet Explorer, designed to enable real-time, one-way communication. It operates by embedding a hidden iframe in the client’s browser that maintains an open connection to the server. The server continuously streams executable scripts to the iframe, which are executed by the client to process incoming data.

While functional for its time, Forever Frame has significant limitations, including high overhead and lack of bi-directional communication. Any client-to-server interaction requires separate standard HTTP requests, making it less efficient and cumbersome to implement. SignalR includes Forever Frame for backward compatibility but uses it only as a last-resort fallback in environments restricted to legacy Internet Explorer browsers.

### Websockets vs Server-Sent Events

WebSockets and Server-Sent Events (SSE) cater to different real-time communication needs. **WebSockets** enable full-duplex, low-latency communication, ideal for chat, gaming, and collaborative tools. In contrast, **SSE** provides lightweight, one-way updates, perfect for live dashboards or notifications.

WebSockets use a custom protocol (`ws://` or `wss://`) for efficient two-way messaging but require WebSocket-aware infrastructure for scaling. SSE operates over standard HTTP (`text/event-stream`), making it easier to scale with traditional HTTP tools, though it only supports server-to-client communication and lacks Internet Explorer support.

SignalR abstracts these differences, automatically prioritizing WebSockets for performance and falling back to SSE or other methods to ensure seamless real-time functionality across varied environments.

## Specifiying the protocol

SignalR allows you to explicitly specify the transport protocol to be used for real-time communication. By default, SignalR automatically selects the best available transport with its internal algorithm, but you can customize this behavior based on your application's needs. 

You can choose WebSockets for its efficiency and fall back to Long Polling when WebSockets are unavailable with that code in Program.cs:

```csharp

app.MapHub<NotificationsHub>("/hubs/notification", opt =>
{
    opt.Transports = HttpTransportType.WebSockets | HttpTransportType.LongPolling;
});

```

Or in the client side with JavaScript:

```js

let connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/notification", { 
	    transport: signalR.HttpTransportType.WebSockets 
		    | signalR.HttpTransportType.LongPolling })
    .build();

```

## Summary

SignalR makes adding real-time features to .NET applications simple and efficient. It abstracts complex networking protocols, letting you focus on building live dashboards, chat apps, or notifications without worrying about the underlying transport. With support for WebSockets, Server-Sent Events (SSE), and Long Polling, SignalR automatically picks the best protocol for your environment.

If you want to access the source code, you can find the whole project on my GitHub account:

[GitHub - berkslv/lecture-signalr-deep-dive](https://github.com/berkslv/lecture-signalr-deep-dive)

---

## Conclusion

Thank you for reading! 🎉 In order not to miss my research in the field of software development, you can follow me at [@berkslv](https://x.com/berkslv).