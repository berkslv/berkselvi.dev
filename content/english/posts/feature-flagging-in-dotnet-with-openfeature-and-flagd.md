+++
title = "Feature Flagging in .NET with OpenFeature and flagd"
date = "2025-07-08T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["feature flag","openfeature","flagd",".NET","C#"]
description = "OpenFeature and flagd in your .NET applications helps you to implement robust, vendor-neutral feature flag management in your projects. Leave behind old environment variables, enable safe and dynamic releases, run A/B tests, and gain the ability to respond instantly."
showFullContent = false
readingTime = true
cover = "img/feature-flagging-in-dotnet-with-openfeature-and-flagd/cover.jpg"
+++

Feature flagging has become a cornerstone of modern software delivery. If you’re deploying frequently, testing features with specific users, want safer releases, or need targeted rollouts, feature flags should be in your toolbox. In this post, I’ll introduce OpenFeature, a vendor-neutral feature flag standard, and show you how to integrate it in a .NET project with **flagd** as your backend.

## What is Feature Flagging?

Feature flags (a.k.a. feature toggles) let you turn features on or off at runtime, without deploying new code. You can even segment by user, environment, or any attribute you want to serve a feature. This unlocks:

- Progressive delivery (gradual rollouts)
- A/B testing and experimentation
- Instant kill switches for broken features
- Reduced risk during deployments

But the core value? **Control**. Suddenly, you can ship code that’s dark-launched, only visible to your team, or tested by a handful of beta users. If a problem occurs, you don’t scramble for a rollback; you just flip a flag.

## The Old Way: Environment Variables

Before I dive into OpenFeature and flagd, I want to share a bit of real-world pain. Like many teams, I started with **environment variables** (`appsettings.json` configs) to manage features. Maybe you recognize this pattern:

```json

{
  "EnableNewDashboard": true
}

```

Then, inside your code:

```csharp

if (Configuration["EnableNewDashboard"] == "true")
{
    // Show the shiny new dashboard
}

```

It works—until it doesn’t. Here’s what usually goes wrong:

- **No targeting:** It’s all or nothing. Want to enable it just for internal users? Too bad.
- **No runtime change:** Changing an ENV variable often means redeploying or restarting.
- **Growth of config sprawl:** You end up with a dozen flags, all mixed in with unrelated config.
- **No auditing or history:** Who changed what, and when?
- **No standardization:** Every app/team does it differently.

As teams scale, this approach becomes brittle. Progressive delivery, canary releases, and A/B tests all need dynamic control. This is the gap where feature flag platforms—and standards like OpenFeature—shine.

## Why OpenFeature?

Most feature flag solutions (LaunchDarkly, Unleash, etc.) lock you into their SDKs and APIs. That’s where [OpenFeature](https://openfeature.dev/) comes in:

- **Vendor agnostic:** Switch providers without rewriting your code.
- **Standardized API:** Use the same approach across languages and stacks.
- **Extensible:** Add hooks for logging, telemetry, and more.
- **Cloud-native ready:** Built for modern architectures.

With OpenFeature, your app code only depends on the OpenFeature SDK—not on a specific vendor or backend. If you ever outgrow your current provider or want to migrate to a managed service, it’s as simple as swapping the provider.

## Why flagd?

[flagd](https://github.com/open-feature/flagd) is an open-source, lightweight feature flag backend. It’s designed to work out-of-the-box with OpenFeature and can serve flags from files, HTTP endpoints, or via gRPC to any application you need. But unfortunately there is no official UI to flagd right now, instead of the UI, flags managed with GitOps practices. flagd is ideal if you want a **self-hosted**, cloud-native flag backend with zero vendor lock-in.

## Real-life Example: From ENV to Feature Flags

Let’s say you’re running a .NET web API. You’re launching a new feature, but want to enable it only for internal users before rolling it out to everyone. Rather than creating an environment variable and binding that to some variable like **isInternalUser**, which needs re-deploying your code for every change, you want to change features in runtime, for specific segments you like. 

In a feature flag system that managed with the environment variable, if the Product Manager wants to A/B test a feature with 10% of the users, custom code and redeployment will be required.

**Feature flags** flip this model:

- Toggle the feature for specific users/groups instantly.
- Roll out to everyone when ready—no deployment needed.
- If something breaks, instantly turn it off.

This is how modern product teams iterate quickly, reduce risk, and deliver value continuously.

## Integrating OpenFeature and flagd in .NET

Let’s see how to wire this up.

### 1. Add NuGet Packages

```bash

dotnet add package OpenFeature
dotnet add package OpenFeature.Contrib.Providers.Flagd


```

### 2. Run flagd with docker-compose

```yaml

services:
  flagd:
    image: ghcr.io/open-feature/flagd:latest
    volumes:
      - ./flags:/etc/flagd
    command: [
      'start',
      '--uri',
      'file:/etc/flagd/flags.json',
      '--debug'
    ]
    ports:
      - '8013:8013'

```

Sample `flags.json`:

```json

{
  "$schema": "https://flagd.dev/schema/v0/flags.json",
  "flags": {
    "new-greeting": {
      "state": "ENABLED",
      "variants": {
        "on": true,
        "off": false
      },
      "defaultVariant": "off",
      "targeting": {
        "if": [
          {
            "$ref": "userAgentIsFirefox"
          },
          "on",
          null
        ]
      }
    }
  },
  "$evaluators": {
    "userAgentIsFirefox": {
      "in": [
        "firefox",
        {
          "var": [
            "userAgent"
          ]
        }
      ]
    }
  }
}

```

### 3. Configure OpenFeature in Your .NET App

```csharp

using OpenFeature.Contrib.Providers.Flagd;
using OpenFeature.Model;

var builder = WebApplication.CreateBuilder(args);

await OpenFeature.Api.Instance.SetProviderAsync(new FlagdProvider(new Uri("http://localhost:8013")));

var app = builder.Build();

app.MapGet("/greet", async context =>
{
    var client = OpenFeature.Api.Instance.GetClient();
    // Get User-Agent header
    var userAgent = context.Request.Headers["User-Agent"].FirstOrDefault() ?? "";
    var evalContext = EvaluationContext.Builder().Set("userAgent", userAgent).Build();
    
    var useNewGreeting = await client.GetBooleanValueAsync("new-greeting", false, evalContext);

    string greeting = useNewGreeting
        ? "Hey there! Welcome to the new greeting experience! 🎉"
        : "Hello, World!";

    await context.Response.WriteAsync(greeting);
});

app.Run();

```

### 4. Test

Change the flag in your `flags.json` file. Your .NET application will instantly detect the change. When we test the API endpoint, we’ll see results like the following:

```bash

$ curl http://localhost:5050/greet
Hello, World!

$ curl http://localhost:5050/greet -H 'User-Agent: firefox'
Hey there! Welcome to the new greeting experience! 🎉

```

If you want to send a direct request to the flagd backend and see the status of the flag, you can query it as shown below:

```bash

$ curl -X POST "http://localhost:8013/flagd.evaluation.v1.Service/ResolveBoolean" -d '{"flagKey":"new-greeting","context":{}}' -H "Content-Type: application/json"
{"value":false, "reason":"DEFAULT", "variant":"off", "metadata":{}}

$ curl -X POST "http://localhost:8013/flagd.evaluation.v1.Service/ResolveBoolean" -d '{"flagKey":"new-greeting","context":{"userAgent": "firefox"}}' -H "Content-Type: application/json"
{"value":true, "reason":"TARGETING_MATCH", "variant":"on", "metadata":{}}

```

## Summary

Feature flags reduce risk, enable faster delivery, and improve user targeting. OpenFeature gives you a standardized, future-proof API for flag management in .NET. flagd is a solid, open-source backend, great for self-hosting and Kubernetes.

If you’re still managing features with environment variables or configuration files, give OpenFeature and flagd a shot. Your future self will thank you, especially the next time you need to shut off a feature on Friday at 5pm.

If you want to access the source code, you can find the whole project on my GitHub account:

https://github.com/berkslv/lecture-net-openfeature

## Conclusion

Thank you for reading! 🎉 In order not to miss my research in the field of software development, you can follow me at [@berkslv](https://x.com/berkslv).