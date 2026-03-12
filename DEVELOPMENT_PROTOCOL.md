# Development Protocol

## Test Data Isolation

This document defines the rules for separating test data from production data. These rules exist because a previous development session accidentally deleted real client data by running an insufficiently scoped SQL DELETE query.

### Account Structure

| Account | Trainer ID | Email | Purpose |
|---------|-----------|-------|---------|
| Andy Knight | `1` | andy@andyknight.asia | **Designated test account** |
| Luke | (unknown) | (not stored here) | **Production account — never touched during development** |

### Permanent Test Client

| Field | Value |
|-------|-------|
| Client ID | `990036` |
| Name | TEST CLIENT |
| Email | andy@andyknight.asia |
| Trainer | Andy Knight (ID: 1) |

This client must never be deleted. It is the anchor for all automated tests.

### Rules for Database Operations

**Creating test data:**
All test clients, sessions, packages, and any other records created during development must be assigned to `trainerId = 1` (Andy Knight). Never create test data under any other trainer ID.

**Deleting test data:**
The only permitted pattern for bulk-deleting test clients is:

```sql
DELETE FROM clients
WHERE trainerId = 1
AND id != 990036
```

This is encoded in `server/testSetup.ts` as `getTestCleanupWhereClause()`. Always use that function rather than writing ad-hoc DELETE queries.

**Forbidden patterns:**
The following query patterns are explicitly forbidden because they are not scoped to a specific trainer and can delete production data:

```sql
-- FORBIDDEN: deletes across all trainers
DELETE FROM clients WHERE email != 'x'

-- FORBIDDEN: name matching is unreliable and not scoped
DELETE FROM clients WHERE name LIKE '%test%'

-- FORBIDDEN: no WHERE clause
DELETE FROM clients
```

### Before Running Any DELETE Query

1. Confirm the query includes `WHERE trainerId = 1`
2. Confirm the query excludes `id = 990036`
3. If in doubt, run a `SELECT` with the same WHERE clause first to preview what will be deleted

### Code References

- `server/testSetup.ts` — defines `ANDY_TRAINER_ID`, `TEST_CLIENT_ID`, and `getTestCleanupWhereClause()`
- `server/test-helpers.ts` — provides `cleanupTestClients()` and `cleanupTestData()` with built-in safeguards
