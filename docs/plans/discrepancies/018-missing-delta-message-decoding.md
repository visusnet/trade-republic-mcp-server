# DISCREPANCY-018: Missing Delta Message Decoding

## Summary

Trade Republic WebSocket uses delta encoding (code `D`) for efficient real-time updates. The payload contains diff instructions, not JSON. Our implementation tries to JSON.parse() delta payloads directly, causing parse failures. All 4 community projects (pytr, Trade_Republic_Connector, TradeRepublicApi, trade-republic-api) implement delta decoding.

## Brainstormed Solution

Based on discussion, we will:

1. **Add `previousResponses: Map<number, string>`** to `WebSocketManager` to track the last successful JSON string response per subscription ID.

2. **Clean up stored responses:**
   - On `C` (complete) message: delete entry for that subscription ID
   - On `disconnect()`: clear the entire map

3. **Error handling:** Throw `WebSocketError` for malformed deltas (e.g., missing previous response, invalid number parsing).

4. **Parsing approach:** Match pytr's lenient parsing exactly:
   - No strict Zod validation for delta instructions
   - Process instructions, throw only on actual failures
   - Silently skip unknown instruction types (only handle `+`, `-`, `=`)

5. **URL decoding for `+` instructions:** Match pytr exactly:
   ```typescript
   decodeURIComponent(text.substring(1).replace(/\+/g, ' ')).trim()
   ```

## Delta Format

Instructions are tab-separated:
- `+text` → Insert URL-decoded text (remove leading `+`, replace `+` with space, URL-decode, trim)
- `-N` → Skip N characters from previous response
- `=N` → Copy N characters from previous response

Example:
```
Previous: {"foo":"bar","baz":123}
Delta:    =15\t+"qux":456}
Result:   {"foo":"bar","baz":"qux":456}
```

## Implementation Details

### File: `src/server/services/TradeRepublicApiService.websocket.ts`

#### 1. Add private field (after line 31):
```typescript
private previousResponses: Map<number, string> = new Map();
```

#### 2. Add `calculateDelta` method:
```typescript
private calculateDelta(subscriptionId: number, deltaPayload: string): string {
  const previousResponse = this.previousResponses.get(subscriptionId);
  if (previousResponse === undefined) {
    throw new WebSocketError(
      `No previous response for subscription ${subscriptionId}`
    );
  }

  let i = 0;
  const result: string[] = [];

  for (const diff of deltaPayload.split('\t')) {
    if (diff.length === 0) continue;

    const sign = diff[0];
    if (sign === '+') {
      // Insert URL-decoded text (match pytr: unquote_plus + strip)
      result.push(
        decodeURIComponent(diff.substring(1).replace(/\+/g, ' ')).trim()
      );
    } else if (sign === '-') {
      // Skip N characters
      i += parseInt(diff.substring(1), 10);
    } else if (sign === '=') {
      // Copy N characters from previous response
      const count = parseInt(diff.substring(1), 10);
      result.push(previousResponse.substring(i, i + count));
      i += count;
    }
    // Unknown signs are silently skipped (matches pytr)
  }

  return result.join('');
}
```

#### 3. Modify `parseMessage` method:

Change from directly parsing JSON to:
1. For `A` messages: parse JSON, store raw JSON string in `previousResponses`
2. For `D` messages: calculate delta, parse resulting JSON, store in `previousResponses`
3. For `C` messages: delete from `previousResponses`

```typescript
private parseMessage(messageStr: string): WebSocketMessage {
  const match = messageStr.match(/^(\d+)\s+([ADCE])\s+(.*)$/s);

  if (!match) {
    throw new WebSocketError(
      `Invalid message format: ${messageStr.substring(0, 50)}`
    );
  }

  const [, idStr, code, payloadStr] = match;
  const id = parseInt(idStr, 10);

  let payload: unknown;
  let jsonStr: string;

  if (code === MESSAGE_CODE.D) {
    // Delta message: decode against previous response
    jsonStr = this.calculateDelta(id, payloadStr);
  } else {
    jsonStr = payloadStr;
  }

  // Clean up on complete
  if (code === MESSAGE_CODE.C) {
    this.previousResponses.delete(id);
  }

  try {
    payload = JSON.parse(jsonStr);
  } catch {
    throw new WebSocketError(
      `Invalid JSON in message: ${jsonStr.substring(0, 50)}`
    );
  }

  // Store for future delta calculations (A and D messages)
  if (code === MESSAGE_CODE.A || code === MESSAGE_CODE.D) {
    this.previousResponses.set(id, jsonStr);
  }

  return {
    id,
    code: code as MessageCode,
    payload,
  };
}
```

#### 4. Modify `disconnect` method to clear previousResponses:
```typescript
public disconnect(): void {
  if (this.ws) {
    logger.api.info('Disconnecting WebSocket');
    this.ws.removeAllListeners();
    this.ws.close();
    this.ws = null;
  }
  this.previousResponses.clear();
  this.status = ConnectionStatus.DISCONNECTED;
}
```

## Test Cases

1. **Delta decoding with `=` (copy) instruction** - copies characters from previous response
2. **Delta decoding with `+` (insert) instruction** - inserts URL-decoded text
3. **Delta decoding with `-` (skip) instruction** - skips characters from previous response
4. **Delta decoding with mixed instructions** - combines all three instruction types
5. **Delta decoding with URL-encoded characters** - `%22` becomes `"`, `+` becomes space
6. **Delta message without previous response** - throws WebSocketError
7. **Unknown instruction types are skipped** - silently ignores, doesn't throw
8. **Complete message cleans up previousResponses** - entry deleted on `C` code
9. **Disconnect clears all previousResponses** - map cleared on disconnect
10. **Answer message stores response for future deltas** - `A` code stores JSON string

---

## Resolution Implementation

For each discrepancy found (one after another), spawn a sub agent to fix it by following these steps strictly (they are SACRED):
1. Write at least one test that tests the correct (atomic) behavior for a given discrepancy.
   <reasoning>These tests will initially fail because the implementation is currently incorrect but they will succeed once the implementation is fixed.</reasoning>
   If the implementation is currently wrong, there should already be tests for the incorrect behavior. Keep these tests for now.
   <reasoning>Keeping the tests for the incorrect behavior ensures that we can verify that the incorrect behavior is indeed fixed once we modify the implementation. These tests should fail after the fix, confirming the correction.</reasoning>
2. Modify the implementation to make the new test pass.
   -> new test(s) for correct behavior pass
   -> existing test(s) for incorrect behavior fail
3. If the implementation was wrong, there will be tests that verified the incorrect behavior. You can either:
    - remove them if new tests sufficiently cover the correct behavior and fit the overall test suite
      <example>
      Let's assume an old test for the incorrect behavior was called "returns price for valid asset id" and the new test for the correct behavior is called "returns price for valid asset id (after fix)". If the new test sufficiently covers the correct behavior and fits well within the overall test suite, we can remove the old test and remove "(after fix)" from the new test name.
      </example>
      <example>
      Let's assume an old test for the incorrect behavior was called "throws error for multiple asset ids" because the implementation incorrectly allowed multiple asset ids. The new test for the correct behavior is called "throws error for multiple asset ids (after fix)". If the new test sufficiently covers the correct behavior and fits well within the overall test suite, we can remove the old test and remove "(after fix)" from the new test name.
      </example>
    - or modify them to verify the correct behavior instead
      <example>
      Let's assume an old test that tests features adjacent to the incorrect behavior was called "calculates position size" and it has an expectation that checks for an incorrect value due to the wrong implementation. The new test for the correct behavior is called "returns risk metrics" which only focuses on the correct behavior. In this case, we can modify the old test to align with the correct behavior by updating its expectations to match the correct implementation. These tests inherintly verify different aspects of the functionality but can be adjusted to ensure they all validate the correct behavior. Keep them all (without any "(after fix)" in the name).
      </example>
    - or merge them with new tests if that makes sense
      <example>
      Let's assume an old test for the incorrect behavior was called "places market order" and the new test for the correct behavior is called "places market order with validation". If the new test is basically the same as the old test but with additional validation steps, we can merge them into a single test called "places market order" that includes all necessary checks. This way, we retain the original intent while ensuring the test reflects the correct behavior.
      </example>
4. Refactor the code to improve it while ensuring all tests still pass.
    - think about a better structure, naming, separation of concerns, modularity, reusability, readability, maintainability, performance, etc. and make the necessary changes
    - apply any necessary code quality improvements
    - ensure 100% test coverage in all categories
    - ensure linting and formatting compliance
    - ensure knip reports no unused code
5. Commit the changes with a clear and concise commit message following the Conventional Commits specification. Push the changes.
6. Stop the sub agent.
7. Mark the discrepancy as resolved in docs/discrepancies.md.

Repeat (with the next discrepancy and a freshly spawned sub agent) until the implementation is verified to be correct.
