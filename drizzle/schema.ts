import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Clients table - stores gym clients managed by trainers
 * Each client is linked to a trainer (user with role='admin')
 */
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  pin: varchar("pin", { length: 6 }).notNull().unique(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * Nutrition goals table - stores target values for key nutrients per client
 * Editable by trainers only
 */
export const nutritionGoals = mysqlTable("nutrition_goals", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  caloriesTarget: int("caloriesTarget").notNull().default(2000),
  proteinTarget: int("proteinTarget").notNull().default(150), // grams
  fatTarget: int("fatTarget").notNull().default(65), // grams
  carbsTarget: int("carbsTarget").notNull().default(250), // grams
  fibreTarget: int("fibreTarget").notNull().default(25), // grams
  hydrationTarget: int("hydrationTarget").notNull().default(2000), // ml per day
  weightTarget: decimal("weightTarget", { precision: 5, scale: 1 }), // kg (optional target weight)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NutritionGoal = typeof nutritionGoals.$inferSelect;
export type InsertNutritionGoal = typeof nutritionGoals.$inferInsert;

/**
 * Meals table - stores food entries with AI-analyzed nutritional data
 */
export const meals = mysqlTable("meals", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  imageUrl: text("imageUrl").notNull(),
  imageKey: text("imageKey").notNull(),
  mealType: mysqlEnum("mealType", ["breakfast", "lunch", "dinner", "snack"]).notNull(),
  // AI-analyzed nutritional data
  calories: int("calories"),
  protein: int("protein"), // grams
  fat: int("fat"), // grams
  carbs: int("carbs"), // grams
  fibre: int("fibre"), // grams
  // AI analysis metadata
  aiDescription: text("aiDescription"),
  aiConfidence: int("aiConfidence"), // 0-100
  // Nutrition score (1-5)
  nutritionScore: int("nutritionScore"),
  // Manual notes from client
  notes: text("notes"),
  // Optional beverage data
  beverageType: text("beverageType"),
  beverageVolumeMl: int("beverageVolumeMl"),
  beverageCalories: int("beverageCalories"),
  beverageProtein: int("beverageProtein"),
  beverageFat: int("beverageFat"),
  beverageCarbs: int("beverageCarbs"),
  beverageFibre: int("beverageFibre"),
  loggedAt: timestamp("loggedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Meal = typeof meals.$inferSelect;
export type InsertMeal = typeof meals.$inferInsert;

/**
 * Drinks table - manual entries for hydration tracking
 */
export const drinks = mysqlTable("drinks", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  drinkType: varchar("drinkType", { length: 100 }).notNull(), // water, coffee, tea, etc.
  volumeMl: int("volumeMl").notNull(), // volume in milliliters
  // Nutritional data (estimated by AI)
  calories: int("calories").default(0).notNull(),
  protein: int("protein").default(0).notNull(), // grams
  fat: int("fat").default(0).notNull(), // grams
  carbs: int("carbs").default(0).notNull(), // grams
  fibre: int("fibre").default(0).notNull(), // grams
  notes: text("notes"),
  loggedAt: timestamp("loggedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Drink = typeof drinks.$inferSelect;
export type InsertDrink = typeof drinks.$inferInsert;

/**
 * Body metrics table - tracks bodyweight and daily hydration totals
 */
export const bodyMetrics = mysqlTable("body_metrics", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  weight: int("weight"), // in kg (stored as integer, e.g., 75.5kg = 755)
  hydration: int("hydration"), // total ml for the day
  notes: text("notes"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BodyMetric = typeof bodyMetrics.$inferSelect;
export type InsertBodyMetric = typeof bodyMetrics.$inferInsert;
