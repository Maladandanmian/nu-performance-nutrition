import { boolean, date, decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  age: int("age"), // Client age in years
  height: decimal("height", { precision: 4, scale: 1 }), // Client height in cm
  gender: mysqlEnum("gender", ["male", "female", "other"]), // Client gender
  pin: varchar("pin", { length: 72 }).unique(), // 72 chars for bcrypt hash (optional during transition)
  passwordHash: varchar("passwordHash", { length: 72 }), // bcrypt hash for email/password auth
  emailVerified: boolean("emailVerified").default(false).notNull(),
  authMethod: mysqlEnum("authMethod", ["pin", "email", "both"]).default("pin").notNull(),
  // Password setup token for client onboarding
  passwordSetupToken: varchar("passwordSetupToken", { length: 64 }), // Random token sent via email
  passwordSetupTokenExpires: timestamp("passwordSetupTokenExpires"), // Token expiration time
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
 * DEXA goals table - stores target values for DEXA metrics per client
 * Editable by trainers only
 */
export const dexaGoals = mysqlTable("dexa_goals", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }).unique(),
  vatTarget: decimal("vatTarget", { precision: 5, scale: 1 }), // cm² (visceral adipose tissue target)
  bodyFatPctTarget: decimal("bodyFatPctTarget", { precision: 4, scale: 1 }), // % (body fat percentage target)
  leanMassTarget: decimal("leanMassTarget", { precision: 5, scale: 1 }), // kg (lean mass target)
  boneDensityTarget: decimal("boneDensityTarget", { precision: 4, scale: 2 }), // g/cm² (BMD target for key regions)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DexaGoal = typeof dexaGoals.$inferSelect;
export type InsertDexaGoal = typeof dexaGoals.$inferInsert;

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
  beverageCategory: varchar("beverageCategory", { length: 50 }), // Category for scoring (energy_drink, soda, juice_vegetable, etc.)
  // Itemized food components (JSON array)
  components: json("components"),
  // Source of meal entry
  source: mysqlEnum("source", ["meal_photo", "nutrition_label", "text_description"]).default("meal_photo").notNull(),
  // Favorite flag for quick access
  isFavorite: int("isFavorite").default(0).notNull(), // 0 = not favorite, 1 = favorite
  // Source type tracks how this drink was logged (for visual indicators)
  sourceType: mysqlEnum("sourceType", ["manual", "favorite", "repeat"]).default("manual"),
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
  mealId: int("mealId").references(() => meals.id, { onDelete: "cascade" }), // null if standalone drink, links to meal if logged with meal
  drinkType: varchar("drinkType", { length: 100 }).notNull(), // water, coffee, tea, etc.
  volumeMl: int("volumeMl").notNull(), // volume in milliliters
  // Nutritional data (estimated by AI)
  calories: int("calories").default(0).notNull(),
  protein: int("protein").default(0).notNull(), // grams
  fat: int("fat").default(0).notNull(), // grams
  carbs: int("carbs").default(0).notNull(), // grams
  fibre: int("fibre").default(0).notNull(), // grams
  // Nutrition score (1-5)
  nutritionScore: int("nutritionScore"),
  notes: text("notes"),
  // Favorite flag for quick access
  isFavorite: int("isFavorite").default(0).notNull(), // 0 = not favorite, 1 = favorite
  // Source type tracks how this drink was logged (for visual indicators)
  sourceType: mysqlEnum("sourceType", ["manual", "favorite", "repeat"]).default("manual"),
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

/**
 * DEXA scans table - stores uploaded DEXA scan reports
 * Trainer uploads PDF, AI extracts data, trainer reviews/approves before client can view
 */
export const dexaScans = mysqlTable("dexa_scans", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  trainerId: int("trainerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  // PDF storage
  pdfUrl: text("pdfUrl").notNull(),
  pdfKey: text("pdfKey").notNull(),
  // Scan metadata
  scanDate: date("scanDate").notNull(),
  scanId: varchar("scanId", { length: 100 }), // e.g., A0818220D from PDF
  scanType: varchar("scanType", { length: 100 }), // e.g., "a Whole Body"
  scanVersion: varchar("scanVersion", { length: 100 }), // e.g., "13.6.0.5"
  operator: varchar("operator", { length: 100 }),
  model: varchar("model", { length: 100 }), // e.g., "Horizon A"
  // Patient info from scan
  patientHeight: int("patientHeight"), // cm
  patientWeight: int("patientWeight"), // kg (stored as integer, e.g., 59.8kg = 598)
  patientAge: int("patientAge"),
  // Status workflow
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  rejectionReason: text("rejectionReason"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DexaScan = typeof dexaScans.$inferSelect;
export type InsertDexaScan = typeof dexaScans.$inferInsert;

/**
 * DEXA bone mineral density data - regional BMD breakdown
 * One row per body region per scan
 */
export const dexaBmdData = mysqlTable("dexa_bmd_data", {
  id: int("id").autoincrement().primaryKey(),
  scanId: int("scanId").notNull().references(() => dexaScans.id, { onDelete: "cascade" }),
  region: varchar("region", { length: 50 }).notNull(), // L Arm, R Arm, L Ribs, R Ribs, T Spine, L Spine, Pelvis, L Leg, R Leg, Subtotal, Head, Total
  area: decimal("area", { precision: 10, scale: 2 }), // cm²
  bmc: decimal("bmc", { precision: 10, scale: 2 }), // g (Bone Mineral Content)
  bmd: decimal("bmd", { precision: 10, scale: 3 }), // g/cm² (Bone Mineral Density)
  tScore: decimal("tScore", { precision: 5, scale: 2 }), // T-score
  zScore: decimal("zScore", { precision: 5, scale: 2 }), // Z-score
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DexaBmdData = typeof dexaBmdData.$inferSelect;
export type InsertDexaBmdData = typeof dexaBmdData.$inferInsert;

/**
 * DEXA body composition data - fat/lean mass and adipose indices
 * One row per scan with aggregated body composition metrics
 */
export const dexaBodyComp = mysqlTable("dexa_body_comp", {
  id: int("id").autoincrement().primaryKey(),
  scanId: int("scanId").notNull().references(() => dexaScans.id, { onDelete: "cascade" }),
  // Total body metrics
  totalFatMass: int("totalFatMass"), // grams
  totalLeanMass: int("totalLeanMass"), // grams
  totalMass: int("totalMass"), // grams
  totalBodyFatPct: decimal("totalBodyFatPct", { precision: 5, scale: 2 }), // %
  totalBodyFatPctTScore: decimal("totalBodyFatPctTScore", { precision: 5, scale: 2 }),
  totalBodyFatPctZScore: decimal("totalBodyFatPctZScore", { precision: 5, scale: 2 }),
  // Regional fat distribution
  trunkFatMass: int("trunkFatMass"), // grams
  trunkFatPct: decimal("trunkFatPct", { precision: 5, scale: 2 }), // %
  androidFatMass: int("androidFatMass"), // grams
  androidFatPct: decimal("androidFatPct", { precision: 5, scale: 2 }), // %
  gynoidFatMass: int("gynoidFatMass"), // grams
  gynoidFatPct: decimal("gynoidFatPct", { precision: 5, scale: 2 }), // %
  // Adipose indices (KEY METRICS)
  fatMassHeightRatio: decimal("fatMassHeightRatio", { precision: 5, scale: 2 }), // kg/m²
  androidGynoidRatio: decimal("androidGynoidRatio", { precision: 5, scale: 3 }), // A/G ratio
  trunkLegsFatRatio: decimal("trunkLegsFatRatio", { precision: 5, scale: 2 }), // % Fat Trunk / % Fat Legs
  trunkLimbFatMassRatio: decimal("trunkLimbFatMassRatio", { precision: 5, scale: 2 }), // Trunk/Limb Fat Mass Ratio
  // Visceral Adipose Tissue (VAT) - TOP PRIORITY METRICS
  vatMass: int("vatMass"), // grams
  vatVolume: int("vatVolume"), // cm³
  vatArea: decimal("vatArea", { precision: 10, scale: 2 }), // cm² - PRIMARY METRIC
  // Lean indices
  leanMassHeightRatio: decimal("leanMassHeightRatio", { precision: 5, scale: 2 }), // kg/m²
  appendicularLeanMassHeightRatio: decimal("appendicularLeanMassHeightRatio", { precision: 5, scale: 2 }), // kg/m²
  // Limb-specific lean mass (for asymmetry analysis)
  lArmLeanMass: int("lArmLeanMass"), // grams
  rArmLeanMass: int("rArmLeanMass"), // grams
  lLegLeanMass: int("lLegLeanMass"), // grams
  rLegLeanMass: int("rLegLeanMass"), // grams
  trunkLeanMass: int("trunkLeanMass"), // grams
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DexaBodyComp = typeof dexaBodyComp.$inferSelect;
export type InsertDexaBodyComp = typeof dexaBodyComp.$inferInsert;

/**
 * DEXA images - extracted images from PDF (body scans, charts, tables)
 * Stored as PNG files in S3 for display in the app
 */
export const dexaImages = mysqlTable("dexa_images", {
  id: int("id").autoincrement().primaryKey(),
  scanId: int("scanId").notNull().references(() => dexaScans.id, { onDelete: "cascade" }),
  imageType: mysqlEnum("imageType", [
    "body_scan_grayscale",
    "body_scan_colorized",
    "fracture_risk_chart",
    "body_fat_chart",
    "bmd_table",
    "body_comp_table",
    "adipose_indices_table",
  ]).notNull(),
  imageUrl: text("imageUrl").notNull(),
  imageKey: text("imageKey").notNull(),
  pageNumber: int("pageNumber"), // PDF page number where image was extracted
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DexaImage = typeof dexaImages.$inferSelect;
export type InsertDexaImage = typeof dexaImages.$inferInsert;


/**
 * Login attempts table - tracks failed login attempts for rate limiting
 * Used to implement account lockout after too many failed attempts
 */
export const loginAttempts = mysqlTable("login_attempts", {
  id: int("id").autoincrement().primaryKey(),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull(), // IPv6 can be up to 45 chars
  attemptedPin: varchar("attemptedPin", { length: 6 }), // Store last 2 digits only for debugging
  success: boolean("success").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type InsertLoginAttempt = typeof loginAttempts.$inferInsert;

/**
 * Rate limit locks table - tracks IP addresses that are currently locked out
 */
export const rateLimitLocks = mysqlTable("rate_limit_locks", {
  id: int("id").autoincrement().primaryKey(),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull().unique(),
  lockedUntil: timestamp("lockedUntil").notNull(),
  failedAttempts: int("failedAttempts").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RateLimitLock = typeof rateLimitLocks.$inferSelect;
export type InsertRateLimitLock = typeof rateLimitLocks.$inferInsert;

/**
 * Password reset tokens table - stores tokens for password reset flow
 */
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * Audit logs table - tracks important actions for security and compliance
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  // Actor information
  actorType: mysqlEnum("actorType", ["client", "trainer", "system"]).notNull(),
  actorId: int("actorId"), // client or user ID
  // Action details
  action: varchar("action", { length: 100 }).notNull(), // e.g., "login", "logout", "view_dexa", "update_meal"
  resourceType: varchar("resourceType", { length: 50 }), // e.g., "client", "meal", "dexa_scan"
  resourceId: int("resourceId"),
  // Context
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  details: text("details"), // JSON string with additional context
  // Result
  success: boolean("success").default(true).notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Email verification tokens table - stores tokens for email verification
 */
export const emailVerificationTokens = mysqlTable("email_verification_tokens", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;

/**
 * Athlete Monitoring table - stores daily wellness check-ins
 * Tracks fatigue, sleep quality, muscle soreness, stress levels, and mood
 * Clients can submit once per day
 */
export const athleteMonitoring = mysqlTable("athlete_monitoring", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  // Wellness metrics (1-5 scale)
  fatigue: int("fatigue").notNull(), // 1=Always tired, 5=Very fresh
  sleepQuality: int("sleepQuality").notNull(), // 1=Insomnia, 5=Very restful
  muscleSoreness: int("muscleSoreness").notNull(), // 1=Very sore, 5=Feeling good
  stressLevels: int("stressLevels").notNull(), // 1=Very stressed, 5=Very relaxed
  mood: int("mood").notNull(), // 1=Highly annoyed/irritable/down, 5=Very positive mood
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
});

export type AthleteMonitoring = typeof athleteMonitoring.$inferSelect;
export type InsertAthleteMonitoring = typeof athleteMonitoring.$inferInsert;

/**
 * Strength Tests table - stores various strength test results
 * Only trainers can enter data, clients can view their results
 */
export const strengthTests = mysqlTable("strength_tests", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  testType: varchar("testType", { length: 50 }).notNull(), // e.g., "grip_strength", "bench_press", etc.
  value: decimal("value", { precision: 6, scale: 2 }).notNull(), // Test result value (e.g., kg for grip strength)
  unit: varchar("unit", { length: 20 }).notNull(), // e.g., "kg", "lbs", "reps"
  notes: text("notes"), // Optional notes from trainer
  testedAt: timestamp("testedAt").notNull(), // When the test was performed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StrengthTest = typeof strengthTests.$inferSelect;
export type InsertStrengthTest = typeof strengthTests.$inferInsert;
