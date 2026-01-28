import { drizzle } from "drizzle-orm/mysql2";
import { eq, and, desc, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { 
  InsertUser, users,
  InsertClient, clients,
  InsertNutritionGoal, nutritionGoals,
  InsertMeal, meals,
  InsertDrink, drinks,
  InsertBodyMetric, bodyMetrics,
  emailVerificationTokens,
  passwordResetTokens,
  auditLogs,
} from "../drizzle/schema";
import { ENV, isAdminEmail } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId || isAdminEmail(user.email)) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Client management queries
export async function createClient(client: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clients).values(client);
  return result;
}

export async function getClientsByTrainerId(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients).where(eq(clients.trainerId, trainerId));
}

export async function getClientById(clientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get client by PIN - supports both legacy plaintext and bcrypt hashed PINs
 * For bcrypt PINs, we need to fetch all clients and compare hashes
 */
export async function getClientByPIN(pin: string) {
  const { verifyPIN, isPINHashed } = await import('./pinAuth');
  const db = await getDb();
  if (!db) return undefined;
  
  // First, try exact match for legacy plaintext PINs
  const exactMatch = await db.select().from(clients).where(eq(clients.pin, pin)).limit(1);
  if (exactMatch.length > 0) {
    return exactMatch[0];
  }
  
  // If no exact match, check hashed PINs
  // Get all clients with hashed PINs (starts with $2)
  const allClients = await db.select().from(clients);
  for (const client of allClients) {
    if (client.pin && isPINHashed(client.pin)) {
      const matches = await verifyPIN(pin, client.pin);
      if (matches) {
        return client;
      }
    }
  }
  
  return undefined;
}

/**
 * Get all clients (for PIN migration)
 */
export async function getAllClients() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients);
}

export async function updateClient(clientId: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(clients).set(data).where(eq(clients.id, clientId));
}

export async function deleteClient(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(clients).where(eq(clients.id, clientId));
}

// Nutrition goals queries
export async function createNutritionGoal(goal: InsertNutritionGoal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(nutritionGoals).values(goal);
}

export async function getNutritionGoalByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(nutritionGoals).where(eq(nutritionGoals.clientId, clientId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateNutritionGoal(clientId: number, data: Partial<InsertNutritionGoal>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(nutritionGoals).set(data).where(eq(nutritionGoals.clientId, clientId));
}

// Meal queries
export async function createMeal(meal: InsertMeal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(meals).values(meal);
}

export async function getMealsByClientId(clientId: number, limit: number = 500) {
  const db = await getDb();
  if (!db) return [];
  // Order by loggedAt DESC to get newest meals first
  return db.select().from(meals).where(eq(meals.clientId, clientId)).orderBy(desc(meals.loggedAt)).limit(limit);
}

export async function getMealById(mealId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(meals).where(eq(meals.id, mealId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteMeal(mealId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(meals).where(eq(meals.id, mealId));
}

export async function updateMeal(mealId: number, data: Partial<InsertMeal>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(meals).set(data).where(eq(meals.id, mealId));
}

export async function toggleMealFavorite(mealId: number, isFavorite: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(meals).set({ isFavorite: isFavorite ? 1 : 0 }).where(eq(meals.id, mealId));
}

export async function getFavoriteMeals(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(meals)
    .where(and(eq(meals.clientId, clientId), eq(meals.isFavorite, 1)))
    .orderBy(desc(meals.loggedAt))
    .limit(3);
}

export async function getLastMeal(clientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(meals)
    .where(eq(meals.clientId, clientId))
    .orderBy(desc(meals.loggedAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function duplicateMeal(mealId: number, newLoggedAt: Date, preserveFavorite = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const originalMeal = await getMealById(mealId);
  if (!originalMeal) throw new Error("Meal not found");
  
  // Create a copy without id, createdAt, and with new loggedAt
  const { id, createdAt, isFavorite, ...mealData } = originalMeal;
  const newMeal: InsertMeal = {
    ...mealData,
    loggedAt: newLoggedAt,
    isFavorite: preserveFavorite ? isFavorite : 0, // Preserve favorite status if requested
  };
  
  await db.insert(meals).values(newMeal);
  
  // Query the newly created meal by clientId and loggedAt
  const result = await db.select().from(meals)
    .where(and(eq(meals.clientId, originalMeal.clientId), eq(meals.loggedAt, newLoggedAt)))
    .orderBy(desc(meals.id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Drink queries
export async function createDrink(drink: InsertDrink) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(drinks).values(drink);
}

export async function getDrinksByClientId(clientId: number, limit: number = 500) {
  const db = await getDb();
  if (!db) return [];
  // Order by loggedAt DESC to get newest drinks first
  return db.select().from(drinks).where(eq(drinks.clientId, clientId)).orderBy(desc(drinks.loggedAt)).limit(limit);
}

export async function deleteDrink(drinkId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(drinks).where(eq(drinks.id, drinkId));
}

export async function updateDrink(drinkId: number, data: Partial<InsertDrink>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(drinks).set(data).where(eq(drinks.id, drinkId));
}

export async function getDrinkById(drinkId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(drinks).where(eq(drinks.id, drinkId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function toggleDrinkFavorite(drinkId: number, isFavorite: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(drinks).set({ isFavorite: isFavorite ? 1 : 0 }).where(eq(drinks.id, drinkId));
}

export async function getFavoriteDrinks(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(drinks)
    .where(and(eq(drinks.clientId, clientId), eq(drinks.isFavorite, 1)))
    .orderBy(desc(drinks.loggedAt))
    .limit(3);
}

export async function duplicateDrink(drinkId: number, newLoggedAt: Date, preserveFavorite = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const originalDrink = await getDrinkById(drinkId);
  if (!originalDrink) throw new Error("Drink not found");
  
  // Create a copy without id, createdAt, and with new loggedAt
  const { id, createdAt, isFavorite, ...drinkData} = originalDrink;
  const newDrink: InsertDrink = {
    ...drinkData,
    loggedAt: newLoggedAt,
    isFavorite: preserveFavorite ? isFavorite : 0, // Preserve favorite status if requested
  };
  
  await db.insert(drinks).values(newDrink);
  
  // Query the newly created drink by clientId and loggedAt
  const result = await db.select().from(drinks)
    .where(and(eq(drinks.clientId, originalDrink.clientId), eq(drinks.loggedAt, newLoggedAt)))
    .orderBy(desc(drinks.id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function getLastDrink(clientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(drinks)
    .where(eq(drinks.clientId, clientId))
    .orderBy(desc(drinks.loggedAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Body metrics queries
export async function createBodyMetric(metric: InsertBodyMetric) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Build insert object with explicit null for missing fields
  const convertedMetric: any = {
    clientId: metric.clientId,
    weight: metric.weight ? Math.round(metric.weight * 10) : null,
    hydration: metric.hydration || null,
    notes: metric.notes || null,
    recordedAt: metric.recordedAt || new Date(),
  }
  
  return db.insert(bodyMetrics).values(convertedMetric);
}

export async function getBodyMetricsByClientId(clientId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bodyMetrics).where(eq(bodyMetrics.clientId, clientId)).orderBy(bodyMetrics.recordedAt).limit(limit);
}

export async function deleteBodyMetric(metricId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(bodyMetrics).where(eq(bodyMetrics.id, metricId));
}

export async function deleteNutritionGoalByClientId(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(nutritionGoals).where(eq(nutritionGoals.clientId, clientId));
}

// Test cleanup function - deletes all data for a client
export async function deleteClientAndData(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    // Delete in order of dependencies
    await db.delete(bodyMetrics).where(eq(bodyMetrics.clientId, clientId));
    await db.delete(drinks).where(eq(drinks.clientId, clientId));
    await db.delete(meals).where(eq(meals.clientId, clientId));
    await db.delete(nutritionGoals).where(eq(nutritionGoals.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
  } catch (error) {
    console.error(`[Database] Failed to delete client ${clientId}:`, error);
    throw error;
  }
}

// ============================================================================
// DEXA Scan Database Helpers
// ============================================================================

import {
  InsertDexaScan, dexaScans,
  InsertDexaBmdData, dexaBmdData,
  InsertDexaBodyComp, dexaBodyComp,
  InsertDexaImage, dexaImages,
  InsertDexaGoal, dexaGoals
} from "../drizzle/schema";

/**
 * Create or update DEXA goals for a client
 */
export async function upsertDexaGoals(clientId: number, goals: Partial<InsertDexaGoal>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getDexaGoalsByClientId(clientId);
  
  if (existing) {
    // Update existing goals
    return db.update(dexaGoals).set(goals).where(eq(dexaGoals.clientId, clientId));
  } else {
    // Create new goals
    return db.insert(dexaGoals).values({ clientId, ...goals });
  }
}

/**
 * Get DEXA goals for a client
 */
export async function getDexaGoalsByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(dexaGoals).where(eq(dexaGoals.clientId, clientId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Create a new DEXA scan record
 */
export async function createDexaScan(scan: InsertDexaScan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(dexaScans).values(scan);
  return result[0].insertId;
}

/**
 * Get all DEXA scans for a client
 */
export async function getDexaScansByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(dexaScans)
    .where(eq(dexaScans.clientId, clientId))
    .orderBy(desc(dexaScans.scanDate));
}

/**
 * Get a single DEXA scan by ID
 */
export async function getDexaScanById(scanId: number) {
  const db = await getDb();
  if (!db) return null;

  const results = await db
    .select()
    .from(dexaScans)
    .where(eq(dexaScans.id, scanId))
    .limit(1);

  return results[0] || null;
}

/**
 * Update DEXA scan status (approve/reject)
 */
export async function updateDexaScanStatus(
  scanId: number,
  status: "approved" | "rejected",
  rejectionReason?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { status };
  if (status === "approved") {
    updateData.approvedAt = new Date();
  }
  if (rejectionReason) {
    updateData.rejectionReason = rejectionReason;
  }

  await db
    .update(dexaScans)
    .set(updateData)
    .where(eq(dexaScans.id, scanId));
}

/**
 * Create BMD data records for a scan
 */
export async function createDexaBmdData(bmdRecords: InsertDexaBmdData[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (bmdRecords.length === 0) return;
  await db.insert(dexaBmdData).values(bmdRecords);
}

/**
 * Get BMD data for a scan
 */
export async function getDexaBmdData(scanId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(dexaBmdData)
    .where(eq(dexaBmdData.scanId, scanId));
}

/**
 * Create body composition record for a scan
 */
export async function createDexaBodyComp(bodyComp: InsertDexaBodyComp) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(dexaBodyComp).values(bodyComp);
}

/**
 * Get body composition data for a scan
 */
export async function getDexaBodyComp(scanId: number) {
  const db = await getDb();
  if (!db) return null;

  const results = await db
    .select()
    .from(dexaBodyComp)
    .where(eq(dexaBodyComp.scanId, scanId))
    .limit(1);

  return results[0] || null;
}

/**
 * Create image records for a scan
 */
export async function createDexaImages(images: InsertDexaImage[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (images.length === 0) return;
  await db.insert(dexaImages).values(images);
}

/**
 * Get images for a scan
 */
export async function getDexaImages(scanId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(dexaImages)
    .where(eq(dexaImages.scanId, scanId))
    .orderBy(dexaImages.pageNumber);
}

/**
 * Get all body composition data for a client (for trend analysis)
 */
export async function getDexaBodyCompHistory(clientId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select()
    .from(dexaBodyComp)
    .innerJoin(dexaScans, eq(dexaBodyComp.scanId, dexaScans.id))
    .where(eq(dexaScans.clientId, clientId))
    .orderBy(desc(dexaScans.scanDate)); // DESC: newest first
  
  // Transform to flat structure with scan status
  return results.map((row: any) => ({
    ...row.dexa_body_comp,
    scanDate: row.dexa_scans.scanDate,
    status: row.dexa_scans.status,
  }));
}

/**
 * Get all BMD data for a client (for trend analysis)
 */
export async function getDexaBmdHistory(clientId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      scanDate: dexaScans.scanDate,
      scanId: dexaScans.id,
      status: dexaScans.status,
      region: dexaBmdData.region,
      bmd: dexaBmdData.bmd,
      tScore: dexaBmdData.tScore,
      zScore: dexaBmdData.zScore,
    })
    .from(dexaBmdData)
    .innerJoin(dexaScans, eq(dexaBmdData.scanId, dexaScans.id))
    .where(eq(dexaScans.clientId, clientId))
    .orderBy(desc(dexaScans.scanDate)); // DESC: newest first
}

// Email Authentication Database Functions

/**
 * Get client by email address
 */
export async function getClientByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(clients)
    .where(eq(clients.email, email))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Update client authentication fields
 */
export async function updateClientAuth(
  clientId: number,
  data: {
    email?: string;
    passwordHash?: string;
    authMethod?: 'pin' | 'email' | 'both';
  }
) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(clients)
    .set(data)
    .where(eq(clients.id, clientId));
}

/**
 * Update client password
 */
export async function updateClientPassword(clientId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(clients)
    .set({ passwordHash })
    .where(eq(clients.id, clientId));
}

/**
 * Verify client email
 */
export async function verifyClientEmail(clientId: number) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(clients)
    .set({ emailVerified: true })
    .where(eq(clients.id, clientId));
}

/**
 * Create email verification token
 */
export async function createEmailVerificationToken(data: {
  clientId: number;
  token: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) return null;
  
  return db.insert(emailVerificationTokens).values(data);
}

/**
 * Get email verification token
 */
export async function getEmailVerificationToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Mark email verification token as used
 */
export async function markEmailVerificationTokenUsed(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(emailVerificationTokens)
    .set({ used: true })
    .where(eq(emailVerificationTokens.token, token));
}

/**
 * Create password reset token
 */
export async function createPasswordResetToken(data: {
  clientId: number;
  token: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) return null;
  
  return db.insert(passwordResetTokens).values(data);
}

/**
 * Get password reset token
 */
export async function getPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Mark password reset token as used
 */
export async function markPasswordResetTokenUsed(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(passwordResetTokens)
    .set({ used: true })
    .where(eq(passwordResetTokens.token, token));
}


// ============================================================================
// Client Password Setup Helpers
// ============================================================================

/**
 * Generate and store a password setup token for a client
 * Token expires in 24 hours
 */
export async function generatePasswordSetupToken(clientId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Generate random token
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
  
  // Store token in client record
  await db.update(clients).set({
    passwordSetupToken: token,
    passwordSetupTokenExpires: expiresAt,
  }).where(eq(clients.id, clientId));
  
  return token;
}

/**
 * Verify and consume a password setup token
 * Returns the client if token is valid, undefined otherwise
 */
export async function verifyPasswordSetupToken(token: string): Promise<typeof clients.$inferSelect | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(clients)
    .where(and(
      eq(clients.passwordSetupToken, token),
      // Token must not be expired
      sql`${clients.passwordSetupTokenExpires} > NOW()`
    ))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Clear password setup token after successful password setup
 */
export async function clearPasswordSetupToken(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(clients).set({
    passwordSetupToken: null,
    passwordSetupTokenExpires: null,
  }).where(eq(clients.id, clientId));
}


