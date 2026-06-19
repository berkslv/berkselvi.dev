+++
title = "Events vs Commands in Software Architecture: A Complete .NET Guide"
date = "2026-06-22T14:55:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["software architecture", "events vs commands", "event-driven architecture", "cqrs", "dotnet", "mediatr", "microservices", "asynchronous messaging", "system design"]
description = "Demystify the critical differences between events and commands in software architecture. Learn how to decouple microservices using .NET code examples, MediatR, and asynchronous messaging patterns."
showFullContent = false
readingTime = true
cover = "img/events-vs-commands-in-software-architecture-a-complete-dotnet-guide/cover.webp"
+++

# Demystifying Events vs Commands in Software Architecture: A Complete .NET Guide

In the modern landscape of software engineering, shifting from monolithic systems to distributed microservices is a common evolutionary path. As systems grow in complexity, the way different components, modules, and services communicate becomes the critical factor in defining the system's resilience, scalability, and maintainability. If you are building robust, cloud-native applications, you inevitably encounter the need to decouple your components.

At the heart of this decoupling and communication strategy lie two fundamental messaging patterns: **Commands** and **Events**.

While they might seem similar at first glance—both are essentially messages containing data sent from one part of a system to another—their intent, handling, and architectural implications are vastly different. Misunderstanding the distinction between **events vs commands in software architecture** is one of the most common pitfalls when designing an **Event-Driven Architecture (EDA)** or implementing **Command Query Responsibility Segregation (CQRS)**.

In this comprehensive guide, we will explore the theoretical differences between events and commands, analyze when to use which, and walk through a practical storytelling implementation using **.NET** and C#.

## The Core Communication Problem in Distributed Systems

Before we dive into the definitions, let's understand the problem we are trying to solve.

Imagine an e-commerce application. A user clicks the "Checkout" button. In a traditional, tightly coupled monolithic architecture, the system might sequentially execute the following steps within a single synchronous flow:

1. Validate the cart.
2. Deduct inventory.
3. Process the payment.
4. Generate an invoice.
5. Send a confirmation email.

If the email server is down, the entire checkout process might fail, rolling back the payment and frustrating the user. This tight coupling creates brittle systems.

To solve this, architects introduce asynchronous messaging. Instead of calling methods directly, services send messages to each other through a mediator or a message broker (like RabbitMQ, Apache Kafka, or cloud-native solutions on AWS and Google Cloud). But how should these messages be structured? Should the checkout service tell the email service to *send an email*, or should it simply state that an *order was placed*?

This is where the distinction between Commands and Events becomes crucial.

## What is a Command?

A **Command** is an expression of *intent*. It is a request for the system to perform a specific action or change its state.

Think of a command as an imperative instruction. You are telling the system exactly what you want it to do. Because it is a request, a command can be rejected. The system might validate the command and decide that it cannot be executed due to business rules, permissions, or invalid data.

### Key Characteristics of a Command:

- **Imperative Naming:** Commands are named with verbs in the imperative mood (e.g., `PlaceOrderCommand`, `CreateUserCommand`, `ProcessPaymentCommand`).
- **Targeted:** A command is routed to exactly **one** handler. You do not broadcast a command to the entire system; you send it to the specific component responsible for that action.
- **Can Fail:** Because it is a request to change state, the receiving handler can (and often will) reject it if validation fails, returning an error or an exception to the sender.
- **High Coupling (Behavioral):** The sender of the command needs to know what action needs to happen, implying a tighter behavioral coupling than events, though the physical coupling might still be abstracted via a message bus.

## What is an Event?

An **Event**, on the other hand, is a statement of *fact*. It is an announcement that something has already happened in the past.

You cannot reject an event because you cannot change the past. If an event is published, the state change has already occurred. Components in the system listen to events to react and trigger their own subsequent processes.

### Key Characteristics of an Event:

- **Past-Tense Naming:** Events are named using verbs in the past tense (e.g., `OrderPlacedEvent`, `UserCreatedEvent`, `PaymentProcessedEvent`).
- **Broadcasted (Publish/Subscribe):** An event is published to an event bus or message broker. It can have **zero, one, or multiple** handlers. The publisher does not know or care who is listening.
- **Cannot Be Rejected:** The fact has occurred. Subscribers must process it. If a subscriber fails to process an event, it must handle its own retry logic; it cannot tell the publisher to "undo" the fact.
- **Loose Coupling:** The sender (publisher) is entirely decoupled from the receivers (subscribers). The publisher simply announces a state change, making it incredibly easy to add new functionality without touching existing code.

## Key Differences: Events vs Commands

To solidify the concepts, let's look at a side-by-side comparison.

| Feature | Command | Event |
| --- | --- | --- |
| **Definition** | A request to perform an action. | A notification that something happened. |
| **Naming Convention** | Imperative (e.g., `ShipOrder`) | Past Tense (e.g., `OrderShipped`) |
| **Routing / Handlers** | Exactly one handler (1:1). | Zero to many handlers (1:N). |
| **Direction** | Point-to-point. Sender targets a receiver. | Publish-Subscribe. Sender broadcasts. |
| **Failure Handling** | Can be rejected (validation error). | Cannot be rejected. Past facts are immutable. |
| **Sender's Knowledge** | Knows *what* needs to happen. | Does not know *who* cares about the event. |

## The .NET Implementation Story: Bringing it to Life

Let's tell a story using .NET to illustrate how these concepts flow together in a real-world application. We will use the highly popular **MediatR** library, which is the standard implementation for in-memory messaging and CQRS patterns in the .NET ecosystem.

Imagine we are building an Order Management microservice.

### Step 1: Defining the Command

The journey begins when a user submits their cart. The API controller receives the HTTP request and creates a command. Notice the imperative naming. We use C# records because messages should be immutable.

```csharp
using MediatR;

namespace ECommerce.Domain.Commands;

// The Command: A request that returns a strongly typed result
public record PlaceOrderCommand(
    Guid CustomerId, 
    List<CartItem> Items, 
    string ShippingAddress
) : IRequest<OrderResult>;

public record CartItem(Guid ProductId, int Quantity, decimal Price);

public record OrderResult(bool IsSuccess, string Message, Guid? OrderId = null);

```

### Step 2: Handling the Command

The command is routed to exactly *one* handler. This handler contains the core business logic. It validates the request, modifies the database state, and if successful, generates an Event.

```csharp
using MediatR;

namespace ECommerce.Application.Handlers.Commands;

public class PlaceOrderCommandHandler : IRequestHandler<PlaceOrderCommand, OrderResult>
{
    private readonly IOrderRepository _repository;
    private readonly IMediator _mediator;

    public PlaceOrderCommandHandler(IOrderRepository repository, IMediator mediator)
    {
        _repository = repository;
        _mediator = mediator;
    }

    public async Task<OrderResult> Handle(PlaceOrderCommand request, CancellationToken cancellationToken)
    {
        // 1. Validation (The command can be rejected!)
        if (request.Items == null || !request.Items.Any())
        {
            return new OrderResult(false, "Cart cannot be empty.");
        }

        // 2. State Change
        var totalAmount = request.Items.Sum(i => i.Price * i.Quantity);
        var order = new Order(Guid.NewGuid(), request.CustomerId, totalAmount, request.ShippingAddress);
        
        await _repository.SaveAsync(order);

        // 3. Announcing the Fact (The Event)
        var orderPlacedEvent = new OrderPlacedEvent(order.Id, request.CustomerId, totalAmount);
        
        // Notice we are Publishing the event, not Sending a command.
        await _mediator.Publish(orderPlacedEvent, cancellationToken);

        return new OrderResult(true, "Order successfully placed.", order.Id);
    }
}

```

### Step 3: Defining the Event

The state has changed. The order is securely stored in the database. Now, the system simply announces this fact to the rest of the application. Notice the past-tense naming.

```csharp
using MediatR;

namespace ECommerce.Domain.Events;

// The Event: A notification that something happened. Does not return a response.
public record OrderPlacedEvent(
    Guid OrderId, 
    Guid CustomerId, 
    decimal TotalAmount
) : INotification;

```

### Step 4: Reacting to the Event (Multiple Handlers)

This is where the magic of **Event-Driven Architecture** shines. Because we published an event, we can have multiple independent handlers react to it without modifying our core `PlaceOrderCommandHandler`.

Let's say the marketing team wants to send a "Thank You" email, and the logistics team needs to reserve the inventory. We simply create two separate event handlers.

**Handler A: The Email Service**

```csharp
using MediatR;

namespace ECommerce.Application.Handlers.Events;

public class SendOrderConfirmationEmailHandler : INotificationHandler<OrderPlacedEvent>
{
    private readonly IEmailService _emailService;

    public SendOrderConfirmationEmailHandler(IEmailService emailService)
    {
        _emailService = emailService;
    }

    public async Task Handle(OrderPlacedEvent notification, CancellationToken cancellationToken)
    {
        // React to the fact
        await _emailService.SendEmailAsync(
            notification.CustomerId, 
            $"Thank you for your order! Your total is ${notification.TotalAmount}."
        );
    }
}

```

**Handler B: The Inventory Service**

```csharp
using MediatR;

namespace ECommerce.Application.Handlers.Events;

public class ReserveInventoryHandler : INotificationHandler<OrderPlacedEvent>
{
    private readonly IInventoryService _inventoryService;

    public ReserveInventoryHandler(IInventoryService inventoryService)
    {
        _inventoryService = inventoryService;
    }

    public async Task Handle(OrderPlacedEvent notification, CancellationToken cancellationToken)
    {
        // React to the same fact independently
        await _inventoryService.ReserveItemsForOrderAsync(notification.OrderId);
    }
}

```

By structuring our .NET code this way, we have achieved a beautifully loosely coupled system. If tomorrow the analytics team wants to track sales, we don't touch the `PlaceOrderCommandHandler`. We just add a `TrackSalesAnalyticsHandler` that listens to the `OrderPlacedEvent`.

## Advanced Architectural Considerations

While the MediatR example perfectly illustrates the in-memory concepts, moving these patterns out of memory and into a distributed cloud environment introduces complex challenges. When utilizing cloud platforms like Google Cloud, AWS, or Azure to run microservices, messaging becomes distributed.

Here are three advanced patterns you must consider when scaling **Events vs Commands**:

### 1. The Outbox Pattern (Guaranteed Delivery)

In our C# example, we saved the order to the database and then published the event to MediatR. But what if the database save succeeds, but the application crashes exactly one millisecond before the `await _mediator.Publish()` line is executed?

The state changed, but the event was never fired. The customer's card was charged, but the warehouse never got the memo. This is a catastrophic failure in distributed systems known as the "Dual Write Problem."

To solve this, architects use the **Transactional Outbox Pattern**. Instead of publishing the event directly, the command handler writes the `OrderPlacedEvent` into an "Outbox" table in the *same database transaction* as the order itself. A separate background worker process (like a .NET BackgroundService) constantly reads this Outbox table and publishes the messages to your external broker (e.g., RabbitMQ or Google Cloud Pub/Sub). This guarantees at-least-once delivery of your events.

### 2. Idempotency (Handling Duplicate Events)

Because distributed messaging systems usually guarantee "at-least-once" delivery, your event handlers might receive the same `OrderPlacedEvent` twice.

If the `SendOrderConfirmationEmailHandler` is not designed carefully, the customer might receive two emails. Worse, if an event triggers a payment capture, they might be charged twice.

Event handlers must be **idempotent**. This means that applying the same event multiple times has the same effect as applying it once. In .NET, this is often implemented by maintaining a table of processed `EventId`s. Before a handler processes an event, it checks: *"Have I seen this Event ID before?"* If yes, it safely ignores it and returns a success response.

### 3. Event Sourcing vs Event-Driven Architecture

It is important not to confuse an Event-Driven Architecture (EDA) with **Event Sourcing**.

- **EDA** uses events to communicate between services (like our example above). State is still saved in a traditional database table (e.g., an `Orders` table with a `Status` column).
- **Event Sourcing** is a much more complex paradigm where the events *are* the database. Instead of saving the current state of an order, you save an append-only log of events: `OrderCreated`, `AddressUpdated`, `ItemAdded`, `OrderCheckedOut`. To figure out the current state, the system replays the events from the beginning of time. While powerful for audit trails, it introduces massive complexity and should be reserved for specific domains that require strict historical accuracy (like financial ledgers).

## When to Use Which?

The beauty of software design is choosing the right tool for the job. Here is a quick cheat sheet for when to deploy Commands vs Events in your .NET applications:

**Use a Command when:**
- You need the system to perform a specific action and you know exactly which component should handle it.
- You need to validate user input and potentially reject the request.
- You expect a result back (success, failure, or the ID of a newly created entity).


**Use an Event when:**
- A significant state change has occurred, and you want to notify other parts of the system.
- You want to allow multiple, disparate modules to react to a single action without creating tight coupling.
- You are integrating across microservice boundaries and want to ensure services remain autonomous.

## Summary

Mastering the difference between **events vs commands in software architecture** is a milestone in a developer's journey toward system design excellence. Commands drive the intent and guard the business rules of your application, ensuring state changes only happen when valid. Events act as the nervous system, broadcasting facts and enabling a highly scalable, loosely coupled ecosystem of microservices.

By leveraging powerful libraries like MediatR in .NET, and understanding the nuances of asynchronous communication, you can build systems that not only handle the complexities of today's business logic but are also resilient and flexible enough to adapt to the requirements of tomorrow. Remember to name your commands imperatively, treat your events as immutable facts of the past, and embrace the power of decoupling.


---

## Conclusion

Thanks for reading! 🎉 To not miss my research in software development, you can follow me at [@berkslv](https://x.com/berkslv).