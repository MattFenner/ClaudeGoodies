# Style Guide

## Principles

Guiding principles in order of importance:
- Readability
- Maintainability
- Simplicity
- Prefer errors at lint/compile time (rather than run time)
- Functional concepts
- Performance
- Immutability

Prefering errors at lint/compile time is high on the list after the obvious 3. This helps catch as many issues as possible when using AI assistants to help write the code.

Use functional and immutable concepts where they help without being dogmatic. Readability, maintainability and simplicity come first.

These are tools for working with Claude, not production-grade enterprise tooling. Don't over-engineer it.

## Rules

Follow these rules as guidance rather than dogma. If unsure, use your best judgment based on the guiding principles.

### Immutability / Side Effects

Prefer immutability at the boundaries of a function, i.e. avoid side effects that mutate state outside the function. Mutation scoped to local variables inside the function is fine.

Another way to put this is that the caller of a function should expect immutability when viewing the function as a black box.

It is OK to break this immutability rule if the alternative is much easier to read and maintain.

GOOD
```typescript
function addSpan(spans: Span[], extra: SpanExtra): Span[] {
    // We use let here because newSpan is scoped to this function,
    // and writing it in a purely immutable style would be less readable.
    let newSpan = basicSpan();
    switch (extra.type) {
        case 'foo':
            newSpan.foo = calculateFoo(extra);
            break;
        case 'bar':
            newSpan.bar = calculateBar(extra);
            break;
        default:
            newSpan.other = calculateOther(extra);
    }
    return [...spans, extra];
}
```

Prefer true immutability ONLY when it is just as (or more) readable as the alternative.

GOOD
```typescript
const foo = {
    foo: 'foo',
    bar: isGood ? 'good' : 'bad'
};
```

BAD
```typescript
let foo = {
    foo: 'foo'
};

if (isGood) {
    foo.bar = 'good';
} else {
    foo.bar = 'bad';
}
```

### Strong Types

Prefer strongly typed code. Provide types when they are not implicit, or when you want to add type safety.
We want to catch as many errors at compile time as possible rather than at runtime.

Use explicit types when constructing objects with object literals:

GOOD
```typescript
const foo: Foo = {
    /* ... */
};
```

BAD
```typescript
const foo: Foo = {
    /* ... */
};
```

Use explicit types for function parameters and return types:

GOOD
```typescript
function makeFoo(a: string, b: Bar): Foo {
    /* ... */
}
```

BAD
```typescript
function makeFoo(a, b) {
    /* ... */
}
```

Prefer defining types over complex inline type expressions.

GOOD
```typescript
type Foo = {
    model: string;
    events: Event[];
    isGood: boolean;
};

function foo(foo: Foo) {
    // ...
}
```

BAD
```typescript
function foo(foo: { model: string; events: Event[]; isGood: boolean }) {
    // ...
}
```

Simple expressions like `Foo[]` are ok.

This also applies when using types from third-party libraries. Prefer the library's named types rather than inline type expressions. Define named types ourselves if the library does not provide them.

### Prefer descriminated union types over large types with lots of optional fields

When there is more than one shape to a type, prefer union types over lots of optional fields. 
This helps code using the type to know when each field is relevant, and is easier to read and follow.

Always have a type field or similar to use as a discriminator. Then the consuming code can break logic into a section for each type.

BAD
```typescript
type Span = {
    prompt?: string
    model?: string
    toolCall?: ToolCall
}
```

GOOD
```typescript
type Span = PromptSpan | ModelSpan | ToolSpan;

type PromptSpan = {
    type: 'prompt',
    prompt: string
}

type ModelSpan = {
    type: 'model',
    model: string
}

type ToolSpan = {
    type: 'tool',
    toolCall: ToolCall
}
```

When working with the descriminated union types. If you need to handle all cases, prefer using switch with the 'exhaustiveness check'. This ensures we get errors at lint/compile time rather than at run time:

```typescript
    default: {
      const _exhaustiveCheck: never = shape;
      return _exhaustiveCheck;
    }
```

### if vs ? and ??

For conditionals that fit on a single line, prefer ternary expressions (`?:`) or `??`.

GOOD:
```typescript
const label = isFoo ? foo : bar;
```

GOOD:
```typescript
const label = foo ?? bar;
```

When multiple conditionals rely on the same condition, prefer to combine them or use an if statement:

BAD
```typescript
const label = isFoo ? fooLabel : barLabel;
const text = isFoo ? fooText : barText;
```

GOOD: Using if statements makes merging easier
```typescript
const label = isFoo ? fooLabel : barLabel;
const text = isFoo ? fooText : barText;
```
