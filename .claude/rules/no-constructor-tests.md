# No Constructor Tests

## Rule

NEVER write tests inside `describe('constructor')` blocks.

## Why

Tests named after constructors test **implementation details** rather than **behavior**:

- `expect(instance).toBeInstanceOf(Class)` - Tests that an object was created, not what it does
- `expect(MockedDependency).toHaveBeenCalled()` - Tests internal wiring, not observable behavior
- `expect(instance.property).toBe(value)` - Often tests storage rather than behavior

These tests are:
1. **Fragile** - They break when implementation changes even if behavior is preserved
2. **Useless** - If construction fails, behavioral tests fail anyway
3. **Misleading** - They give false confidence without testing actual functionality

## What to Do Instead

Test **behavior** through the public API:

```typescript
// BAD - Testing constructor
describe('constructor', () => {
  it('should instantiate with dependency', () => {
    const service = new Service(mockDep);
    expect(service).toBeInstanceOf(Service);
  });
});

// GOOD - Testing behavior
describe('doSomething', () => {
  it('should return expected result', () => {
    const service = new Service(mockDep);
    expect(service.doSomething()).toBe(expectedResult);
  });
});
```

## If Coverage Drops

If removing constructor tests drops coverage, one of two things is true:

1. **You're testing wrong** - The behavior should be tested through public methods
2. **Constructor has side-effects** - This is often a code smell; constructors should be simple

If either applies, discuss with the team before adding tests back.

## Invariant Checks

If a constructor validates inputs and throws errors, test this through the **behavior** it enables:

```typescript
// Acceptable - Testing validation as behavior
it('should reject empty phone number', () => {
  expect(() => new Credentials('', 'pin')).toThrow('Phone number is required');
});
```

Note: The focus is on what the class **does** (behavior), not **how** it's built.
