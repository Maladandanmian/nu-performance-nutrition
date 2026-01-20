import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users,
  InsertClient, clients,
  InsertNutritionGoal, nutritionGoals,
  InsertMeal, meals,
  InsertDrink, drinks,
  InsertBodyMetric, bodyMetrics
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

export async function getClientByPIN(pin: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.pin, pin)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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

// Body metrics queries
export async function createBodyMetric(metric: InsertBodyMetric) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Build insert object with only provided fields
  const convertedMetric: any = {
    clientId: metric.clientId,
    recordedAt: metric.recordedAt || new Date(),
  };
  
  // Only include optional fields if they have values
  if (metric.weight) {
    convertedMetric.weight = Math.round(metric.weight * 10);
  }
  if (metric.hydration) {
    convertedMetric.hydration = metric.hydration;
  }
  if (metric.notes) {
    convertedMetric.notes = metric.notes;
  }
  
  return db.insert(bodyMetrics).values(convertedMetric);
}

export async function getBodyMetricsByClientId(clientId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bodyMetrics).where(eq(bodyMetrics.clientId, clientId)).orderBy(bodyMetrics.recordedAt).limit(limit);
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
