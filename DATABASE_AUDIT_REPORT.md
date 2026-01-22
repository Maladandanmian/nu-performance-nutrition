# Database Schema Audit Report
**Date**: January 22, 2026  
**Project**: Nu Performance Nutrition  
**Purpose**: Identify hidden limits and constraints before trainer-side development

---

## Executive Summary

✅ **Good News**: No hidden row limits found in the database schema. The previous 50-item limit issue was likely a temporary query/display limit, not a database constraint.

⚠️ **Potential Concerns**: Several AUTO_INCREMENT values are already in the millions, suggesting this database may have been used for other projects or testing. This is not a problem but worth noting.

---

## Table-by-Table Analysis

### 1. **users** Table
- **Primary Key**: `id` (int AUTO_INCREMENT)
- **Current AUTO_INCREMENT**: 2,850,001
- **Unique Constraints**: `openId` (varchar 64)
- **Field Limits**:
  - `openId`: 64 characters max
  - `email`: 320 characters max (RFC 5321 compliant)
  - `loginMethod`: 64 characters max
  - `name`: TEXT (up to 65,535 characters)
  - `role`: ENUM ('user', 'admin')
- **Foreign Keys**: None
- **Cascade Deletes**: N/A
- **Row Limit**: ❌ **None** (int allows up to ~2.1 billion rows)

---

### 2. **clients** Table
- **Primary Key**: `id` (int AUTO_INCREMENT)
- **Current AUTO_INCREMENT**: 570,001
- **Unique Constraints**: `pin` (varchar 6) - **Important: Only 1 million possible 6-digit PINs**
- **Field Limits**:
  - `name`: 255 characters max
  - `email`: 320 characters max
  - `phone`: 50 characters max
  - `pin`: 6 characters max (UNIQUE - practical limit of ~1M clients if using numeric PINs)
  - `notes`: TEXT (up to 65,535 characters)
- **Foreign Keys**: 
  - `trainerId` → `users.id` (ON DELETE CASCADE)
- **Cascade Deletes**: ✅ Deleting a trainer deletes all their clients
- **Row Limit**: ⚠️ **Practical limit of ~1 million clients** due to 6-character unique PIN constraint

---

### 3. **nutrition_goals** Table
- **Primary Key**: `id` (int AUTO_INCREMENT)
- **Current AUTO_INCREMENT**: 570,001
- **Unique Constraints**: None
- **Field Limits**:
  - All target fields: int (max value 2,147,483,647)
  - `weightTarget`: decimal(5,1) - **Max 9999.9 kg** (reasonable for human weight)
  - `notes`: TEXT (up to 65,535 characters)
- **Foreign Keys**: 
  - `clientId` → `clients.id` (ON DELETE CASCADE)
- **Cascade Deletes**: ✅ Deleting a client deletes their nutrition goals
- **Row Limit**: ❌ **None** (int allows up to ~2.1 billion rows)

---

### 4. **meals** Table
- **Primary Key**: `id` (int AUTO_INCREMENT)
- **Current AUTO_INCREMENT**: 2,280,001
- **Unique Constraints**: None
- **Field Limits**:
  - `imageUrl`: TEXT (up to 65,535 characters)
  - `imageKey`: TEXT (up to 65,535 characters)
  - `mealType`: ENUM ('breakfast', 'lunch', 'dinner', 'snack')
  - All nutrition fields: int (max value 2,147,483,647)
  - `aiDescription`: TEXT (up to 65,535 characters)
  - `aiConfidence`: int (0-100 expected, but no DB constraint)
  - `nutritionScore`: int (1-5 expected, but no DB constraint)
  - `notes`: TEXT (up to 65,535 characters)
  - `components`: JSON (up to 1GB in MySQL 8.0, but practical limit is 65,535 bytes for InnoDB)
- **Foreign Keys**: 
  - `clientId` → `clients.id` (ON DELETE CASCADE)
- **Cascade Deletes**: ✅ Deleting a client deletes all their meals
- **Row Limit**: ❌ **None** (int allows up to ~2.1 billion rows)

---

### 5. **drinks** Table
- **Primary Key**: `id` (int AUTO_INCREMENT)
- **Current AUTO_INCREMENT**: 1,710,001
- **Unique Constraints**: None
- **Field Limits**:
  - `drinkType`: 100 characters max
  - `volumeMl`: int (max 2,147,483,647 ml = ~2.1 million liters)
  - All nutrition fields: int (max value 2,147,483,647)
  - `notes`: TEXT (up to 65,535 characters)
- **Foreign Keys**: 
  - `clientId` → `clients.id` (ON DELETE CASCADE)
  - `mealId` → `meals.id` (ON DELETE CASCADE) - nullable
- **Cascade Deletes**: ✅ Deleting a client or meal deletes associated drinks
- **Row Limit**: ❌ **None** (int allows up to ~2.1 billion rows)

---

### 6. **body_metrics** Table
- **Primary Key**: `id` (int AUTO_INCREMENT)
- **Current AUTO_INCREMENT**: 120,001
- **Unique Constraints**: None
- **Field Limits**:
  - `weight`: int (stored as kg × 10, e.g., 75.5kg = 755)
    - **Max weight**: 214,748,364.7 kg (unrealistic, not a practical limit)
  - `hydration`: int (max 2,147,483,647 ml = ~2.1 million liters)
  - `notes`: TEXT (up to 65,535 characters)
- **Foreign Keys**: 
  - `clientId` → `clients.id` (ON DELETE CASCADE)
- **Cascade Deletes**: ✅ Deleting a client deletes all their body metrics
- **Row Limit**: ❌ **None** (int allows up to ~2.1 billion rows)

---

## Key Findings

### ✅ No Hidden Row Limits
- **All tables use `int` for primary keys**, allowing up to ~2.1 billion rows per table
- **No CHECK constraints** limiting row counts
- **No triggers** that would prevent insertions after a certain threshold
- The previous "50-item limit" was likely a **query LIMIT clause** or **frontend pagination**, not a database constraint

### ⚠️ Practical Constraints to Be Aware Of

1. **Client PIN Uniqueness** (Most Important)
   - 6-character PINs must be unique across ALL clients (all trainers)
   - If using numeric PINs (000000-999999): **Maximum 1 million clients system-wide**
   - If using alphanumeric PINs (case-sensitive): ~56 billion possible combinations (not a practical limit)
   - **Recommendation**: Use alphanumeric PINs or implement PIN recycling for deleted clients

2. **AUTO_INCREMENT Starting Points**
   - Several tables start at high numbers (2.8M, 570K, 2.2M, 1.7M)
   - This suggests the database was used for other projects or stress testing
   - **Not a problem**, but IDs will continue from these high values

3. **JSON Field Size** (`meals.components`)
   - MySQL JSON fields are limited to 1GB in theory
   - InnoDB row size limit is 65,535 bytes (practical limit for JSON in most cases)
   - **Recommendation**: If storing large meal component arrays, consider pagination or separate table

4. **TEXT Field Limits**
   - All TEXT fields limited to 65,535 characters (~65KB)
   - Should be sufficient for notes, descriptions, and URLs
   - **Recommendation**: If storing very long content (e.g., detailed meal plans), consider MEDIUMTEXT or LONGTEXT

5. **Cascade Deletes** (Good Design)
   - ✅ Deleting a trainer cascades to clients
   - ✅ Deleting a client cascades to meals, drinks, body_metrics, nutrition_goals
   - ✅ Deleting a meal cascades to drinks (if linked)
   - **No orphaned records** - clean data integrity

---

## Recommendations for Trainer-Side Development

### 1. **Data Volume Testing**
- Test with realistic data volumes (e.g., 100 clients, 10,000 meals)
- Monitor query performance on large datasets
- Consider adding indexes if queries become slow

### 2. **PIN Management**
- Implement PIN generation logic that handles uniqueness conflicts gracefully
- Consider alphanumeric PINs to avoid the 1M client limit
- Add error handling for duplicate PIN violations

### 3. **Query Pagination**
- Always use LIMIT/OFFSET or cursor-based pagination for large result sets
- The previous "50-item limit" was likely a frontend/query limit - maintain this pattern
- Document pagination limits clearly in the code

### 4. **Monitoring AUTO_INCREMENT Values**
- If AUTO_INCREMENT approaches 2.1 billion, plan for BIGINT migration
- Current values (2.8M max) are safe for years of growth

### 5. **JSON Component Storage**
- Monitor size of `meals.components` JSON arrays
- If components regularly exceed 10-20 items, consider a separate `meal_components` table

---

## Conclusion

✅ **Safe to proceed with trainer-side development**  
✅ **No hidden row limits found**  
⚠️ **Watch out for PIN uniqueness** (1M limit if numeric)  
✅ **Cascade deletes properly configured**  
✅ **Field size limits are reasonable for the use case**

The database schema is well-designed and production-ready. The previous rollback issue was **not caused by a database limit** but likely by application-level pagination or query constraints.

---

## Next Steps

1. ✅ Create feature branch for trainer-side development
2. ✅ Implement PIN generation with conflict handling
3. ✅ Add pagination to all list views (clients, meals, etc.)
4. ✅ Test with realistic data volumes before merging to main
5. ✅ Push both main and feature branches to GitHub for backup
