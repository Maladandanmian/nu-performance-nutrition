# Test Client Cleanup Protocol

## Overview
This document outlines the protocol for managing test clients created during development and testing of the Nu Performance Nutrition application.

## Protected Client
The following client is designated as the primary test/development client and **MUST NEVER BE DELETED**:
- **Email**: andy@andyknight.asia
- **Name**: TEST CLIENT
- **Purpose**: Primary testing and development client for the trainer interface

## Test Client Identification
Test clients created during development typically have:
- Email addresses matching patterns: `*@example.com`, `editdelete*@example.com`
- Names containing: "Test Client for Edit/Delete", "Test Client"
- Created timestamps during development sessions

## Cleanup Procedure
At the end of each development task, execute the following SQL query to remove all test clients except the protected one:

```sql
DELETE FROM clients 
WHERE email != 'andy@andyknight.asia' 
AND (
  email LIKE '%@example.com' 
  OR name LIKE '%Test Client%'
);
```

## Verification
After cleanup, verify that only the protected client remains:

```sql
SELECT id, name, email FROM clients WHERE email = 'andy@andyknight.asia';
```

Expected result: 1 row with TEST CLIENT and andy@andyknight.asia

## Implementation Notes
- This cleanup should be performed automatically at the end of each development task
- The cleanup query is safe and will not affect production client data
- Always verify the protected client exists after cleanup
- If additional test clients need to be created, use email addresses matching `*@example.com` pattern for easy identification and cleanup
