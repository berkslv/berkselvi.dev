+++
title = "API Gateway Alternatives from a .NET Developer's Perspective: YARP, Ocelot, Kong, APISIX, and KrakenD"
date = "2024-05-20T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["api gateway","yarp","ocelot","kong","apisix","krakend"]
description = "We explore API Gateway alternatives for .NET developers. Starting with .NET-based solutions like YARP and Ocelot, we evaluate OpenResty-based Kong and Apache APISIX as well as Go-based KrakenD. By detailing the features, performance, and use cases of each API Gateway, we aim to help you make the right choice."
showFullContent = false
readingTime = true
cover = "img/api-gateway-alternatives-from-a-net-developer-standpoint/cover.webp"
+++

We can use API Gateway services as an intermediary layer while exposing our services to the outside world in microservice architecture. In this article, we will briefly discuss what an API Gateway is and then talk about .NET, OpenResty, and Go-based API Gateway alternatives along with performance tests.

## What is an API Gateway?

An API Gateway provides an entry point to our systems as shown below, isolating them from the outside world. It solves common issues such as authorization, logging, and rate limiting with a single service that would otherwise need to be implemented repeatedly in each sub-service.

They can apply transformations to URLs, body information, and even protocols while routing requests. For example, an HTTP request can be transmitted to sub-services using the gRPC protocol for better performance. They can use flat files or databases to find the addresses of the services they will route incoming requests to.

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/what-is-api-gateway.png" alt="What is API Gateway" loading="lazy" />

<br/>

## What are the alternatives?

When evaluating API Gateway alternatives that we can use in our systems, we need to consider the required customization, performance, suitability for distributed architecture, and the ability to update route information via an admin panel. Unfortunately, there is no single gateway product that meets all these features and solves all our needs at once. We need to make these evaluations based on the specific needs of our system.

First, we will examine the .NET-based YARP and Ocelot API gateway products, which can be customized with C#, then talk about Kong and Apache APISIX, which use the OpenResty (nginx and lua) combination. Finally, we will look at KrakenD, which is frequently used in cloud-native environments and developed with Go. All these options can be used open source for free, but we can get enterprise support for Kong, Apache APISIX, and KrakenD if needed.

Before evaluating our options, I developed a very simple .NET API service that simulates database queries by waiting for 1 second. After putting this service behind the API Gateway, we will try to route requests and perform performance tests using the Apache Benchmark tool. To examine resource consumption more closely, we will run this application with other gateways using docker compose and receive responses from the service at service:8080.

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

As .NET developers, we can start by examining the YARP and Ocelot API Gateway products that can be developed with .NET technologies, which usually come to mind first. While these options can compete with other competitors in very simple scenarios in terms of performance, they cannot respond to complex needs such as minimal resource consumption and admin dashboard.

### YARP

Microsoft's YARP (Yet Another Reverse Proxy) stands out as a reverse proxy product and can also be used as an API Gateway. It caught my attention because it is used as an API Gateway in the eShop example microservice projects published by Microsoft on [GitHub](https://github.com/dotnet/eShop). YARP provides load balancing support and can route requests to services using algorithms like round robin by obtaining the addresses of these services through service discovery methods. Since it is .NET-based, processes such as authorization, rate limiting, distributed tracing, and logging that can be used in standard .NET API projects can also be easily implemented with familiar methods. Additionally, customizations can be made by adding middleware, and HTTP requests can be converted to gRPC requests.

To create a YARP project, after creating a .NET web API project, you include the Yarp.ReverseProxy package in the application and configure it to start routing requests.

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
      "weather_route": {
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

### Ocelot

Ocelot is an API Gateway solution that shares many common features with YARP. All features that can be used in .NET API projects can also be used here. It is developed as an independent open source project. Unlike YARP, it positions itself directly as an API Gateway product. However, it does not have gRPC support but offers features such as request aggregation, which can be preferred in backend-for-frontend structures.

To create an Ocelot application, similarly, a .NET API project is created and the configurations in the Program.cs file are set up to read service configurations from a separate ocelot.json file instead of appsettings.json. When defining routes with Ocelot, we need to repeatedly provide the service addresses, whereas with YARP, we only need to give the service information in one place and specify it in the router. Request aggregation can be done in the aggregates section after defining routes, and for more complex needs, custom aggregates can be defined using the IDefinedAggregator interface.

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

### YARP vs Ocelot

As you can see in the comparison table I prepared for YARP and Ocelot technologies, they share most features. Our preference between these two technologies can depend on the supported features, community support, and the structure of the configuration file.

| Feature | YARP | Ocelot |
| --- | --- | --- |
| Routing & Request mapping | Yes | Yes |
| Authn & Authz | Yes | Yes |
| Rate limiting | Yes | Yes |
| Load balancing | Yes | Yes |
| gRPC | Yes | No, old packages available |
| Request aggregation | No, custom development required | Yes, can be done with configuration |
| Distributed tracing | Yes | Yes |

On a Mac M1 with 8GB of RAM, running in a Docker environment with a very simple scenario where there is only one endpoint, I sent 10,000 requests with 50 concurrent channels using the Apache Benchmark tool for our performance tests. Ocelot returned an average response time of 1030 ms, and YARP returned an average response time of 1029 ms, yielding almost the same result. The memory consumption started at 20MB and rose to a maximum of 100MB when requests started coming in, and the CPU usage varied between 10% and 20%. These rates are almost the same for YARP and Ocelot. The commands I used for the tests are as follows:

```bash
# YARP
# 100 MB RAM | 10% - 20% CPU

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

Connection Times

 (ms)
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
# 100 MB RAM | 10% - 20% CPU

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

## OpenResty Based

Using nginx, which is known for its high performance, along with LuaJIT provides a flexible development environment with the Lua scripting language and JIT support, which supports hot reload without needing to restart. The Lua language, in many scenarios, offers performance as high as C due to its C API while providing higher-level programming with a more developer-friendly structure. It is possible to call Lua code from C code or vice versa. This results in a nice pair that can be used together. In fact, the C and Lua combination is a stack used in Cloudflare's own tools and is frequently used in networking applications.

We will talk about two OpenResty-based gateways that are frequently preferred in the industry: Kong, which has made a name for itself, and Apache APISIX, which has succeeded in distinguishing itself with a few nice features. We will continue with Go-based gateways afterwards.

### Kong

Kong stands out among API gateway solutions. In addition to containing all the features found in tools like Ocelot and YARP, it offers additional features with over 60 plugin supports. You can also develop your own plugins with Lua or other programming languages. The enterprise version provides extra features such as GraphQL support, request validation, body update, and secret manager.

Kong includes most of the features expected from an API gateway, such as authorization, logging, request transformation, and rate limiting. However, additional development is required for some features, such as the request aggregation pattern (combining the response from multiple services with a single request). While Lua, which can be used natively, works better than other alternatives, we can also develop using Go, JavaScript, or Python with IPC (Inter-Process Communication) support, although with lower performance. Moreover, thanks to WebAssembly support, we can create high-performance plugins with familiar languages like Go and Rust without needing IPC methods.

Unlike .NET-based gateways like Ocelot and YARP, Kong offers different deployment options. With "DB-less" mode, management can be done through configuration files. This mode is very useful in CI/CD-based deployment scenarios and prevents issues that may arise from state differences.

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/kong-config-deployment.png" alt="Kong config deployment" loading="lazy" />

<br/>

Kong can also be configured using the traditional method by using a database. In this method, databases such as PostgreSQL, Cassandra, Redis, InfluxDB, and Kafka can be used. Route and service information can be modified via the admin API. However, this scenario creates an additional dependency on the database and is more vulnerable to attacks since the control plane and data plane work on the same instance.

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/kong-traditional-deployment.png" alt="Kong traditional deployment" loading="lazy" />

<br/>

By applying the deployment scenario we can use with the Konnect service, we achieve a more secure structure by separating the data plane and control plane parts from each other. Konnect is offered as software as a service by Kong and does not require an additional database dependency for state management.

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/kong-konnect-deployment.png" alt="Kong konnect deployment" loading="lazy" />

<br/>

If we do not want to use a product managed by Kong and want the entire process to be done within our internal network, we can deploy the control plane and database to a different location in our system where they can communicate with each other using the method called Hybrid mode, and use the control plane to control the data plane.

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/kong-hybrid-deployment.png" alt="Kong hybrid deployment" loading="lazy" />

<br/>

For local development, you can work with PostgreSQL using the Docker Compose file provided by Kong and read from this file at the first run. If you are working in DB-less mode, you need to define all your routes in a configuration file. After defining the configuration as below, we start our gateway with the Docker Compose file.

```yaml
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

After a successful deployment with Kong, requests made to the specified route and service information are routed. If you deploy using the traditional or hybrid mode, you can manage your service and endpoint information via an admin interface.

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/kong-admin-gui.png" alt="Kong admin gui" loading="lazy" />

<br/>

### Apache APISIX

Apache APISIX is a gateway product developed on OpenResty like Kong. However, it stands out by offering features that are only available in the enterprise version of Kong as open source. These features include GraphQL, Canary release, and secret management.

APISIX provides higher performance compared to Kong in systems with a high number of routes. While Kong uses a traversal search algorithm among routes, APISIX performs searches with the radixtree algorithm and provides 140% higher performance when no plugin is used. Additionally, APISIX uses the etcd database to store configurations. This database can run cloud-native and is widely used in Kubernetes environments.

APISIX offers three different deployment scenarios:

1. **Traditional Method**: Control plane and data plane are deployed within the same instance dependent on the database.
2. **Decoupled Method**: Control plane and data plane are deployed with different instances, and only the control plane is dependent on the database.
3. **Standalone Method**: Works by reading from a configuration file without using a database.

In my local tests, I performed the deployment process using the traditional method with the etcd database through Docker Compose. I made minor changes to the Docker Compose file found in the APISIX Docker repository. We can make requests to the Admin API using admin keys. If I were to deploy using the standalone method, I would need to define routes in a yaml file.

If enterprise support is required, it can be obtained through [API7](http://api7.ai/), managed by the APISIX development team.

I will share the Docker Compose files and the code I used at the end of the blog post so you can quickly experience it on your own local environment.

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/kong-vs-apisix.png" alt="Kong vs APISIX" loading="lazy" />

<br/>

In performance tests, APISIX showed better performance than Kong with an average response time of 1025 milliseconds compared to Kong's 1032 milliseconds. In terms of consumption, Kong consumes around 280MB of memory upon startup, while APISIX uses around 100MB. Both gateways have a CPU consumption rate that varies between 5% and 10%.

```bash
# Kong
# 280MB RAM | 5% - 10% CPU
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
# 100MB RAM | 5% - 10% CPU
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

## Go Based alternatives

As a Go-based API Gateway alternative, we will discuss KrakenD, the most prominent option. However, Tyk or Traefik API Gateway can also be preferred as secondary alternatives with Go, but they are not included in this narrative as I could not try them since they are paid.

### KrakenD

KrakenD is an API gateway product developed with Go and has both community and enterprise versions. It runs on the Lura engine, which was donated to the Linux Foundation in 2021. Compared to other API gateway products, it offers a powerful aggregation system. You can perform all aggregation operations using only configuration files without writing any code.

Since KrakenD does not use a database, it does not create confusion when deciding on deployment options. We can perform our operations using only configuration files. However, it does not have an admin panel due to the lack of a database. The absence of a database eliminates additional error sources and provides easier scalability.

All configurations are managed through a configuration file that can be tracked via version control systems such as Git. It supports different file formats like JSON, YAML, and TOML. We can quickly create configurations using the interface on KrakenD's website. In a local development environment, you can quickly start and make requests to your service, as it only works through the configuration file. With the hot reload feature, you can update the configuration file with a short downtime. However, this method is not recommended for production environments; using GitOps methods to create a new release is advised. The enterprise version includes additional features such as OpenAPI importer and exporter, gzip compression, and response validation.

<img src="/img/api-gateway-alternatives-from-a-net-developer-standpoint/krakend-designer.png" alt="KrakenD designer" loading="lazy" />

<br/>

KrakenD has a much simpler Docker Compose content compared to Kong and APISIX, as it does not have any additional dependencies. You only need to provide the path to the configuration file as a volume. For example, I added the weather service to Docker Compose and quickly started the service by creating the krakend.json file. It gave very good results in the performance test.

```json
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

As KrakenD's website also states, it works faster than Kong and APISIX. In similar test results, Kong responds with an average response time of 1032 milliseconds, APISIX with 1025 milliseconds, while KrakenD provides the best performance with 1024 milliseconds. The CPU consumption remains stable between 4% and 6%, with a maximum memory consumption of 30MB. These results show that KrakenD consumes fewer resources while being faster than its competitors.

```yaml
# KrakenD
# 30MB RAM | 4% - 6% CPU
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

## Conclusion

To compare the five API gateway products we examined, I prepared a table as shown below. This table summarizes the content of the presentation and I would like to emphasize a few important points based on my research.

### **Kong and APISIX**

If different teams are sharing a single API gateway to expose their projects to the internet and a live-updatable admin interface is needed, Kong or APISIX can be preferred. Both gateways have strong features and stand out with their extensible structures. Additionally, with the admin interface, it is possible to manage configurations and make updates live.

### **KrakenD**

If the API gateway project is a shared responsibility among teams and developers can update the configuration file and run the pipeline, KrakenD can be a good choice in cases where high performance and low resource consumption are targeted. KrakenD, developed with Go, offers a powerful aggregation system and is easier to scale due to not using a database.

### **Ocelot and YARP**

If performance and resource consumption are not critical and a familiar technology is sufficient, we can continue with Ocelot or YARP, the .NET-based tools. These tools support similar features in different ways and are easy to integrate into the .NET ecosystem.

### **Other Criteria**

- **Deployment Methods**: The way the gateway is deployed, the structure and editability of the configuration files are important.
- **Community and Enterprise Support**: It is also important to consider how large the user base of the gateway is and whether there are sources of support.

Unfortunately, there is no single product that offers a perfect solution to all our needs. Therefore, we should evaluate our own needs and decide based on the features supported by the tool we choose. Choosing the right API gateway is a critical step for the success of your project and it is always best to choose the one that best meets your needs.

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



If you want to access the source code, you can find the whole project on my GitHub account:

[GitHub - berkslv/lecture-api-gateway-comparison](https://github.com/berkslv/lecture-api-gateway-comparison)

---

## Conclusion

Thank you for reading! 🎉 In order not to miss my research in the field of software development, you can follow me at [@berkslv](https://x.com/berkslv).