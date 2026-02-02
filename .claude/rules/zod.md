---
paths:
  - "src/**/*.ts"
---
# Zod Schema Rules

## Critical Rules

1. **Always define explicit schemas** using Zod for all request and response types
2. **Do not use `z.any()` or `z.unknown()`** because all fields must be explicitly defined
3. **Do not use `passthrough()`** because we assume that all fields are known and defined
4. **All fields must have a description using `.describe()`** so that they appear in MCP documentation
5. **All schemas must have a description using `.describe()`** for documentation
6. **Model schemas for our business logic, not the raw API structure** i.e. use numbers and Dates instead of strings where appropriate
   - **Use `transform()` to convert Request fields to API formats** because validation happens on our business model before sending the request
   - **Use `preprocess()` to convert API response fields to desired types** because validation happens after receiving and pre-processing the response to our business model
7. **Reuse common schemas** by defining them in `common.request.ts` or `common.response.ts`
8. **Extract nested objects and arrays into separate schemas** for clarity and (sometimes) reusability
9. **Use request schemas in tool definitions** using `{ApiMethodName}RequestSchema.shape` to automatically generate MCP tool documentation
10. **Use `z.nativeEnum()` for enum fields** to ensure only valid values are accepted and define TypeScript enums for them (do not import enums from the SDK, copy them instead)
11. Follow the rules defined in this document for request schemas, response schemas, naming conventions, API integration, data flow, and testing

**THESE RULES ARE SACRED AND MUST BE FOLLOWED WITHOUT EXCEPTION.**
If you find a case where these rules do not make sense, discuss it with the user before making any changes. Present options.

## File Organization

Schemas are split into separate request and response files:

```
services/
├── common.request.ts          # Shared request schemas (e.g., AmountSchema with number->string)
├── common.response.ts         # Shared response schemas (e.g., AmountSchema, CandleSchema, ProductSchema)
├── schema.helpers.ts          # Transform helpers (stringToNumber, numberToString, isoToUnix)
│
├── OrdersService.ts
├── OrdersService.request.ts   # Request schemas for OrdersService
├── OrdersService.response.ts  # Response schemas for OrdersService
├── OrdersService.types.ts     # Enums for OrdersService
│
├── TechnicalIndicatorsService.ts
├── TechnicalIndicatorsService.request.ts  # Only request schemas (no response needed)
│
└── ... (similar pattern for other services)
```

### Import Patterns

```typescript
// In service files:
import { ListOrdersRequestSchema, type ListOrdersRequest } from './OrdersService.request';
import { ListOrdersResponseSchema, type ListOrdersResponse } from './OrdersService.response';
import { AmountSchema } from './common.request';  // For request sub-schemas
import { ProductSchema } from './common.response'; // For response sub-schemas
import { stringToNumber, numberToString } from './schema.helpers';
```

## Request Schemas

- Defined in `{ServiceName}.request.ts` files
- Service methods interacting with external APIs have a single parameter with a type that follows the pattern `{APIMethodName}Request`
- Each request type is defined using `z.output<typeof schema>` (output because transforms may change the type)
- The schema name matches the method's parameter type name suffixed with `Schema`, e.g. `GetProductCandlesRequestSchema`
- The schema is used by the MCP framework to validate incoming requests

## Response Schemas

- Defined in `{ServiceName}.response.ts` files
- Service methods return a type that follows the pattern `Promise<{APIMethodName}Response>`
- Each response type is defined using `z.output<typeof schema>`
- The schema name matches the method's return type name suffixed with `Schema`, e.g. `GetProductCandlesResponseSchema`
- Response schemas convert raw API data into a structured format
- Response schemas use `preprocess()` to transform raw API responses before validation

## Naming Conventions

### Top-Level Schemas (exported)
- Request schema: `{APIMethodName}RequestSchema` (in `.request.ts` file)
- Response schema: `{APIMethodName}ResponseSchema` (in `.response.ts` file)

### Sub-Schemas (internal to file)
- Use just `*Schema` suffix (e.g., `OrderConfigurationSchema`, `MarketMarketIocSchema`)
- No `Request` or `Response` in the name - the file context makes the direction clear
- Keep these as `const` (not exported) unless needed by other files

### Types
- Request type: `{APIMethodName}Request` (`z.output` of the request schema)
- Response type: `{APIMethodName}Response` (`z.output` of the response schema)
- ALL types use `z.output<typeof ...>` consistently

Use method names that match the service's public API methods

## Schema Helpers

Use helpers from `schema.helpers.ts` for consistent transforms:

```typescript
// Response transforms (string -> number)
stringToNumber      // For optional numeric fields
stringToNumberRequired  // For required numeric fields

// Request transforms (number -> string)
numberToString      // For required numeric fields
numberToStringOptional  // For optional numeric fields

// Timestamp transforms
isoToUnix           // For ISO 8601 -> Unix timestamp (required by some APIs)
```

## API Integration

- The Trade Republic API may return data in various formats (e.g., strings for numbers, ISO date strings)
- Zod schemas must transform these raw formats into appropriate types (e.g., `number`, `Date`)
- Use Zod's `preprocess()` to handle these transformations within the schema definitions

## Data Flow Example

```typescript
// DollarService.request.ts
import { z } from 'zod';
import { numberToString } from './schema.helpers';

export const GetDollarValueRequestSchema = z
  .object({
    valueInEuros: numberToString.describe('Value in Euros'),
  })
  .describe('Request to get dollar value from euros');

export type GetDollarValueRequest = z.output<typeof GetDollarValueRequestSchema>;
```

```typescript
// DollarService.response.ts
import { z } from 'zod';
import { stringToNumber } from './schema.helpers';

export const GetDollarValueResponseSchema = z
  .object({
    valueInDollars: stringToNumber.describe('Value in US Dollars'),
  })
  .describe('Response with dollar value');

export type GetDollarValueResponse = z.output<typeof GetDollarValueResponseSchema>;
```

```typescript
// DollarService.ts
import {
  GetDollarValueRequestSchema,
  type GetDollarValueRequest,
} from './DollarService.request';
import {
  GetDollarValueResponseSchema,
  type GetDollarValueResponse,
} from './DollarService.response';

export class DollarService {
  public async getDollarValue(
    request: GetDollarValueRequest
  ): Promise<GetDollarValueResponse> {
    const response = await this.client.request({
      url: 'dollar',
      queryParams: GetDollarValueRequestSchema.parse(request),
    });
    return GetDollarValueResponseSchema.parse(response.data);
  }
}
```

```typescript
// Usage example (will be done by MCP framework)
const dollarValue = await dollarService.getDollarValue({ valueInEuros: 100 });
```

The data flow is as follows:
1. getDollarValue is called with valueInEuros as a number
2. The request is validated by GetDollarValueRequestSchema and transformed to the API format
3. The raw API request is sent ({ valueInEuros: "100" })
4. The raw API response is received ({ valueInDollars: "110.50" })
5. The response is validated and transformed by GetDollarValueResponseSchema
6. The final result is returned with valueInDollars as a number

## Testing Schemas

- Schemas are indirectly tested through service method tests.
- Validate that API requests are correctly formed:
```typescript
expect(mockClient.request).toHaveBeenCalledWith({
  url: 'dollar',
  queryParams: { valueInEuros: '100' }, // Tests transformation from number to string
});
```
- Validate that service methods correctly return data in the expected format:
```typescript
expect(result).toEqual({
  valueInDollars: 110.5, // Tests transformation from string to number
});
```
