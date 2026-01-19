# Critical Bug Report: Meals Not Displaying in Nutrition History

## Problem Summary

**Status:** CRITICAL - App core functionality broken  
**Affected Feature:** Nutrition History Feed  
**User Impact:** Meals logged after January 15, 2:53 PM do not appear in the Nutrition History view, despite being successfully saved to the database.

**Symptoms:**
- User logs in with PIN 222222
- User logs a meal (receives "Meal logged successfully!" toast)
- Meal does NOT appear in Nutrition History
- Database verification shows meals ARE being saved correctly (confirmed via direct SQL queries)
- The issue affects ALL meals logged after a specific timestamp (Jan 15, 2:53 PM)

---

## Root Cause Analysis

### Investigation Process

1. **Database Verification (PASSED)**
   - Direct SQL query: `SELECT id, clientId, aiDescription, loggedAt FROM meals WHERE clientId = 1 ORDER BY loggedAt DESC LIMIT 5;`
   - Result: 5 meals found for clientId 1, confirming meals ARE being saved to database
   - Conclusion: Backend saving logic is working correctly

2. **API Call Verification (PASSED)**
   - Network tab shows successful API calls:
     - `identifyItems` - returns identified food items
     - `analyzeMealWithDrink` - returns meal analysis (status 200)
     - `saveMeal` - returns 304 (Not Modified)
     - `dailyTotals` - returns daily nutrition totals (status 200)
   - Conclusion: All API calls are succeeding

3. **Cookie/Session Investigation (FAILED)**
   - `auth.clientSession` endpoint returns `null` when tested via curl
   - Server logs show: `[Auth] Missing session cookie`
   - Client logs show: `[useClientAuth] clientSession: null`
   - Conclusion: Session cookie is NOT being sent with requests

### The Core Issue: Query Not Executing

The `meals.list` query is **NOT appearing in the Network tab at all**, despite:
- The component being rendered
- The API endpoint existing and working
- Other queries (`dailyTotals`) executing successfully

This indicates the query is either:
1. Not being called due to a disabled/gated condition
2. Being called but failing silently
3. Returning cached data from clientId=0 (non-existent client)

### Session Cookie Problem

The root cause appears to be a **session cookie issue**:

```
loginWithPIN mutation → Sets client_session cookie
                    ↓
Page redirects to /client (500ms delay)
                    ↓
useClientAuth hook calls auth.clientSession query
                    ↓
Query tries to read client_session cookie
                    ↓
Cookie is NOT sent with the request
                    ↓
clientSession returns null
                    ↓
clientId defaults to 0
                    ↓
meals.list query fetches meals for clientId=0 (empty result)
```

**Why the cookie isn't being sent:**
- Cookie configuration has `sameSite: "none"` which requires `secure: true`
- In HTTP dev environment, `secure` is `false`
- Browser rejects this invalid combination and doesn't send the cookie

---

## Fixes Attempted

### Fix 1: Cookie Configuration (ATTEMPTED - FAILED)
**File:** `server/_core/cookies.ts`

**Change:**
```typescript
// Before: Always use sameSite: "none"
sameSite: "none",
secure: isSecureRequest(req),

// After: Use sameSite: "lax" for HTTP, "none" for HTTPS
sameSite: isSecureRequest ? "none" : "lax",
secure: isSecureRequest,
```

**Status:** FAILED - Meals still not displaying after restart
**Hypothesis:** Cookie fix didn't work because the real issue is elsewhere

### Fix 2: Query Gating (ATTEMPTED - FAILED)
**File:** `client/src/components/NutritionHistoryFeed.tsx`

**Change:**
```typescript
// Before: Query always runs with whatever clientId is passed
const { data: mealsData } = trpc.meals.list.useQuery({ clientId });

// After: Query only runs when clientId is valid
const { data: mealsData } = trpc.meals.list.useQuery(
  { clientId },
  { enabled: clientId > 0 }
);
```

**Status:** FAILED - Meals still not displaying after restart
**Hypothesis:** This prevents the query from running with clientId=0, but doesn't solve the underlying session problem

---

## Current State

**Code Version:** 3c747cbb (rolled back to working version from Jan 15)
**Current Behavior:** Same as broken state - meals save but don't display
**Server Status:** Running and healthy
**Database Status:** Working correctly
**Session Status:** NOT working - cookie not being sent

---

## Debugging Information

### Key Observations

1. **Timing Anomaly:** The bug started EXACTLY after Jan 15, 2:53 PM
   - No code changes were made by user between working and broken state
   - Suggests runtime/environment issue, not code issue
   - Possible causes: Database state, server restart, session timeout

2. **Selective Failure:** Only `meals.list` query is affected
   - `dailyTotals` query works fine
   - `identifyItems` works fine
   - `analyzeMealWithDrink` works fine
   - `saveMeal` works fine
   - Suggests issue is specific to how `meals.list` reads clientId

3. **Session Cookie Not Persisting:**
   - Cookie is set by server during login
   - Cookie is not being sent with subsequent requests
   - Indicates browser is not storing/sending the cookie

### Console Logs Available

From `useClientAuth` hook:
```
[useClientAuth] clientSession: null loading: false
```

From `NutritionHistoryFeed` component:
```
[NutritionHistoryFeed] clientId: 0 mealsData: undefined mealsLoading: false
```

From server:
```
[Auth] Missing session cookie
[clientSession] No cookies object
```

---

## Next Steps for Investigation

### 1. Verify Cookie is Actually Being Set
- Add logging to `loginWithPIN` mutation to confirm cookie is being set in response headers
- Check browser DevTools → Application → Cookies to see if `client_session` cookie exists
- Verify cookie has correct domain, path, and expiration

### 2. Verify Cookie is Being Sent
- Add logging to `auth.clientSession` query to check if cookie is in request headers
- Use browser DevTools → Network tab to inspect request/response headers for `/api/trpc` calls
- Check if `credentials: "include"` is actually sending cookies

### 3. Check for Cross-Origin Issues
- Verify frontend and backend are on same origin (or CORS is configured correctly)
- Check if browser is blocking cookies due to SameSite policy

### 4. Verify Query Cache
- Check if `meals.list` query is cached with clientId=0 and not invalidating
- Verify React Query cache is being cleared on login
- Check if query key includes clientId (should be `['meals.list', { clientId }]`)

### 5. Add Comprehensive Logging
- Log every step of the login flow
- Log every step of the session check
- Log every tRPC query execution with parameters

---

## Files Modified

1. `server/_core/cookies.ts` - Changed sameSite logic
2. `client/src/components/NutritionHistoryFeed.tsx` - Added query gating

## Files to Investigate

1. `client/src/main.tsx` - tRPC client configuration
2. `server/routers.ts` - loginWithPIN and auth.clientSession procedures
3. `client/src/hooks/useClientAuth.ts` - Session hook
4. `client/src/pages/ClientDashboard.tsx` - Dashboard component
5. `server/_core/context.ts` - Request context setup

---

## Hypothesis for Manus 1.6 Max

The issue is likely a **session/cookie persistence problem** rather than a code logic problem:

1. **Cookie is being set correctly** by the server during login
2. **Cookie is NOT being sent** with subsequent requests
3. **Reason:** Browser is rejecting the cookie due to SameSite/Secure mismatch OR the cookie is being cleared/not persisted

**Key diagnostic:** Check if the `client_session` cookie exists in browser DevTools after login. If it doesn't exist, the server isn't setting it correctly or the browser is rejecting it.

