+++
draft = true
title = "Refactoring from an Anemic to a Rich Domain Model in .NET"
date = "2026-06-16T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["domain-driven design", "ddd", "csharp", "dotnet", "anemic domain model", "rich domain model", "entity framework core", "software architecture", "unit testing"]
description = "Learn how to cure the Anemic Domain Model anti-pattern in .NET. Discover practical steps to encapsulate business logic inside your C# entities, configure EF Core, and simplify your unit testing."
showFullContent = false
readingTime = true
cover = "img/refactoring-from-an-anemic-to-a-rich-domain-model-in-dotnet/cover.webp"
+++

If you have spent any significant amount of time building enterprise applications in .NET, you have likely encountered the concept of Domain-Driven Design (DDD). DDD promises a way to tackle software complexity by aligning your code with the real-world business domain it represents. However, one of the most common pitfalls developers fall into when adopting DDD—or even just basic Object-Oriented Programming (OOP)—is the creation of an **Anemic Domain Model**.

In many .NET architectures, you will see a familiar pattern: "entities" that are nothing more than bags of public getters and setters, accompanied by massive "service" classes that contain all the business rules, validation, and state manipulation logic. While this structure might feel comfortable, especially for those coming from a database-centric background, it actively works against the principles of object-oriented design and encapsulation.

In this comprehensive guide, we will explore exactly what an Anemic Domain Model is, why industry experts consider it an anti-pattern, and how you can refactor your C# applications toward a **Rich Domain Model**. We will look at practical code examples, discuss how to handle persistence with Entity Framework Core (EF Core), and see how moving logic into your entities makes unit testing a breeze.

## 1. The Trap of the Anemic Domain Model

### What is an Anemic Domain Model?

The term "Anemic Domain Model" was famously coined by Martin Fowler back in 2003. He described it as an anti-pattern where objects look like real domain entities (often named after nouns in the business space, like `Customer`, `Order`, or `Invoice`) but possess virtually no behavior. Instead, they are simply data containers—C# classes filled with public properties.

Let's look at a classic example of an anemic entity in C#:

```csharp
public class Order
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public DateTime OrderDate { get; set; }
    public OrderStatus Status { get; set; }
    public decimal TotalAmount { get; set; }
    public List<OrderItem> Items { get; set; } = new List<OrderItem>();
    public string ShippingAddress { get; set; }
}

public enum OrderStatus
{
    Pending,
    Paid,
    Shipped,
    Cancelled
}

```

At first glance, this might look completely normal. This is how the vast majority of Entity Framework tutorials teach you to build classes. However, this class is entirely devoid of behavior. It is a "dumb" object.

Because `Order` cannot protect its own state, any part of the application can modify it directly:

```csharp
var order = new Order();
// Wait, an order with no customer, no items, and it's already marked as shipped?
order.Status = OrderStatus.Shipped; 
order.TotalAmount = -500m; // Negative amount? Sure, why not!

```

### The "Service" Layer Bloat

Because the entity has no logic, the business rules must live somewhere else. This leads to the creation of "God classes" or massive service layers, often referred to as Transaction Scripts.

Here is what an `OrderService` looks like when dealing with an anemic model:

```csharp
public class OrderService
{
    public void AddItemToOrder(Guid orderId, OrderItem item)
    {
        var order = _repository.Get(orderId);
        
        if (order == null) throw new Exception("Order not found");
        
        if (order.Status == OrderStatus.Shipped || order.Status == OrderStatus.Cancelled)
        {
            throw new InvalidOperationException("Cannot modify a shipped or cancelled order.");
        }

        order.Items.Add(item);
        
        // Recalculate total
        order.TotalAmount = order.Items.Sum(i => i.Price * i.Quantity);
        
        _repository.Save(order);
    }
}

```

While this code works, it represents procedural programming disguised as object-oriented programming. The logic concerning what makes an `Order` valid is pulled out of the `Order` and dumped into the `OrderService`.

### The Costs of Anemia

When your domain model is anemic, you encounter several significant architectural costs:

1. **Lack of Encapsulation:** Any code anywhere can change the state of an entity. It is impossible to guarantee that an `Order` is in a valid state.
2. **Duplicated Logic:** If you need to recalculate the total amount of an order in a different use case (e.g., applying a discount), you will likely duplicate the recalculation logic in another service.
3. **Low Cohesion:** The data (`Order`) and the behavior that operates on that data (`OrderService`) are separated. You have to navigate through multiple layers to understand the lifecycle of an order.
4. 
**Fragility:** As the application grows, complex business logic becomes scattered across dozens of services, making it incredibly difficult to track down bugs or refactor the system.


## 2. The Cure: Introducing the Rich Domain Model

A **Rich Domain Model** flips this paradigm on its head. In a rich model, entities are intelligent objects. They encapsulate both their data (state) and the business rules (behavior) that govern how that data can be mutated.

A rich domain model is built on three core pillars:

1. **Always-Valid State (Invariants):** An entity should never exist in an invalid state. Its creation and mutation are strictly controlled.
2. **Encapsulation:** Properties cannot be arbitrarily changed from the outside. State mutations happen exclusively through clearly named methods.
3. **Behavior-Driven:** Instead of asking an object for its data and making decisions on its behalf, you tell the object what to do (the *Tell, Don't Ask* principle).

Let's begin the process of refactoring our anemic `Order` entity into a behavior-driven, rich domain entity in C#.

## 3. Step-by-Step Refactoring to a Rich Domain Model in C#

### Step 1: Lock Down the State (Private Setters)

The very first step to curing an anemic model is to stop the bleeding. We must prevent external code from arbitrarily changing properties. We achieve this by making all property setters `private` or `protected`.

```csharp
public class Order
{
    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }
    public DateTime OrderDate { get; private set; }
    public OrderStatus Status { get; private set; }
    public decimal TotalAmount { get; private set; }
    public string ShippingAddress { get; private set; }
    
    // We don't want external code adding to the list directly
    private readonly List<OrderItem> _items = new List<OrderItem>();
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();
}

```

Notice what happened here:

* The `set` accessors are now `private`. You can read the state of the order, but you cannot change it directly.
* The `Items` collection is now exposed as an `IReadOnlyCollection<OrderItem>`. The actual list is hidden behind a `private readonly` backing field. This prevents someone from calling `order.Items.Add(...)` from the outside.

### Step 2: Meaningful Constructors

If setters are private, how do we create an object? We use a parameterized constructor that requires all the necessary information to create a valid entity from the very start.

```csharp
public class Order
{
    // ... properties ...

    public Order(Guid id, Guid customerId, string shippingAddress)
    {
        if (id == Guid.Empty) throw new ArgumentException("Order ID cannot be empty.");
        if (customerId == Guid.Empty) throw new ArgumentException("Customer ID cannot be empty.");
        if (string.IsNullOrWhiteSpace(shippingAddress)) throw new ArgumentException("Shipping address is required.");

        Id = id;
        CustomerId = customerId;
        ShippingAddress = shippingAddress;
        
        // Initial defaults
        OrderDate = DateTime.UtcNow;
        Status = OrderStatus.Pending;
        TotalAmount = 0m;
    }
}

```

Now, it is literally impossible to create an `Order` without a Customer ID or a Shipping Address. The compiler enforces your business rules.

### Step 3: Introduce Domain Methods (Behavior)

Now that the state is protected, we need to introduce explicit, intention-revealing methods to allow state mutations. This is where we move the logic out of the `OrderService` and into the `Order` entity.

Let's implement the logic for adding an item and marking the order as shipped.

```csharp
public class Order
{
    // ... constructor and properties ...

    public void AddItem(Product product, int quantity)
    {
        if (Status != OrderStatus.Pending)
        {
            throw new InvalidOperationException("Can only add items to a pending order.");
        }

        if (quantity <= 0)
        {
            throw new ArgumentException("Quantity must be greater than zero.");
        }

        var existingItem = _items.SingleOrDefault(i => i.ProductId == product.Id);
        if (existingItem != null)
        {
            existingItem.IncreaseQuantity(quantity);
        }
        else
        {
            _items.Add(new OrderItem(product.Id, product.Price, quantity));
        }

        RecalculateTotal();
    }

    public void Ship()
    {
        if (Status != OrderStatus.Paid)
        {
            throw new InvalidOperationException("Cannot ship an order that has not been paid.");
        }

        if (!_items.Any())
        {
            throw new InvalidOperationException("Cannot ship an empty order.");
        }

        Status = OrderStatus.Shipped;
    }

    private void RecalculateTotal()
    {
        TotalAmount = _items.Sum(item => item.Price * item.Quantity);
    }
}

```

### The Resulting Application Layer

Let's look at what our `OrderService` (now often called a Command Handler or Application Service in Clean Architecture) looks like after this refactoring:

```csharp
public class OrderService
{
    public void AddItemToOrder(Guid orderId, Product product, int quantity)
    {
        var order = _repository.Get(orderId);
        if (order == null) throw new Exception("Order not found");

        // The logic is no longer here! We simply delegate to the domain.
        order.AddItem(product, quantity);
        
        _repository.Save(order);
    }
}

```

The Application Service is now thin and acts purely as an orchestrator. It fetches the entity from the database, invokes the behavior on the entity, and saves the new state back to the database. All the heavy lifting, business rules, and invariants are neatly encapsulated inside the `Order` class. This perfectly aligns with Domain-Driven Design principles.

## 4. Entity Framework Core: Mapping Rich Models to the Database

A major historical reason developers stuck with Anemic Domain Models was because Object-Relational Mappers (ORMs) required them. Early versions of Entity Framework demanded public setters, public parameterless constructors, and public collections to map tables to objects.

Thankfully, modern **Entity Framework Core (EF Core)** is incredibly powerful and actively supports Domain-Driven Design patterns. You can maintain a completely encapsulated Rich Domain Model without leaking persistence concerns into your domain.

Here are the key EF Core features you need to persist Rich Domain Models:

### 1. Parameterless Constructors for EF Core

When EF Core reads data from the database, it needs a way to instantiate your objects before setting their properties. You don't want a public parameterless constructor because that breaks encapsulation. Instead, you can provide a **private** parameterless constructor specifically for EF Core.

```csharp
public class Order
{
    // Public constructor for your application code
    public Order(Guid id, Guid customerId, string shippingAddress) { ... }

    // Private constructor for EF Core
    private Order() { } 
}

```

EF Core uses reflection to instantiate the object, so a private constructor works perfectly while keeping your API safe from other developers.

### 2. Mapping Private Backing Fields

EF Core is smart enough to find and bind to private backing fields automatically. If you have an `IReadOnlyCollection<OrderItem> Items` property and a `_items` backing field, EF Core will map the relationships directly to the `_items` field when materializing data from the database.

If your naming convention differs, you can configure it explicitly in the `OnModelCreating` method or your `IEntityTypeConfiguration`:

```csharp
public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.HasKey(o => o.Id);

        // Tell EF Core to use the private backing field for the collection
        builder.Metadata.FindNavigation(nameof(Order.Items))
               .SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}

```

### 3. Value Objects via Owned Entities

In a Rich Domain Model, you often want to group related properties into **Value Objects**. For example, instead of storing `Currency` and `Amount` separately on an entity, you can create a `Money` value object.

EF Core supports this through **Owned Types** (`OwnsOne`):

```csharp
// The Value Object
public class Money
{
    public string Currency { get; private set; }
    public decimal Amount { get; private set; }

    public Money(string currency, decimal amount)
    {
        Currency = currency;
        Amount = amount;
    }
    
    private Money() { } // For EF Core
}

// Inside your Entity Configuration:
builder.OwnsOne(o => o.Price, priceBuilder => 
{
    priceBuilder.Property(p => p.Currency).HasColumnName("PriceCurrency");
    priceBuilder.Property(p => p.Amount).HasColumnName("PriceAmount");
});

```

This allows you to maintain a highly expressive, object-oriented domain model while neatly flattening the data into a single SQL table.

## 5. The Magic of Unit Testing Rich Domain Models

One of the most profound benefits of moving logic into your entities is how much easier your unit testing becomes.

When your logic lives in a massive `OrderService`, writing a unit test is painful. You have to mock the `IOrderRepository`, mock the `IProductRepository`, mock the logging service, arrange the database state, and finally test the logic. The test setup is often larger than the test itself.

But when you use a Rich Domain Model, the business logic relies purely on the state of the entity. There are no external dependencies, no databases, and no APIs inside your `Order` class. It is pure C# code.

Testing the domain logic becomes incredibly straightforward and lightning-fast:

```csharp
public class OrderTests
{
    [Fact]
    public void AddItem_Should_ThrowException_When_OrderIsNotPending()
    {
        // Arrange
        var order = new Order(Guid.NewGuid(), Guid.NewGuid(), "123 Main St");
        
        // Use reflection or a test-specific setup to transition state to Shipped 
        // (Assuming we have a Pay() then Ship() method)
        order.Pay(); 
        order.Ship(); 

        var product = new Product(Guid.NewGuid(), "Laptop", 1000m);

        // Act & Assert
        var exception = Assert.Throws<InvalidOperationException>(() => 
            order.AddItem(product, 1));
            
        Assert.Equal("Can only add items to a pending order.", exception.Message);
    }

    [Fact]
    public void AddItem_Should_IncreaseTotalAmount()
    {
        // Arrange
        var order = new Order(Guid.NewGuid(), Guid.NewGuid(), "123 Main St");
        var product = new Product(Guid.NewGuid(), "Laptop", 1000m);

        // Act
        order.AddItem(product, 2);

        // Assert
        Assert.Equal(2000m, order.TotalAmount);
        Assert.Single(order.Items);
    }
}

```

Notice how there are **zero mocks** in this test? Because a Rich Domain Model isolates the business logic from infrastructure concerns, your domain layer achieves high testability. You can cover thousands of complex business permutations in milliseconds because you are only executing in-memory C# classes.

## Summary

Refactoring from an Anemic Domain Model to a Rich Domain Model requires a shift in mindset. You must move away from viewing your entities as mere reflections of database tables (data structures) and start viewing them as living business concepts with explicit behavior.

By applying principles like private setters, meaningful constructors, explicit domain methods, and adhering to the *Tell, Don't Ask* rule, you can centralize your business logic exactly where it belongs: inside the entity.

While transitioning requires a learning curve, the integration of EF Core's advanced mapping capabilities—like private backing fields and owned entities—means you no longer have to compromise your object-oriented design for the sake of your database. The long-term rewards are undeniable: a highly cohesive, deeply encapsulated, and easily testable codebase that actively resists bugs and technical debt.

---

## Conclusion

Thank you for reading! 🎉 In order not to miss my research in the field of software development, you can follow me at [@berkslv](https://x.com/berkslv).