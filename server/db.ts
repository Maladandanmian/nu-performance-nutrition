import { drizzle } from "drizzle-orm/mysql2";
import { eq, and, desc, asc, sql, gte, lte } from "drizzle-orm";
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
  athleteMonitoring,
  strengthTests,
  nutritionReports,
  vo2MaxTests,
  vo2MaxAmbientData,
  vo2MaxAnthropometric,
  vo2MaxFitnessAssessment,
  vo2MaxLactateProfile,
  trainerNotifications,
  InsertTrainerNotification,
  notificationSettings,
  InsertNotificationSetting,
  supplementTemplates,
  InsertSupplementTemplate,
  supplementLogs,
  InsertSupplementLog,
  trainingSessions,
  InsertTrainingSession,
  groupClasses,
  InsertGroupClass,
  groupClassAttendance,
  InsertGroupClassAttendance,
  sessionPackages,
  InsertSessionPackage,
  recurringSessionRules,
  InsertRecurringSessionRule,
  backupLogs,
  InsertBackupLog,
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

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Client management queries
export async function createClient(client: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(clients).values(client);
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
  // Upsert: insert with defaults if no row exists, otherwise update
  const existing = await db.select({ id: nutritionGoals.id }).from(nutritionGoals).where(eq(nutritionGoals.clientId, clientId)).limit(1);
  if (existing.length === 0) {
    await db.insert(nutritionGoals).values({
      clientId,
      caloriesTarget: 2000,
      proteinTarget: 150,
      fatTarget: 65,
      carbsTarget: 250,
      fibreTarget: 25,
      hydrationTarget: 2000,
      ...data,
    });
  } else {
    await db.update(nutritionGoals).set(data).where(eq(nutritionGoals.clientId, clientId));
  }
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
  
  // If favoriting, first get the meal details to find its description and clientId
  if (isFavorite) {
    const meal = await getMealById(mealId);
    if (meal && meal.aiDescription) {
      // Un-favorite all other meals with the same description for this client (locked Quick Log)
      await db.update(meals)
        .set({ isFavorite: 0 })
        .where(and(
          eq(meals.clientId, meal.clientId),
          eq(meals.aiDescription, meal.aiDescription),
          eq(meals.isFavorite, 1)
        ));
    }
  }
  
  // Now set the favorite status for this specific meal
  return db.update(meals).set({ isFavorite: isFavorite ? 1 : 0 }).where(eq(meals.id, mealId));
}

export async function getFavoriteMeals(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all favorite meals for this client
  const allFavorites = await db.select().from(meals)
    .where(and(eq(meals.clientId, clientId), eq(meals.isFavorite, 1)))
    .orderBy(desc(meals.loggedAt));
  
  // Group by aiDescription and keep only the most recent one for each description
  const uniqueFavorites = new Map<string, typeof allFavorites[0]>();
  for (const meal of allFavorites) {
    const key = meal.aiDescription || 'unknown';
    if (!uniqueFavorites.has(key)) {
      uniqueFavorites.set(key, meal);
    }
  }
  
  // Return up to 3 unique favorite meal types
  return Array.from(uniqueFavorites.values()).slice(0, 3);
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
  
  const insertResult = await db.insert(meals).values(newMeal);
  const insertId = insertResult[0].insertId;
  
  // Query the newly created meal by its ID
  const result = await db.select().from(meals)
    .where(eq(meals.id, insertId))
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
  
  // If favoriting, first get the drink details to find its type and clientId
  if (isFavorite) {
    const drink = await getDrinkById(drinkId);
    if (drink) {
      // Un-favorite all other drinks of the same type for this client (locked Quick Log)
      await db.update(drinks)
        .set({ isFavorite: 0 })
        .where(and(
          eq(drinks.clientId, drink.clientId),
          eq(drinks.drinkType, drink.drinkType),
          eq(drinks.isFavorite, 1)
        ));
    }
  }
  
  // Now set the favorite status for this specific drink
  return db.update(drinks).set({ isFavorite: isFavorite ? 1 : 0 }).where(eq(drinks.id, drinkId));
}

export async function getFavoriteDrinks(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all favorite drinks for this client
  const allFavorites = await db.select().from(drinks)
    .where(and(eq(drinks.clientId, clientId), eq(drinks.isFavorite, 1)))
    .orderBy(desc(drinks.loggedAt));
  
  // Group by drinkType and keep only the most recent one for each type
  const uniqueFavorites = new Map<string, typeof allFavorites[0]>();
  for (const drink of allFavorites) {
    if (!uniqueFavorites.has(drink.drinkType)) {
      uniqueFavorites.set(drink.drinkType, drink);
    }
  }
  
  // Return up to 3 unique favorite drink types
  return Array.from(uniqueFavorites.values()).slice(0, 3);
}

export async function duplicateDrink(drinkId: number, newLoggedAt: Date, preserveFavorite = false, sourceType: "manual" | "favorite" | "repeat" = "manual") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const originalDrink = await getDrinkById(drinkId);
  if (!originalDrink) throw new Error("Drink not found");
  
  // Create a copy without id, createdAt, and with new loggedAt
  const { id, createdAt, isFavorite, sourceType: _, ...drinkData} = originalDrink;
  const newDrink: InsertDrink = {
    ...drinkData,
    loggedAt: newLoggedAt,
    isFavorite: preserveFavorite ? isFavorite : 0, // Preserve favorite status if requested
    sourceType, // Set source type to track how this drink was logged
  };
  
  const insertResult = await db.insert(drinks).values(newDrink);
  const insertId = insertResult[0].insertId;
  
  // Query the newly created drink by its ID
  const result = await db.select().from(drinks)
    .where(eq(drinks.id, insertId))
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
 * Delete a DEXA scan and all related data (BMD, body comp, images)
 */
export async function deleteDexaScan(scanId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete related data first (foreign key constraints)
  await db.delete(dexaBmdData).where(eq(dexaBmdData.scanId, scanId));
  await db.delete(dexaBodyComp).where(eq(dexaBodyComp.scanId, scanId));
  await db.delete(dexaImages).where(eq(dexaImages.scanId, scanId));
  
  // Delete the scan record
  await db.delete(dexaScans).where(eq(dexaScans.id, scanId));
  
  return { success: true };
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
 * Check password setup token validity with expiry status
 * Returns: { valid: true, expired: false, client } or { valid: false, expired: true/false }
 */
export async function checkPasswordSetupTokenStatus(token: string): Promise<{
  valid: boolean;
  expired: boolean;
  client?: typeof clients.$inferSelect;
}> {
  const db = await getDb();
  if (!db) return { valid: false, expired: false };
  
  // Find client with this token (regardless of expiry)
  const result = await db.select().from(clients)
    .where(eq(clients.passwordSetupToken, token))
    .limit(1);
  
  if (result.length === 0) {
    // Token doesn't exist
    return { valid: false, expired: false };
  }
  
  const client = result[0];
  
  // Check if token has expired
  if (client.passwordSetupTokenExpires && new Date(client.passwordSetupTokenExpires) < new Date()) {
    return { valid: false, expired: true };
  }
  
  // Token is valid and not expired
  return { valid: true, expired: false, client };
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



/**
 * Athlete Monitoring Functions
 */

/**
 * Submit athlete monitoring data (wellness check-in)
 * Validates that only one submission per day is allowed
 * Uses Hong Kong timezone (GMT+8) for date boundaries
 */
export async function submitAthleteMonitoring(data: {
  clientId: number;
  fatigue: number;
  sleepQuality: number;
  muscleSoreness: number;
  stressLevels: number;
  mood: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if client already submitted today (using Hong Kong timezone GMT+8)
  const now = new Date();
  
  // Get current date in Hong Kong timezone
  const hkOffset = 8 * 60; // GMT+8 in minutes
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const hkTime = new Date(utcTime + (hkOffset * 60000));
  
  // Get start of today in HK timezone, then convert to UTC for DB query
  const hkTodayStart = new Date(hkTime);
  hkTodayStart.setHours(0, 0, 0, 0);
  
  // Convert HK midnight back to UTC
  const todayStartUTC = new Date(hkTodayStart.getTime() - (hkOffset * 60000));
  const tomorrowStartUTC = new Date(todayStartUTC.getTime() + (24 * 60 * 60 * 1000));
  
  const todayStr = todayStartUTC.toISOString();
  const tomorrowStr = tomorrowStartUTC.toISOString();
  
  const existing = await db.select().from(athleteMonitoring)
    .where(and(
      eq(athleteMonitoring.clientId, data.clientId),
      sql`${athleteMonitoring.submittedAt} >= ${todayStr}`,
      sql`${athleteMonitoring.submittedAt} < ${tomorrowStr}`
    ))
    .limit(1);
  
  if (existing.length > 0) {
    throw new Error("You have already submitted your wellness check-in today");
  }
  
  const result = await db.insert(athleteMonitoring).values(data);
  return result;
}

/**
 * Get the most recent athlete monitoring submission for a client
 */
export async function getLastAthleteMonitoring(clientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(athleteMonitoring)
    .where(eq(athleteMonitoring.clientId, clientId))
    .orderBy(desc(athleteMonitoring.submittedAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get athlete monitoring trend data for a client within a date range
 */
export async function getAthleteMonitoringTrend(clientId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  // Convert dates to ISO strings for proper SQL comparison
  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();
  
  const result = await db.select().from(athleteMonitoring)
    .where(and(
      eq(athleteMonitoring.clientId, clientId),
      sql`${athleteMonitoring.submittedAt} >= ${startStr}`,
      sql`${athleteMonitoring.submittedAt} <= ${endStr}`
    ))
    .orderBy(asc(athleteMonitoring.submittedAt));
  
  return result;
}

/**
 * Add a strength test result
 */
export async function addStrengthTest(data: {
  clientId: number;
  testType: string;
  value: number;
  unit: string;
  testedAt: Date;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  
  const result = await db.insert(strengthTests).values({
    ...data,
    value: data.value.toString(),
  });
  return result;
}

/**
 * Get the latest strength test for a client by test type
 */
export async function getLatestStrengthTest(clientId: number, testType: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(strengthTests)
    .where(and(
      eq(strengthTests.clientId, clientId),
      eq(strengthTests.testType, testType)
    ))
    .orderBy(desc(strengthTests.testedAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get strength test trend data for a client within a date range
 */
export async function getStrengthTestTrend(
  clientId: number,
  testType: string,
  startDate: Date,
  endDate: Date
) {
  const db = await getDb();
  if (!db) return [];
  
  const allTests = await db.select().from(strengthTests)
    .where(and(
      eq(strengthTests.clientId, clientId),
      eq(strengthTests.testType, testType)
    ))
    .orderBy(asc(strengthTests.testedAt));
  
  const result = allTests.filter(test => {
    const testDate = new Date(test.testedAt);
    return testDate >= startDate && testDate <= endDate;
  });
  
  return result;
}

/**
 * Delete a strength test by ID
 */
export async function deleteStrengthTest(testId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  
  await db.delete(strengthTests).where(eq(strengthTests.id, testId));
}

/**
 * Get all grip strength tests for a client (no date filtering)
 */
export async function getAllGripStrengthTests(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(strengthTests)
    .where(and(
      eq(strengthTests.clientId, clientId),
      eq(strengthTests.testType, 'grip_strength')
    ))
    .orderBy(asc(strengthTests.testedAt));
}

/**
 * Get a strength test by ID
 */
export async function getStrengthTestById(testId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(strengthTests)
    .where(eq(strengthTests.id, testId))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Update a strength test
 */
export async function updateStrengthTest(data: {
  id: number;
  value: number;
  testedAt: Date;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  
  await db.update(strengthTests)
    .set({
      value: data.value.toString(),
      testedAt: data.testedAt,
      notes: data.notes,
    })
    .where(eq(strengthTests.id, data.id));
}

// ============================================================================
// Nutrition Reports
// ============================================================================

/**
 * Create a new nutrition report record
 */
export async function createNutritionReport(data: {
  clientId: number;
  pdfUrl: string;
  pdfFileKey: string;
  filename: string;
  reportDate: Date;
  preparedBy?: string;
  summary?: any;
  uploadedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const result = await db.insert(nutritionReports).values(data);
  return result;
}

/**
 * Get all nutrition reports for a client
 */
export async function getNutritionReportsByClientId(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  return db
    .select()
    .from(nutritionReports)
    .where(eq(nutritionReports.clientId, clientId))
    .orderBy(desc(nutritionReports.reportDate));
}

/**
 * Get a single nutrition report by ID
 */
export async function getNutritionReportById(reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const results = await db
    .select()
    .from(nutritionReports)
    .where(eq(nutritionReports.id, reportId))
    .limit(1);

  return results[0] || null;
}

/**
 * Get the latest nutrition report for a client
 */
export async function getLatestNutritionReport(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const results = await db
    .select()
    .from(nutritionReports)
    .where(eq(nutritionReports.clientId, clientId))
    .orderBy(desc(nutritionReports.reportDate))
    .limit(1);

  return results[0] || null;
}

/**
 * Update nutrition report summary (trainer can edit AI-generated summary)
 */
export async function updateNutritionReportSummary(
  reportId: number,
  updates: {
    goals?: string;
    currentStatus?: string;
    recommendations?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const setData: any = { updatedAt: new Date() };
  if (updates.goals !== undefined) setData.goalsText = updates.goals;
  if (updates.currentStatus !== undefined) setData.currentStatusText = updates.currentStatus;
  if (updates.recommendations !== undefined) setData.recommendationsText = updates.recommendations;

  await db
    .update(nutritionReports)
    .set(setData)
    .where(eq(nutritionReports.id, reportId));
}

/**
 * Delete a nutrition report
 */
export async function deleteNutritionReport(reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db.delete(nutritionReports).where(eq(nutritionReports.id, reportId));
}

// ============================================================================
// VO2 Max Tests
// ============================================================================

/**
 * Create a new VO2 Max test record
 */
export async function createVo2MaxTest(data: {
  clientId: number;
  pdfUrl: string;
  pdfFileKey: string;
  filename: string;
  testDate: Date;
  testAdministrator?: string;
  testLocation?: string;
  uploadedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const result = await db.insert(vo2MaxTests).values(data);
  return result[0].insertId;
}

/**
 * Get all VO2 Max tests for a client, ordered by test date (newest first)
 */
export async function getVo2MaxTestsByClientId(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  return db
    .select()
    .from(vo2MaxTests)
    .where(eq(vo2MaxTests.clientId, clientId))
    .orderBy(desc(vo2MaxTests.testDate));
}

/**
 * Get a single VO2 Max test by ID
 */
export async function getVo2MaxTestById(testId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const results = await db
    .select()
    .from(vo2MaxTests)
    .where(eq(vo2MaxTests.id, testId));
  
  return results[0] || null;
}

/**
 * Delete a VO2 Max test (cascade deletes related data)
 */
export async function deleteVo2MaxTest(testId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db.delete(vo2MaxTests).where(eq(vo2MaxTests.id, testId));
}

/**
 * Create ambient data for a VO2 Max test
 */
export async function createVo2MaxAmbientData(data: {
  testId: number;
  temperature?: string;
  pressure?: number;
  humidity?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db.insert(vo2MaxAmbientData).values(data);
}

/**
 * Get ambient data for a VO2 Max test
 */
export async function getVo2MaxAmbientData(testId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const results = await db
    .select()
    .from(vo2MaxAmbientData)
    .where(eq(vo2MaxAmbientData.testId, testId));
  
  return results[0] || null;
}

/**
 * Create anthropometric data for a VO2 Max test
 */
export async function createVo2MaxAnthropometric(data: {
  testId: number;
  height?: string;
  weight?: string;
  restingHeartRate?: number;
  restingBpSystolic?: number;
  restingBpDiastolic?: number;
  restingLactate?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db.insert(vo2MaxAnthropometric).values(data);
}

/**
 * Get anthropometric data for a VO2 Max test
 */
export async function getVo2MaxAnthropometric(testId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const results = await db
    .select()
    .from(vo2MaxAnthropometric)
    .where(eq(vo2MaxAnthropometric.testId, testId));
  
  return results[0] || null;
}

/**
 * Get all anthropometric data for a client across all tests
 */
export async function getVo2MaxAnthropometricByClientId(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  return db
    .select({
      testId: vo2MaxAnthropometric.testId,
      testDate: vo2MaxTests.testDate,
      height: vo2MaxAnthropometric.height,
      weight: vo2MaxAnthropometric.weight,
      restingHeartRate: vo2MaxAnthropometric.restingHeartRate,
      restingBpSystolic: vo2MaxAnthropometric.restingBpSystolic,
      restingBpDiastolic: vo2MaxAnthropometric.restingBpDiastolic,
      restingLactate: vo2MaxAnthropometric.restingLactate,
    })
    .from(vo2MaxAnthropometric)
    .innerJoin(vo2MaxTests, eq(vo2MaxAnthropometric.testId, vo2MaxTests.id))
    .where(eq(vo2MaxTests.clientId, clientId))
    .orderBy(vo2MaxTests.testDate);
}

/**
 * Create fitness assessment data for a VO2 Max test
 */
export async function createVo2MaxFitnessAssessment(data: {
  testId: number;
  aerobicThresholdLactate?: string;
  aerobicThresholdSpeed?: string;
  aerobicThresholdHr?: number;
  aerobicThresholdHrPct?: number;
  lactateThresholdLactate?: string;
  lactateThresholdSpeed?: string;
  lactateThresholdHr?: number;
  lactateThresholdHrPct?: number;
  maximumLactate?: string;
  maximumSpeed?: string;
  maximumHr?: number;
  maximumHrPct?: number;
  vo2MaxMlKgMin?: string;
  vo2MaxLMin?: string;
  vco2LMin?: string;
  rer?: string;
  rrBrMin?: string;
  veBtpsLMin?: string;
  rpe?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db.insert(vo2MaxFitnessAssessment).values(data);
}

/**
 * Get fitness assessment data for a VO2 Max test
 */
export async function getVo2MaxFitnessAssessment(testId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const results = await db
    .select()
    .from(vo2MaxFitnessAssessment)
    .where(eq(vo2MaxFitnessAssessment.testId, testId));
  
  return results[0] || null;
}

/**
 * Get all fitness assessment data for a client across all tests
 */
export async function getVo2MaxFitnessAssessmentByClientId(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  return db
    .select({
      testId: vo2MaxFitnessAssessment.testId,
      testDate: vo2MaxTests.testDate,
      aerobicThresholdLactate: vo2MaxFitnessAssessment.aerobicThresholdLactate,
      aerobicThresholdSpeed: vo2MaxFitnessAssessment.aerobicThresholdSpeed,
      aerobicThresholdHr: vo2MaxFitnessAssessment.aerobicThresholdHr,
      aerobicThresholdHrPct: vo2MaxFitnessAssessment.aerobicThresholdHrPct,
      lactateThresholdLactate: vo2MaxFitnessAssessment.lactateThresholdLactate,
      lactateThresholdSpeed: vo2MaxFitnessAssessment.lactateThresholdSpeed,
      lactateThresholdHr: vo2MaxFitnessAssessment.lactateThresholdHr,
      lactateThresholdHrPct: vo2MaxFitnessAssessment.lactateThresholdHrPct,
      maximumLactate: vo2MaxFitnessAssessment.maximumLactate,
      maximumSpeed: vo2MaxFitnessAssessment.maximumSpeed,
      maximumHr: vo2MaxFitnessAssessment.maximumHr,
      maximumHrPct: vo2MaxFitnessAssessment.maximumHrPct,
      vo2MaxMlKgMin: vo2MaxFitnessAssessment.vo2MaxMlKgMin,
      vo2MaxLMin: vo2MaxFitnessAssessment.vo2MaxLMin,
      vco2LMin: vo2MaxFitnessAssessment.vco2LMin,
      rer: vo2MaxFitnessAssessment.rer,
      rrBrMin: vo2MaxFitnessAssessment.rrBrMin,
      veBtpsLMin: vo2MaxFitnessAssessment.veBtpsLMin,
      rpe: vo2MaxFitnessAssessment.rpe,
    })
    .from(vo2MaxFitnessAssessment)
    .innerJoin(vo2MaxTests, eq(vo2MaxFitnessAssessment.testId, vo2MaxTests.id))
    .where(eq(vo2MaxTests.clientId, clientId))
    .orderBy(vo2MaxTests.testDate);
}

/**
 * Create lactate profile data points for a VO2 Max test
 */
export async function createVo2MaxLactateProfile(data: Array<{
  testId: number;
  stageNumber: number;
  workloadSpeed: string;
  lactate: string;
  heartRate: number;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  if (data.length > 0) {
    await db.insert(vo2MaxLactateProfile).values(data);
  }
}

/**
 * Get lactate profile data for a VO2 Max test
 */
export async function getVo2MaxLactateProfile(testId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  return db
    .select()
    .from(vo2MaxLactateProfile)
    .where(eq(vo2MaxLactateProfile.testId, testId))
    .orderBy(vo2MaxLactateProfile.stageNumber);
}

/**
 * Update ambient data for a VO2 Max test
 */
export async function updateVo2MaxAmbientData(testId: number, data: {
  temperature?: string;
  pressure?: number;
  humidity?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Use insert with onDuplicateKeyUpdate to handle both create and update
  await db
    .insert(vo2MaxAmbientData)
    .values({ testId, ...data })
    .onDuplicateKeyUpdate({ set: data });
}

/**
 * Update anthropometric data for a VO2 Max test
 */
export async function updateVo2MaxAnthropometric(testId: number, data: {
  height?: string;
  weight?: string;
  restingHr?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Map restingHr to restingHeartRate for database schema
  const dbData: any = {};
  if (data.height !== undefined) dbData.height = data.height;
  if (data.weight !== undefined) dbData.weight = data.weight;
  if (data.restingHr !== undefined) dbData.restingHeartRate = data.restingHr;

  // Use insert with onDuplicateKeyUpdate to handle both create and update
  await db
    .insert(vo2MaxAnthropometric)
    .values({ testId, ...dbData })
    .onDuplicateKeyUpdate({ set: dbData });
}

/**
 * Update fitness assessment data for a VO2 Max test
 */
export async function updateVo2MaxFitnessAssessment(testId: number, data: {
  aerobicThresholdLactate?: string;
  aerobicThresholdSpeed?: string;
  aerobicThresholdHr?: number;
  lactateThresholdLactate?: string;
  lactateThresholdSpeed?: string;
  lactateThresholdHr?: number;
  maximumLactate?: string;
  maximumSpeed?: string;
  maximumHr?: number;
  vo2MaxMlKgMin?: string;
  vo2MaxLMin?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Use insert with onDuplicateKeyUpdate to handle both create and update
  await db
    .insert(vo2MaxFitnessAssessment)
    .values({ testId, ...data })
    .onDuplicateKeyUpdate({ set: data });
}

// ============================================================================
// Trainer Notifications
// ============================================================================

/**
 * Create a trainer notification
 */
export async function createTrainerNotification(notification: InsertTrainerNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const [result] = await db.insert(trainerNotifications).values(notification);
  return result.insertId;
}

/**
 * Get unread notifications for a trainer
 */
export async function getUnreadNotifications(trainerId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(trainerNotifications)
    .where(
      and(
        eq(trainerNotifications.trainerId, trainerId),
        eq(trainerNotifications.isRead, false),
        eq(trainerNotifications.isDismissed, false)
      )
    )
    .orderBy(desc(trainerNotifications.createdAt));
}

/**
 * Get all notifications for a trainer (with pagination)
 */
export async function getTrainerNotifications(trainerId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(trainerNotifications)
    .where(eq(trainerNotifications.trainerId, trainerId))
    .orderBy(desc(trainerNotifications.createdAt))
    .limit(limit);
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db
    .update(trainerNotifications)
    .set({ isRead: true })
    .where(eq(trainerNotifications.id, notificationId));
}

/**
 * Dismiss notification
 */
export async function dismissNotification(notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db
    .update(trainerNotifications)
    .set({ isDismissed: true })
    .where(eq(trainerNotifications.id, notificationId));
}

/**
 * Get or create notification settings for a trainer
 */
export async function getNotificationSettings(trainerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const [settings] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.trainerId, trainerId));

  if (!settings) {
    // Create default settings
    await db.insert(notificationSettings).values({ trainerId });
    const [newSettings] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.trainerId, trainerId));
    return newSettings;
  }

  return settings;
}

/**
 * Update notification settings for a trainer
 */
export async function updateNotificationSettings(
  trainerId: number,
  data: Partial<InsertNotificationSetting>
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db
    .update(notificationSettings)
    .set(data)
    .where(eq(notificationSettings.trainerId, trainerId));
}

/**
 * Check if a similar notification was already sent recently (within 24 hours)
 * to prevent duplicate alerts
 */
export async function hasRecentNotification(
  trainerId: number,
  clientId: number,
  type: "nutrition_deviation" | "wellness_poor_scores",
  hoursAgo: number = 24
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const cutoffDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

  const [result] = await db
    .select()
    .from(trainerNotifications)
    .where(
      and(
        eq(trainerNotifications.trainerId, trainerId),
        eq(trainerNotifications.clientId, clientId),
        eq(trainerNotifications.type, type),
        gte(trainerNotifications.createdAt, cutoffDate)
      )
    )
    .limit(1);

  return !!result;
}

/**
 * Get daily nutrition totals for a client for the last N days
 * Returns data needed for deviation pattern detection
 */
export async function getDailyNutritionTotals(clientId: number, days: number) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Get meals and drinks for the period
  const mealsData = await db
    .select()
    .from(meals)
    .where(
      and(
        eq(meals.clientId, clientId),
        gte(meals.loggedAt, startDate)
      )
    )
    .orderBy(asc(meals.loggedAt));

  const drinksData = await db
    .select()
    .from(drinks)
    .where(
      and(
        eq(drinks.clientId, clientId),
        gte(drinks.loggedAt, startDate)
      )
    )
    .orderBy(asc(drinks.loggedAt));

  // Group by date and calculate totals
  const dailyTotals = new Map<string, {
    date: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fibre: number;
    hydration: number;
  }>();

  // Process meals
  for (const meal of mealsData) {
    const dateKey = meal.loggedAt.toISOString().split('T')[0];
    const existing = dailyTotals.get(dateKey) || {
      date: dateKey,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
      hydration: 0,
    };

    existing.calories += meal.calories || 0;
    existing.protein += meal.protein || 0;
    existing.fat += meal.fat || 0;
    existing.carbs += meal.carbs || 0;
    existing.fibre += meal.fibre || 0;

    dailyTotals.set(dateKey, existing);
  }

  // Process drinks
  for (const drink of drinksData) {
    const dateKey = drink.loggedAt.toISOString().split('T')[0];
    const existing = dailyTotals.get(dateKey) || {
      date: dateKey,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
      hydration: 0,
    };

    existing.calories += drink.calories || 0;
    existing.protein += drink.protein || 0;
    existing.fat += drink.fat || 0;
    existing.carbs += drink.carbs || 0;
    existing.hydration += drink.volumeMl || 0;

    dailyTotals.set(dateKey, existing);
  }

  return Array.from(dailyTotals.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get athlete monitoring scores for the last N days
 * Returns data needed for wellness pattern detection
 */
export async function getAthleteMonitoringScores(clientId: number, days: number) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  return await db
    .select()
    .from(athleteMonitoring)
    .where(
      and(
        eq(athleteMonitoring.clientId, clientId),
        gte(athleteMonitoring.submittedAt, startDate)
      )
    )
    .orderBy(asc(athleteMonitoring.submittedAt));
}

// ============================================================================
// Supplement Template Functions
// ============================================================================

export async function createSupplementTemplate(template: InsertSupplementTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(supplementTemplates).values(template);
  const insertId = result[0].insertId;
  
  // Fetch and return the created template
  const created = await db
    .select()
    .from(supplementTemplates)
    .where(eq(supplementTemplates.id, insertId));
  
  return created[0];
}

export async function getSupplementTemplatesByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(supplementTemplates)
    .where(eq(supplementTemplates.clientId, clientId))
    .orderBy(asc(supplementTemplates.createdAt));
}

export async function updateSupplementTemplate(id: number, updates: { name?: string; dose?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db
    .update(supplementTemplates)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(supplementTemplates.id, id));
}

export async function deleteSupplementTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(supplementTemplates)
    .where(eq(supplementTemplates.id, id));
  
  return { success: true };
}

// ============================================================================
// Supplement Log Functions
// ============================================================================

export async function createSupplementLog(log: InsertSupplementLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(supplementLogs).values(log);
  const insertId = result[0].insertId;
  
  // Fetch and return the created log
  const created = await db
    .select()
    .from(supplementLogs)
    .where(eq(supplementLogs.id, insertId));
  
  return created[0];
}

export async function getSupplementLogsByClient(clientId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(supplementLogs.clientId, clientId)];
  
  if (startDate && endDate) {
    conditions.push(gte(supplementLogs.loggedAt, startDate));
    conditions.push(lte(supplementLogs.loggedAt, endDate));
  }
  
  return db
    .select()
    .from(supplementLogs)
    .where(and(...conditions))
    .orderBy(desc(supplementLogs.loggedAt));
}

export async function deleteSupplementLog(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(supplementLogs)
    .where(eq(supplementLogs.id, id));
  
  return { success: true };
}


// ============================================================================
// Training Sessions & Scheduling
// ============================================================================

/**
 * Create a new training session
 */
export async function createTrainingSession(session: InsertTrainingSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Explicitly construct the insert object to avoid Drizzle type issues
  const insertData: any = {
    trainerId: session.trainerId,
    clientId: session.clientId,
    sessionType: session.sessionType,
    sessionDate: session.sessionDate,
    startTime: session.startTime,
    endTime: session.endTime,
    paymentStatus: session.paymentStatus,
    packageId: session.packageId,
    notes: session.notes,
  };
  
  // Add custom session fields if present
  if (session.customSessionName) insertData.customSessionName = session.customSessionName;
  if (session.customDurationMinutes) insertData.customDurationMinutes = session.customDurationMinutes;
  if (session.customPrice) insertData.customPrice = session.customPrice;
  // Add PAYG payment fields if present
  if (session.sessionFee != null) insertData.sessionFee = session.sessionFee;
  if (session.amountPaid != null) insertData.amountPaid = session.amountPaid;
  if (session.paidAt != null) insertData.paidAt = session.paidAt;
  
  const [result] = await db.insert(trainingSessions).values(insertData);
  return { id: Number(result.insertId), ...session };
}

/**
 * Get all training sessions for a specific client
 */
export async function getTrainingSessionsByClient(clientId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let conditions = [eq(trainingSessions.clientId, clientId), eq(trainingSessions.cancelled, false)];
  
  if (startDate) {
    conditions.push(sql`${trainingSessions.sessionDate} >= ${startDate.toISOString().split('T')[0]}`);
  }
  if (endDate) {
    conditions.push(sql`${trainingSessions.sessionDate} <= ${endDate.toISOString().split('T')[0]}`);
  }
  
  return db
    .select()
    .from(trainingSessions)
    .where(and(...conditions))
    .orderBy(asc(trainingSessions.sessionDate), asc(trainingSessions.startTime));
}

/**
 * Get all trainers (admin users)
 */
export async function getAllTrainers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(users).where(eq(users.role, 'admin'));
}

/**
 * Get all training sessions for a specific trainer
 */
export async function getTrainingSessionsByTrainer(trainerId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let conditions = [eq(trainingSessions.trainerId, trainerId), eq(trainingSessions.cancelled, false)];
  
  if (startDate) {
    conditions.push(sql`${trainingSessions.sessionDate} >= ${startDate.toISOString().split('T')[0]}`);
  }
  if (endDate) {
    conditions.push(sql`${trainingSessions.sessionDate} <= ${endDate.toISOString().split('T')[0]}`);
  }
  
  const sessions = await db
    .select()
    .from(trainingSessions)
    .where(and(...conditions))
    .orderBy(asc(trainingSessions.sessionDate), asc(trainingSessions.startTime));
  
  // Fetch client information for each session
  const sessionsWithClients = await Promise.all(
    sessions.map(async (session) => {
      const [client] = await db
        .select({ id: clients.id, name: clients.name, email: clients.email })
        .from(clients)
        .where(eq(clients.id, session.clientId))
        .limit(1);
      return { ...session, client };
    })
  );
  
  return sessionsWithClients;
}

/**
 * Get a specific training session by ID
 */
export async function getTrainingSessionById(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [session] = await db
    .select()
    .from(trainingSessions)
    .where(eq(trainingSessions.id, sessionId))
    .limit(1);
  
  return session;
}

/**
 * Update a training session
 */
export async function updateTrainingSession(sessionId: number, updates: Partial<InsertTrainingSession>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(trainingSessions)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(trainingSessions.id, sessionId));
  
  return { success: true };
}

/**
 * Cancel a training session (soft delete)
 */
export async function cancelTrainingSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(trainingSessions)
    .set({ cancelled: true, cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(trainingSessions.id, sessionId));
  
  return { success: true };
}

/**
 * Delete a training session (hard delete)
 */
export async function deleteTrainingSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(trainingSessions).where(eq(trainingSessions.id, sessionId));
  return { success: true };
}

// ============================================================================
// Session Packages
// ============================================================================

/**
 * Create a new session package
 */
export async function createSessionPackage(pkg: InsertSessionPackage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(sessionPackages).values(pkg);
  return { id: Number(result.insertId), ...pkg };
}

/**
 * Get all packages for a specific client with dynamic session counts
 */
export async function getSessionPackagesByClient(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const packages = await db
    .select()
    .from(sessionPackages)
    .where(eq(sessionPackages.clientId, clientId))
    .orderBy(desc(sessionPackages.createdAt));
  
  // Calculate sessions used dynamically based on past sessions
  const now = new Date();
  const packagesWithCounts = await Promise.all(
    packages.map(async (pkg) => {
      // Count completed sessions (past date) that used this package
      const completedSessions = await db
        .select({ count: sql<number>`count(*)` })
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.packageId, pkg.id),
            lte(trainingSessions.sessionDate, now),
            sql`${trainingSessions.cancelledAt} IS NULL`
          )
        );
      
      const sessionsUsed = Number(completedSessions[0]?.count || 0);
      const sessionsRemaining = pkg.sessionsTotal - sessionsUsed;
      
      return {
        ...pkg,
        sessionsRemaining,
      };
    })
  );
  
  return packagesWithCounts;
}

/**
 * Get all packages for a specific trainer with client names and dynamic session counts
 */
export async function getSessionPackagesByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const packages = await db
    .select({
      id: sessionPackages.id,
      clientId: sessionPackages.clientId,
      clientName: clients.name,
      trainerId: sessionPackages.trainerId,
      packageType: sessionPackages.packageType,
      sessionsTotal: sessionPackages.sessionsTotal,
      pricePerSession: sessionPackages.pricePerSession,
      purchaseDate: sessionPackages.purchaseDate,
      expiryDate: sessionPackages.expiryDate,
      notes: sessionPackages.notes,
      createdAt: sessionPackages.createdAt,
      updatedAt: sessionPackages.updatedAt,
    })
    .from(sessionPackages)
    .leftJoin(clients, eq(sessionPackages.clientId, clients.id))
    .where(eq(sessionPackages.trainerId, trainerId))
    .orderBy(desc(sessionPackages.createdAt));
  
  // Calculate sessions used dynamically based on past sessions
  const now = new Date();
  const packagesWithCounts = await Promise.all(
    packages.map(async (pkg) => {
      // Count completed sessions (past date) that used this package
      const completedSessions = await db
        .select({ count: sql<number>`count(*)` })
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.packageId, pkg.id),
            lte(trainingSessions.sessionDate, now),
            sql`${trainingSessions.cancelledAt} IS NULL`
          )
        );
      
      const sessionsUsed = Number(completedSessions[0]?.count || 0);
      const sessionsRemaining = pkg.sessionsTotal - sessionsUsed;
      
      return {
        ...pkg,
        sessionsRemaining,
      };
    })
  );
  
  return packagesWithCounts;
}

/**
 * Get a specific package by ID
 */
export async function getSessionPackageById(packageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [pkg] = await db
    .select()
    .from(sessionPackages)
    .where(eq(sessionPackages.id, packageId))
    .limit(1);

  if (!pkg) return undefined;

  // Override the stale column with a dynamic count of non-cancelled sessions
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.packageId, packageId),
        sql`${trainingSessions.cancelledAt} IS NULL`
      )
    );

  const sessionsUsed = Number(row?.count || 0);
  return {
    ...pkg,
    sessionsRemaining: pkg.sessionsTotal - sessionsUsed,
  };
}

/**
 * Checkout a session from a package.
 * Uses a dynamic count of non-cancelled sessions to guard against overbooking.
 * Does NOT write to the sessionsRemaining column — that column is deprecated.
 */
export async function checkoutSessionFromPackage(packageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const pkg = await getSessionPackageById(packageId);
  if (!pkg) throw new Error("Package not found");

  // Count all non-cancelled sessions linked to this package (past and future)
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.packageId, packageId),
        sql`${trainingSessions.cancelledAt} IS NULL`
      )
    );

  const sessionsUsed = Number(row?.count || 0);
  const sessionsRemaining = pkg.sessionsTotal - sessionsUsed;

  if (sessionsRemaining <= 0) throw new Error("No sessions remaining in package");

  // No column write — balance is always derived dynamically
  return { success: true, sessionsRemaining: sessionsRemaining - 1 };
}

/**
 * Update a session package
 */
export async function updateSessionPackage(packageId: number, updates: Partial<InsertSessionPackage>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(sessionPackages)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(sessionPackages.id, packageId));
  
  return { success: true };
}

/**
 * Delete a session package.
 * Only allowed if zero non-cancelled sessions are linked to the package.
 * Throws if sessions exist to prevent accidental data loss.
 */
export async function deleteSessionPackage(packageId: number, trainerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Ownership check
  const [pkg] = await db
    .select({ id: sessionPackages.id, trainerId: sessionPackages.trainerId })
    .from(sessionPackages)
    .where(eq(sessionPackages.id, packageId))
    .limit(1);

  if (!pkg) throw new Error("Package not found");
  if (pkg.trainerId !== trainerId) throw new Error("Not authorised to delete this package");

  // Guard: refuse only if there are future non-cancelled sessions linked to this package.
  // Past sessions are historical records and should not block deletion.
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.packageId, packageId),
        sql`${trainingSessions.cancelledAt} IS NULL`,
        sql`${trainingSessions.sessionDate} >= CURDATE()`
      )
    );

  const futureSessions = Number(row?.count || 0);
  if (futureSessions > 0) {
    throw new Error(
      `Cannot delete: ${futureSessions} upcoming session${futureSessions !== 1 ? 's are' : ' is'} linked to this package. Cancel them first.`
    );
  }

  await db.delete(sessionPackages).where(eq(sessionPackages.id, packageId));
  return { success: true };
}

/**
 * Deduct N sessions from a package's sessionsTotal baseline.
 * Used for trial sessions that were attended before the package was created.
 * Stores an optional note in the package notes field (appended).
 */
export async function deductSessionsFromPackage(
  packageId: number,
  trainerId: number,
  count: number,
  note?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const pkg = await getSessionPackageById(packageId);
  if (!pkg) throw new Error("Package not found");
  if (pkg.trainerId !== trainerId) throw new Error("Not authorised to modify this package");

  const newTotal = pkg.sessionsTotal - count;
  if (newTotal < 0) throw new Error("Cannot deduct more sessions than the package total");

  const existingNotes = pkg.notes || "";
  const deductionNote = note
    ? `[Deducted ${count} session${count !== 1 ? 's' : ''}: ${note}]`
    : `[Deducted ${count} session${count !== 1 ? 's' : ''} on ${new Date().toISOString().split('T')[0]}]`;
  const updatedNotes = existingNotes
    ? `${existingNotes}\n${deductionNote}`
    : deductionNote;

  await db
    .update(sessionPackages)
    .set({ sessionsTotal: newTotal, notes: updatedNotes, updatedAt: new Date() })
    .where(eq(sessionPackages.id, packageId));

  return { success: true, newTotal, sessionsRemaining: newTotal - (pkg.sessionsTotal - pkg.sessionsRemaining) };
}


// ============================================================================
// Group Classes
// ============================================================================

/**
 * Create a new group class
 */
export async function createGroupClass(groupClass: InsertGroupClass) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(groupClasses).values(groupClass);
  return { id: Number(result.insertId), ...groupClass };
}

/**
 * Get all group classes for a trainer
 */
export async function getGroupClassesByTrainer(trainerId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let conditions = [eq(groupClasses.trainerId, trainerId), eq(groupClasses.cancelled, false)];
  
  if (startDate) {
    conditions.push(sql`${groupClasses.classDate} >= ${startDate.toISOString().split('T')[0]}`);
  }
  if (endDate) {
    conditions.push(sql`${groupClasses.classDate} <= ${endDate.toISOString().split('T')[0]}`);
  }
  
  return db
    .select()
    .from(groupClasses)
    .where(and(...conditions))
    .orderBy(asc(groupClasses.classDate), asc(groupClasses.startTime));
}

/**
 * Get a specific group class by ID
 */
export async function getGroupClassById(classId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [groupClass] = await db
    .select()
    .from(groupClasses)
    .where(eq(groupClasses.id, classId))
    .limit(1);
  
  return groupClass;
}

/**
 * Update a group class
 */
export async function updateGroupClass(classId: number, updates: Partial<InsertGroupClass>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(groupClasses)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(groupClasses.id, classId));
  
  return { success: true };
}

/**
 * Cancel a group class (soft delete)
 */
export async function cancelGroupClass(classId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(groupClasses)
    .set({ cancelled: true, cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(groupClasses.id, classId));
  
  return { success: true };
}

/**
 * Delete a group class (hard delete)
 */
export async function deleteGroupClass(classId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(groupClasses).where(eq(groupClasses.id, classId));
  return { success: true };
}

// ============================================================================
// Group Class Attendance
// ============================================================================

/**
 * Add a client to a group class
 */
export async function addClientToGroupClass(attendance: InsertGroupClassAttendance) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if client is already signed up
  const [existing] = await db
    .select()
    .from(groupClassAttendance)
    .where(
      and(
        eq(groupClassAttendance.groupClassId, attendance.groupClassId),
        eq(groupClassAttendance.clientId, attendance.clientId)
      )
    )
    .limit(1);
  
  if (existing) {
    throw new Error("Client is already signed up for this class");
  }
  
  // Check class capacity
  const groupClass = await getGroupClassById(attendance.groupClassId);
  if (!groupClass) throw new Error("Group class not found");
  
  const attendees = await getGroupClassAttendees(attendance.groupClassId);
  if (attendees.length >= groupClass.capacity) {
    throw new Error("Class is at full capacity");
  }
  
  // If payment is from package, checkout from package
  if (attendance.paymentStatus === "from_package" && attendance.packageId) {
    await checkoutSessionFromPackage(attendance.packageId);
  }
  
  const [result] = await db.insert(groupClassAttendance).values(attendance);
  return { id: Number(result.insertId), ...attendance };
}

/**
 * Remove a client from a group class
 */
export async function removeClientFromGroupClass(attendanceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(groupClassAttendance).where(eq(groupClassAttendance.id, attendanceId));
  return { success: true };
}

/**
 * Get all attendees for a group class
 */
export async function getGroupClassAttendees(classId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db
    .select()
    .from(groupClassAttendance)
    .where(eq(groupClassAttendance.groupClassId, classId))
    .orderBy(asc(groupClassAttendance.createdAt));
}

/**
 * Get all group classes for a client
 */
export async function getGroupClassesByClient(clientId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get attendance records for the client
  const attendance = await db
    .select()
    .from(groupClassAttendance)
    .where(eq(groupClassAttendance.clientId, clientId));
  
  if (attendance.length === 0) return [];
  
  const classIds = attendance.map(a => a.groupClassId);
  
  // Get the group classes
  let conditions = [
    sql`${groupClasses.id} IN (${classIds.join(',')})`,
    eq(groupClasses.cancelled, false)
  ];
  
  if (startDate) {
    conditions.push(sql`${groupClasses.classDate} >= ${startDate.toISOString().split('T')[0]}`);
  }
  if (endDate) {
    conditions.push(sql`${groupClasses.classDate} <= ${endDate.toISOString().split('T')[0]}`);
  }
  
  return db
    .select()
    .from(groupClasses)
    .where(and(...conditions))
    .orderBy(asc(groupClasses.classDate), asc(groupClasses.startTime));
}

/**
 * Mark attendance for a client in a group class
 */
export async function markGroupClassAttendance(attendanceId: number, attended: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(groupClassAttendance)
    .set({ attended })
    .where(eq(groupClassAttendance.id, attendanceId));
  
  return { success: true };
}

// Backup log queries
// Returns the most recent backup log entry across all trainers.
// The backup is a single shared system operation, so the status row
// should show the same result to every trainer regardless of who triggered it.
export async function getLastBackupLog(_trainerId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(backupLogs)
    .orderBy(desc(backupLogs.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBackupLog(log: InsertBackupLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(backupLogs).values(log);
}


export async function updateSessionReminderTimestamp(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .update(trainingSessions)
    .set({ lastReminderSentAt: new Date() })
    .where(eq(trainingSessions.id, sessionId));
}


export async function updateGroupClassReminderTimestamp(groupClassId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .update(groupClasses)
    .set({ lastReminderSentAt: new Date() })
    .where(eq(groupClasses.id, groupClassId));
}
