import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, authenticatedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";
import { analyzeMealImage, calculateNutritionScore } from "./qwenVision";
// sharp removed - not used in this file
import { calculateScoreBreakdown, generateImprovementAdvice } from "./improvementAdvice";
import { estimateBeverageNutrition } from "./beverageNutrition";
import { reEstimateComponentNutrition } from "./componentReEstimation";
import { estimateFoodNutrition } from "./foodQuantityEstimation";
import { identifyMealItems } from "./mealItemIdentification";
import { analyzeMealNutrition } from "./mealNutritionAnalysis";
import { emailAuthRouter } from "./emailAuthProcedures";
import { logLogin, logFailedLogin, getIPFromRequest, getUserAgentFromRequest } from "./auditLog";
import { sendPasswordSetupInvitation } from "./emailService";
import { hashPIN } from "./pinAuth";

// Admin-only procedure for trainers
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only trainers can access this resource' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  emailAuth: emailAuthRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    clientSession: publicProcedure.query(({ ctx }) => {
      console.log('[clientSession] Checking session...');
      
      // First, try to get from cookie
      const clientCookie = ctx.req.cookies?.['client_session'];
      if (clientCookie) {
        console.log('[clientSession] Found cookie');
        try {
          const decoded = JSON.parse(Buffer.from(clientCookie, 'base64').toString());
          return {
            clientId: decoded.clientId,
            name: decoded.name,
          };
        } catch (e) {
          console.log('[clientSession] Failed to decode cookie');
        }
      }
      
      // Fallback: try to get from X-Client-Session header
      const sessionHeader = ctx.req.headers['x-client-session'] as string | undefined;
      if (sessionHeader) {
        console.log('[clientSession] Found header');
        try {
          const decoded = JSON.parse(Buffer.from(sessionHeader, 'base64').toString());
          return {
            clientId: decoded.clientId,
            name: decoded.name,
          };
        } catch (e) {
          console.log('[clientSession] Failed to decode header');
        }
      }
      
      console.log('[clientSession] No session found');
      return null;
    }),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie('client_session', { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    
    logoutClient: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie('client_session', { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    
    loginWithPIN: publicProcedure
      .input(z.object({
        pin: z.string().length(6),
      }))
      .mutation(async ({ ctx, input }) => {
        const { isValidPIN } = await import("./pinAuth");
        const { checkRateLimit, recordLoginAttempt, getClientIP } = await import("./rateLimit");
        
        // Get client IP for rate limiting
        const clientIP = getClientIP(ctx.req);
        
        // Check if IP is rate limited
        const rateLimitStatus = await checkRateLimit(clientIP);
        if (rateLimitStatus.isLocked) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: `Too many failed login attempts. Please try again in ${rateLimitStatus.remainingMinutes} minutes.`,
          });
        }
        
        if (!isValidPIN(input.pin)) {
          await recordLoginAttempt(clientIP, false, input.pin);
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid PIN format' });
        }
        
        const client = await db.getClientByPIN(input.pin);
        if (!client) {
          await recordLoginAttempt(clientIP, false, input.pin);
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid PIN' });
        }
        
        // Record successful login
        await recordLoginAttempt(clientIP, true, input.pin);
        
        // Create a session cookie for the client
        // Store client ID in a simple session cookie
        const sessionData = JSON.stringify({
          clientId: client.id,
          name: client.name,
          type: 'client',
          timestamp: Date.now(),
        });
        
        const cookieOptions = getSessionCookieOptions(ctx.req);
        const cookieValue = Buffer.from(sessionData).toString('base64');
        console.log('[loginWithPIN] Setting cookie with options:', { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
        console.log('[loginWithPIN] Cookie value:', cookieValue);
        ctx.res.cookie('client_session', cookieValue, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          httpOnly: true,
          secure: cookieOptions.secure,
          sameSite: cookieOptions.sameSite,
        });
        
        return {
          success: true,
          client: {
            id: client.id,
            name: client.name,
          },
          // Return the session token so client can store it in localStorage as fallback
          sessionToken: cookieValue,
        };
      }),
  }),

  // Client management (trainer only)
  clients: router({
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(), // Required for new clients
        phone: z.string().optional(),
        notes: z.string().optional(),
        pin: z.string().length(6).regex(/^\d{6}$/, "PIN must be 6 digits").optional(), // Optional for backward compat
      }))
      .mutation(async ({ ctx, input }) => {
        const { pin, ...clientData } = input;
        
        // Check if email already exists for this trainer
        const existingClientByEmail = await db.getClientByEmail(clientData.email);
        if (existingClientByEmail) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'A client with this email already exists.' });
        }
        
        // If PIN is provided, validate it
        let hashedPin: string | undefined;
        if (pin) {
          // Check if PIN already exists
          const existingClient = await db.getClientByPIN(pin);
          if (existingClient) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'This PIN is already in use. Please choose a different PIN.' });
          }
          // Hash the PIN before storing
          hashedPin = await hashPIN(pin);
        }
        
        const result = await db.createClient({
          trainerId: ctx.user.id,
          pin: hashedPin,
          ...clientData,
        });
        
        // Create default nutrition goals for new client
        const clientId = Number(result[0].insertId);
        await db.createNutritionGoal({
          clientId,
          caloriesTarget: 2000,
          proteinTarget: 150,
          fatTarget: 65,
          carbsTarget: 250,
          fibreTarget: 25,
          hydrationTarget: 2000,
        });
        
        // Generate password setup token and send invitation email
        // Wrap in try-catch to prevent mutation failure if email sending fails
        let emailSent = false;
        let token = '';
        try {
          token = await db.generatePasswordSetupToken(clientId);
          emailSent = await sendPasswordSetupInvitation(
            clientData.email,
            clientData.name,
            token
          );
        } catch (emailError) {
          console.error(`[ClientInvitation] Error sending email to ${clientData.email}:`, emailError);
        }
        
        if (!emailSent) {
          console.warn(`[ClientInvitation] Failed to send email to ${clientData.email}. Token: ${token}`);
        }
        
        return { success: true, clientId, pin, invitationSent: emailSent };
      }),

    list: adminProcedure.query(async ({ ctx }) => {
      return db.getClientsByTrainerId(ctx.user.id);
    }),

    get: adminProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getClientById(input.clientId);
      }),

    update: adminProcedure
      .input(z.object({
        clientId: z.number(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { clientId, ...data } = input;
        await db.updateClient(clientId, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ clientId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteClient(input.clientId);
        return { success: true };
      }),
  }),

  // Nutrition goals (accessible to both trainers and clients)
  nutritionGoals: router({
    get: authenticatedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getNutritionGoalByClientId(input.clientId);
      }),

    update: adminProcedure
      .input(z.object({
        clientId: z.number(),
        caloriesTarget: z.number().optional(),
        proteinTarget: z.number().optional(),
        fatTarget: z.number().optional(),
        carbsTarget: z.number().optional(),
        fibreTarget: z.number().optional(),
        hydrationTarget: z.number().optional(),
        weightTarget: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { clientId, weightTarget, ...data } = input;
        const updateData = {
          ...data,
          ...(weightTarget !== undefined && { weightTarget: weightTarget.toString() }),
        };
        await db.updateNutritionGoal(clientId, updateData);
        return { success: true };
      }),
  }),

  // Meals (client-facing, but we'll need client association)
  meals: router({
    uploadAndAnalyze: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        imageBase64: z.string(),
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
        notes: z.string().optional(),
        // Optional beverage data
        beverageType: z.string().optional(),
        beverageVolumeMl: z.number().optional(),
        beverageCalories: z.number().optional(),
        beverageProtein: z.number().optional(),
        beverageFat: z.number().optional(),
        beverageCarbs: z.number().optional(),
        beverageFibre: z.number().optional(),
        beverageCategory: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          // 1. Upload image to S3
          const imageBuffer = Buffer.from(input.imageBase64, 'base64');
          const randomSuffix = Math.random().toString(36).substring(7);
          const imageKey = `meals/${input.clientId}/${Date.now()}-${randomSuffix}.jpg`;
          const { url: imageUrl } = await storagePut(imageKey, imageBuffer, "image/jpeg");

          // 2. Analyze image with Qwen-VL
          const analysis = await analyzeMealImage(imageUrl);

          // 3. Get client's nutrition goals
          const goals = await db.getNutritionGoalByClientId(input.clientId);
          if (!goals) {
            throw new TRPCError({ 
              code: 'NOT_FOUND', 
              message: 'Nutrition goals not found for this client' 
            });
          }

          // 4. Calculate today's totals (before this meal)
          const allMeals = await db.getMealsByClientId(input.clientId);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const todaysMeals = allMeals.filter(meal => {
            const mealDate = new Date(meal.loggedAt);
            mealDate.setHours(0, 0, 0, 0);
            return mealDate.getTime() === today.getTime();
          });
          
          const todaysTotals = todaysMeals.reduce(
            (totals, meal) => ({
              calories: totals.calories + (meal.calories || 0) + (meal.beverageCalories || 0),
              protein: totals.protein + (meal.protein || 0) + (meal.beverageProtein || 0),
              fat: totals.fat + (meal.fat || 0) + (meal.beverageFat || 0),
              carbs: totals.carbs + (meal.carbs || 0) + (meal.beverageCarbs || 0),
              fibre: totals.fibre + (meal.fibre || 0) + (meal.beverageFibre || 0),
            }),
            { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }
          );

          // 5. Calculate nutrition score with quality + progress (use current time)
          const score = calculateNutritionScore(
            {
              calories: analysis.calories,
              protein: analysis.protein,
              fat: analysis.fat,
              carbs: analysis.carbs,
              fibre: analysis.fibre,
            },
            goals,
            todaysTotals,
            new Date() // Use current time for analysis
          );

          // Return analysis results (meal will be saved separately after user confirms/edits)
          return {
            success: true,
            imageUrl,
            imageKey,
            analysis: {
              description: analysis.description,
              calories: analysis.calories,
              protein: analysis.protein,
              fat: analysis.fat,
              carbs: analysis.carbs,
              fibre: analysis.fibre,
              confidence: analysis.confidence,
              referenceCardDetected: analysis.referenceCardDetected,
              score,
              components: (analysis as any).components || [],
              validationWarnings: (analysis as any).validationWarnings || [],
              // Include beverage data if provided
              beverageType: input.beverageType,
              beverageVolumeMl: input.beverageVolumeMl,
              beverageCalories: input.beverageCalories,
              beverageProtein: input.beverageProtein,
              beverageFat: input.beverageFat,
              beverageCarbs: input.beverageCarbs,
              beverageFibre: input.beverageFibre,
              beverageCategory: input.beverageCategory,
            },
          };
        } catch (error) {
          console.error('Error in uploadAndAnalyze:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to analyze meal',
          });
        }
      }),

    saveMeal: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        imageUrl: z.string().optional(),
        imageKey: z.string().optional(),
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
        calories: z.number(),
        protein: z.number(),
        fat: z.number(),
        carbs: z.number(),
        fibre: z.number(),
        aiDescription: z.string(),
        aiConfidence: z.number(),
        notes: z.string().optional(),
        // Optional beverage data
        beverageType: z.string().optional(),
        beverageVolumeMl: z.number().optional(),
        beverageCalories: z.number().optional(),
        beverageProtein: z.number().optional(),
        beverageFat: z.number().optional(),
        beverageCarbs: z.number().optional(),
        beverageFibre: z.number().optional(),
        beverageCategory: z.string().optional(),
        components: z.array(z.object({
          name: z.string(),
          calories: z.number(),
          protein: z.number(),
          fat: z.number(),
          carbs: z.number(),
          fibre: z.number(),
        })).optional(),
        // Source of meal entry
        source: z.enum(["meal_photo", "nutrition_label", "text_description"]).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Get client's nutrition goals for scoring
          const goals = await db.getNutritionGoalByClientId(input.clientId);
          if (!goals) {
            throw new TRPCError({ 
              code: 'NOT_FOUND', 
              message: 'Nutrition goals not found for this client' 
            });
          }

          // Calculate today's totals (before this meal)
          const allMeals = await db.getMealsByClientId(input.clientId);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const todaysMeals = allMeals.filter(meal => {
            const mealDate = new Date(meal.loggedAt);
            mealDate.setHours(0, 0, 0, 0);
            return mealDate.getTime() === today.getTime();
          });
          
          const todaysTotals = todaysMeals.reduce(
            (totals, meal) => ({
              calories: totals.calories + (meal.calories || 0) + (meal.beverageCalories || 0),
              protein: totals.protein + (meal.protein || 0) + (meal.beverageProtein || 0),
              fat: totals.fat + (meal.fat || 0) + (meal.beverageFat || 0),
              carbs: totals.carbs + (meal.carbs || 0) + (meal.beverageCarbs || 0),
              fibre: totals.fibre + (meal.fibre || 0) + (meal.beverageFibre || 0),
            }),
            { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }
          );

          // Calculate nutrition score (include beverage if present)
          const totalNutrition = {
            calories: input.calories + (input.beverageCalories || 0),
            protein: input.protein + (input.beverageProtein || 0),
            fat: input.fat + (input.beverageFat || 0),
            carbs: input.carbs + (input.beverageCarbs || 0),
            fibre: input.fibre + (input.beverageFibre || 0),
          };
          
          const score = calculateNutritionScore(
            totalNutrition,
            goals,
            todaysTotals,
            new Date() // Use current time (loggedAt not available in this procedure)
          );

          // Save meal to database
          console.log('[saveMeal] Components being saved:', JSON.stringify(input.components));
          const result = await db.createMeal({
            clientId: input.clientId,
            imageUrl: input.imageUrl || "",
            imageKey: input.imageKey || "",
            mealType: input.mealType,
            calories: input.calories,
            protein: input.protein,
            fat: input.fat,
            carbs: input.carbs,
            fibre: input.fibre,
            aiDescription: input.aiDescription,
            aiConfidence: input.aiConfidence,
            nutritionScore: score,
            notes: input.notes,
            // Optional beverage data
            beverageType: input.beverageType,
            beverageVolumeMl: input.beverageVolumeMl,
            beverageCalories: input.beverageCalories,
            beverageProtein: input.beverageProtein,
            beverageFat: input.beverageFat,
            beverageCarbs: input.beverageCarbs,
            beverageFibre: input.beverageFibre,
            beverageCategory: input.beverageCategory,
            // Itemized food components
            components: input.components,
            // Source of meal entry
            source: input.source || "meal_photo",
            loggedAt: new Date(),
          });

          // If beverage is included, create body_metrics entry for hydration tracking
          // Note: We do NOT create a separate drink entry because the beverage data
          // is already stored in the meal's beverage fields (beverageType, beverageVolumeMl, etc.)
          if (input.beverageType && input.beverageVolumeMl) {
            await db.createBodyMetric({
              clientId: input.clientId,
              hydration: input.beverageVolumeMl,
              recordedAt: new Date(),
            });
          }

          return {
            success: true,
            mealId: Number(result[0].insertId),
            score,
          };
        } catch (error) {
          console.error('Error in saveMeal:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to save meal',
          });
        }
      }),

    estimateBeverage: authenticatedProcedure
      .input(z.object({
        drinkType: z.string(),
        volumeMl: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          const nutrition = await estimateBeverageNutrition(input.drinkType, input.volumeMl);
          return {
            success: true,
            nutrition,
          };
        } catch (error) {
          console.error('Error in estimateBeverage:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to estimate beverage nutrition',
          });
        }
      }),

    getImprovementAdvice: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        mealDescription: z.string(),
        components: z.array(z.object({
          name: z.string(),
          calories: z.number(),
          protein: z.number(),
          fat: z.number(),
          carbs: z.number(),
          fibre: z.number(),
        })),
        calories: z.number(),
        protein: z.number(),
        fat: z.number(),
        carbs: z.number(),
        fibre: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Get client's nutrition goals
          const goals = await db.getNutritionGoalByClientId(input.clientId);
          if (!goals) {
            throw new TRPCError({ 
              code: 'NOT_FOUND', 
              message: 'Nutrition goals not found for this client' 
            });
          }

          // Calculate today's totals (before this meal)
          const allMeals = await db.getMealsByClientId(input.clientId);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const todaysMeals = allMeals.filter(meal => {
            const mealDate = new Date(meal.loggedAt);
            mealDate.setHours(0, 0, 0, 0);
            return mealDate.getTime() === today.getTime();
          });
          
          const todaysTotals = todaysMeals.reduce(
            (totals, meal) => ({
              calories: totals.calories + (meal.calories || 0) + (meal.beverageCalories || 0),
              protein: totals.protein + (meal.protein || 0) + (meal.beverageProtein || 0),
              fat: totals.fat + (meal.fat || 0) + (meal.beverageFat || 0),
              carbs: totals.carbs + (meal.carbs || 0) + (meal.beverageCarbs || 0),
              fibre: totals.fibre + (meal.fibre || 0) + (meal.beverageFibre || 0),
            }),
            { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }
          );

          const actual = {
            calories: input.calories,
            protein: input.protein,
            fat: input.fat,
            carbs: input.carbs,
            fibre: input.fibre,
          };

          // Calculate score breakdown
          const scoreBreakdown = calculateScoreBreakdown(actual, goals, todaysTotals);

          // Generate personalized advice
          const advice = await generateImprovementAdvice(
            input.mealDescription,
            input.components,
            actual,
            goals,
            todaysTotals,
            scoreBreakdown
          );

          return {
            success: true,
            advice,
            scoreBreakdown,
          };
        } catch (error) {
          console.error('Error in getImprovementAdvice:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to generate advice',
          });
        }
      }),

    list: authenticatedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getMealsByClientId(input.clientId);
      }),

    dailyTotals: authenticatedProcedure
      .input(z.object({ 
        clientId: z.number(),
        days: z.number().default(30), // Last N days
        timezoneOffset: z.number().optional() // Client timezone offset in minutes (e.g., -480 for UTC+8)
      }))
      .query(async ({ input }) => {
        const meals = await db.getMealsByClientId(input.clientId);
        const goals = await db.getNutritionGoalByClientId(input.clientId);
        
        // Get drinks for hydration data
        const drinks = await db.getDrinksByClientId(input.clientId);
        
        // Group meals by date and sum nutrients
        const dailyMap = new Map<string, {
          date: string;
          calories: number;
          protein: number;
          fat: number;
          carbs: number;
          fibre: number;
          hydration: number;
        }>();
        
        // Calculate date range in client's timezone
        const now = new Date();
        const timezoneOffset = input.timezoneOffset ?? 0; // Default to UTC if not provided
        
        // Get current time in client timezone
        const clientNow = new Date(now.getTime() - (timezoneOffset * 60 * 1000));
        
        // Start of today in client timezone (converted to UTC)
        const startOfTodayClient = new Date(Date.UTC(
          clientNow.getUTCFullYear(),
          clientNow.getUTCMonth(),
          clientNow.getUTCDate()
        ));
        
        // Add timezone offset back to get UTC cutoff
        const cutoffDate = new Date(startOfTodayClient.getTime() + (timezoneOffset * 60 * 1000));
        cutoffDate.setUTCDate(cutoffDate.getUTCDate() - (input.days - 1)); // -1 because we want to include today
        
        meals.forEach(meal => {
          const mealDate = new Date(meal.loggedAt);
          if (mealDate < cutoffDate) return;
          
          // Group by date in client timezone
          const mealInClientTZ = new Date(mealDate.getTime() - (timezoneOffset * 60 * 1000));
          const dateKey = new Date(Date.UTC(
            mealInClientTZ.getUTCFullYear(),
            mealInClientTZ.getUTCMonth(),
            mealInClientTZ.getUTCDate()
          )).toISOString().split('T')[0];
          const existing = dailyMap.get(dateKey) || {
            date: dateKey,
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
            fibre: 0,
            hydration: 0,
          };
          
          // Sum meal nutrients
          existing.calories += meal.calories || 0;
          existing.protein += meal.protein || 0;
          existing.fat += meal.fat || 0;
          existing.carbs += meal.carbs || 0;
          existing.fibre += meal.fibre || 0;
          
          // Sum beverage nutrients (if present)
          existing.calories += meal.beverageCalories || 0;
          existing.protein += meal.beverageProtein || 0;
          existing.fat += meal.beverageFat || 0;
          existing.carbs += meal.beverageCarbs || 0;
          existing.fibre += meal.beverageFibre || 0;
          
          // Add beverage volume to hydration
          existing.hydration += meal.beverageVolumeMl || 0;
          
          dailyMap.set(dateKey, existing);
        });
        
        // Add hydration and nutrition data from drinks table
        // Skip drinks that are linked to meals (mealId != null) to avoid double-counting
        drinks.forEach(drink => {
          if (drink.mealId) return; // Skip drinks logged with meals
          const drinkDate = new Date(drink.loggedAt);
          if (drinkDate < cutoffDate) return;
          
          const drinkDateUTC = new Date(drinkDate.getTime() - (timezoneOffset * 60 * 1000));
          const dateKey = new Date(Date.UTC(
            drinkDateUTC.getUTCFullYear(),
            drinkDateUTC.getUTCMonth(),
            drinkDateUTC.getUTCDate()
          )).toISOString().split('T')[0];
          
          const existing = dailyMap.get(dateKey) || {
            date: dateKey,
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
            fibre: 0,
            hydration: 0,
          };
          
          // Add drink hydration
          existing.hydration += drink.volumeMl;
          
          // Add drink nutrition (if available)
          existing.calories += drink.calories || 0;
          existing.protein += drink.protein || 0;
          existing.fat += drink.fat || 0;
          existing.carbs += drink.carbs || 0;
          existing.fibre += drink.fibre || 0;
          
          dailyMap.set(dateKey, existing);
        });
        
        // Convert to array and sort by date
        const dailyTotals = Array.from(dailyMap.values())
          .sort((a, b) => a.date.localeCompare(b.date));
        
        return {
          dailyTotals,
          goals: {
            calories: goals?.caloriesTarget || 0,
            protein: goals?.proteinTarget || 0,
            fat: goals?.fatTarget || 0,
            carbs: goals?.carbsTarget || 0,
            fibre: goals?.fibreTarget || 0,
            hydration: goals?.hydrationTarget || 0,
            weightTarget: goals?.weightTarget || null,
          },
        };
      }),

    estimateFood: authenticatedProcedure
      .input(z.object({
        foodName: z.string(),
        quantity: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const nutrition = await estimateFoodNutrition(
            input.foodName,
            input.quantity
          );
          return {
            success: true,
            nutrition,
          };
        } catch (error) {
          console.error('Error in estimateFood:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to estimate food nutrition',
          });
        }
      }),

    recalculateScore: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        calories: z.number(),
        protein: z.number(),
        fat: z.number(),
        carbs: z.number(),
        fibre: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Get client's nutrition goals
          const goals = await db.getNutritionGoalByClientId(input.clientId);
          if (!goals) {
            throw new TRPCError({ 
              code: 'NOT_FOUND', 
              message: 'Nutrition goals not found for this client' 
            });
          }

          // Calculate today's totals (before this meal)
          const allMeals = await db.getMealsByClientId(input.clientId);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const todaysMeals = allMeals.filter(meal => {
            const mealDate = new Date(meal.loggedAt);
            mealDate.setHours(0, 0, 0, 0);
            return mealDate.getTime() === today.getTime();
          });
          
          const todaysTotals = todaysMeals.reduce(
            (totals, meal) => ({
              calories: totals.calories + (meal.calories || 0) + (meal.beverageCalories || 0),
              protein: totals.protein + (meal.protein || 0) + (meal.beverageProtein || 0),
              fat: totals.fat + (meal.fat || 0) + (meal.beverageFat || 0),
              carbs: totals.carbs + (meal.carbs || 0) + (meal.beverageCarbs || 0),
              fibre: totals.fibre + (meal.fibre || 0) + (meal.beverageFibre || 0),
            }),
            { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }
          );

          // Calculate nutrition score with quality + progress
          const score = calculateNutritionScore(
            {
              calories: input.calories,
              protein: input.protein,
              fat: input.fat,
              carbs: input.carbs,
              fibre: input.fibre,
            },
            goals,
            todaysTotals,
            new Date() // Use current time (loggedAt not available in this procedure)
          );

          return {
            success: true,
            score,
          };
        } catch (error) {
          console.error('Error in recalculateScore:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to recalculate score',
          });
        }
      }),

    reEstimateComponent: authenticatedProcedure
      .input(z.object({
        componentName: z.string(),
        imageUrl: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const nutrition = await reEstimateComponentNutrition(
            input.componentName,
            input.imageUrl
          );
          return {
            success: true,
            nutrition,
          };
        } catch (error) {
          console.error('Error in reEstimateComponent:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to re-estimate component nutrition',
          });
        }
      }),

    get: protectedProcedure
      .input(z.object({ mealId: z.number() }))
      .query(async ({ input }) => {
        return db.getMealById(input.mealId);
      }),

    delete: authenticatedProcedure
      .input(z.object({ mealId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteMeal(input.mealId);
        return { success: true };
      }),

    update: authenticatedProcedure
      .input(z.object({
        mealId: z.number(),
        clientId: z.number(),
        imageUrl: z.string().optional(),
        imageKey: z.string().optional(),
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
        calories: z.number(),
        protein: z.number(),
        fat: z.number(),
        carbs: z.number(),
        fibre: z.number(),
        aiDescription: z.string(),
        aiConfidence: z.number().optional(),
        notes: z.string().optional(),
        loggedAt: z.date().optional(),
        beverageType: z.string().optional(),
        beverageVolumeMl: z.number().optional(),
        beverageCalories: z.number().optional(),
        beverageProtein: z.number().optional(),
        beverageFat: z.number().optional(),
        beverageCarbs: z.number().optional(),
        beverageFibre: z.number().optional(),
        beverageCategory: z.string().optional(),
        components: z.array(z.object({
          name: z.string(),
          calories: z.number(),
          protein: z.number(),
          fat: z.number(),
          carbs: z.number(),
          fibre: z.number(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Get client's nutrition goals for scoring
          const goals = await db.getNutritionGoalByClientId(input.clientId);
          if (!goals) {
            throw new TRPCError({ 
              code: 'NOT_FOUND', 
              message: 'Nutrition goals not found for this client' 
            });
          }

          // Get the original meal to find its date
          const originalMeal = await db.getMealById(input.mealId);
          if (!originalMeal) {
            throw new TRPCError({ 
              code: 'NOT_FOUND', 
              message: 'Meal not found' 
            });
          }

          // Calculate that day's totals (excluding the meal being edited)
          const allMeals = await db.getMealsByClientId(input.clientId);
          const mealDate = new Date(originalMeal.loggedAt);
          mealDate.setHours(0, 0, 0, 0);
          
          const dayMeals = allMeals.filter(meal => {
            if (meal.id === input.mealId) return false; // Exclude current meal
            const mDate = new Date(meal.loggedAt);
            mDate.setHours(0, 0, 0, 0);
            return mDate.getTime() === mealDate.getTime();
          });
          
          const dayTotals = dayMeals.reduce(
            (totals, meal) => ({
              calories: totals.calories + (meal.calories || 0) + (meal.beverageCalories || 0),
              protein: totals.protein + (meal.protein || 0) + (meal.beverageProtein || 0),
              fat: totals.fat + (meal.fat || 0) + (meal.beverageFat || 0),
              carbs: totals.carbs + (meal.carbs || 0) + (meal.beverageCarbs || 0),
              fibre: totals.fibre + (meal.fibre || 0) + (meal.beverageFibre || 0),
            }),
            { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }
          );

          // Calculate nutrition score (include beverage if present)
          const totalNutrition = {
            calories: input.calories + (input.beverageCalories || 0),
            protein: input.protein + (input.beverageProtein || 0),
            fat: input.fat + (input.beverageFat || 0),
            carbs: input.carbs + (input.beverageCarbs || 0),
            fibre: input.fibre + (input.beverageFibre || 0),
          };
          
          const score = calculateNutritionScore(
            totalNutrition,
            goals,
            dayTotals,
            input.loggedAt // Use actual logged time
          );

          // Update meal in database
          await db.updateMeal(input.mealId, {
            imageUrl: input.imageUrl,
            imageKey: input.imageKey,
            mealType: input.mealType,
            calories: input.calories,
            protein: input.protein,
            fat: input.fat,
            carbs: input.carbs,
            fibre: input.fibre,
            aiDescription: input.aiDescription,
            aiConfidence: input.aiConfidence,
            nutritionScore: score,
            notes: input.notes,
            loggedAt: input.loggedAt,
            beverageType: input.beverageType,
            beverageVolumeMl: input.beverageVolumeMl,
            beverageCalories: input.beverageCalories,
            beverageProtein: input.beverageProtein,
            beverageFat: input.beverageFat,
            beverageCarbs: input.beverageCarbs,
            beverageFibre: input.beverageFibre,
            beverageCategory: input.beverageCategory,
          });

          return {
            success: true,
            score,
          };
        } catch (error) {
          console.error('Error in updateMeal:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to update meal',
          });
        }
      }),

    // NEW FLOW: Step 2 - Identify items in meal image
    identifyItems: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        imageBase64: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          // 1. Upload image to S3 (raw format - AI can handle HEIF, JPEG, PNG, etc.)
          const imageBuffer = Buffer.from(input.imageBase64, 'base64');
          
          const randomSuffix = Math.random().toString(36).substring(7);
          const imageKey = `meals/${input.clientId}/${Date.now()}-${randomSuffix}.jpg`;
          const { url: imageUrl } = await storagePut(imageKey, imageBuffer, "image/jpeg");

          // 2. Identify items in the image
          const identification = await identifyMealItems(imageUrl);

          return {
            success: true,
            imageUrl,
            imageKey,
            overallDescription: identification.overallDescription,
            items: identification.items.map(item => item.description),
            referenceCardDetected: identification.referenceCardDetected,
          };
        } catch (error) {
          console.error('Error in identifyItems:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to identify meal items',
          });
        }
      }),

    // NEW FLOW: Analyze meal from text description (no photo)
    analyzeTextMeal: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        mealDescription: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const { analyzeTextMeal } = await import("./textMealAnalysis");
          
          // Analyze the text description and break it into components
          const analysis = await analyzeTextMeal(input.mealDescription);

          return {
            success: true,
            imageUrl: "", // No image for text-based entry
            imageKey: "", // No image for text-based entry
            overallDescription: analysis.overallDescription,
            items: analysis.items.map(item => item.description),
            referenceCardDetected: false, // No reference card for text-based entry
          };
        } catch (error) {
          console.error('Error in analyzeTextMeal:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to analyze meal description',
          });
        }
      }),

    // Extract nutrition data from nutrition label image
    extractNutritionLabel: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        imageBase64: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          // 1. Upload image to S3
          const inputBuffer = Buffer.from(input.imageBase64, 'base64');
          
          const randomSuffix = Math.random().toString(36).substring(7);
          const imageKey = `nutrition-labels/${input.clientId}/${Date.now()}-${randomSuffix}.jpg`;
          const { url: imageUrl } = await storagePut(imageKey, inputBuffer, "image/jpeg");

          // 2. Extract nutrition data using AI
          const { invokeLLM } = await import("./_core/llm");
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "You are a nutrition label reader. Extract nutrition information from the label image and return it in JSON format. Be precise with numbers. Support Chinese and English labels."
              },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: { url: imageUrl }
                  },
                  {
                    type: "text",
                    text: `Extract the following from this nutrition label:

1. **Reference Serving**: The serving size that nutrition values are based on (e.g., "per 100g", "per serving", "每100g")
   - referenceSize: number (e.g., 100)
   - referenceUnit: string (e.g., "g", "ml", "serving")

2. **Actual Serving**: The recommended serving size per consumption (e.g., "3.5g per sachet", "1 scoop = 35g")
   - actualServingSize: number (e.g., 3.5)
   - actualServingUnit: string (e.g., "g", "ml")
   - actualServingDescription: string (e.g., "per sachet", "1 scoop", "每袋")
   - If not found, set actualServingSize = referenceSize

3. **Nutrition per reference serving**:
   - calories (kcal/kJ - convert kJ to kcal by dividing by 4.184)
   - protein (g)
   - carbs (g - total carbohydrates, or 碳水化合物)
   - fat (g - total fat, or 脂肪)
   - fiber (g - dietary fiber, or 膳食纤维, set to 0 if not available)

4. **Product name**: The name of the product (e.g., "Qing Yuansu", "轻元素")

5. **Ingredients**: List the main ingredients/components visible on the label
   - Extract up to 10 key ingredients
   - Include percentages if shown (e.g., "Barley Grass Powder (45%)")
   - For Chinese labels, translate to English

Return as JSON.`
                  }
                ]
              }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "nutrition_label",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    referenceSize: { type: "number", description: "The reference serving size number (e.g., 100 for per 100g)" },
                    referenceUnit: { type: "string", description: "The unit of the reference serving (g, ml, serving, etc.)" },
                    actualServingSize: { type: "number", description: "The actual serving size per consumption" },
                    actualServingUnit: { type: "string", description: "The unit of the actual serving (g, ml, etc.)" },
                    actualServingDescription: { type: "string", description: "Description of actual serving (e.g., 'per sachet', '1 scoop')" },
                    calories: { type: "number", description: "Calories per reference serving" },
                    protein: { type: "number", description: "Protein in grams per reference serving" },
                    carbs: { type: "number", description: "Carbohydrates in grams per reference serving" },
                    fat: { type: "number", description: "Fat in grams per reference serving" },
                    fiber: { type: "number", description: "Fiber in grams per reference serving, 0 if not available" },
                    productName: { type: "string", description: "Name of the product" },
                    ingredients: {
                      type: "array",
                      description: "List of main ingredients",
                      items: { type: "string" }
                    },
                  },
                  required: ["referenceSize", "referenceUnit", "actualServingSize", "actualServingUnit", "actualServingDescription", "calories", "protein", "carbs", "fat", "fiber", "productName", "ingredients"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices[0].message.content;
          const nutritionData = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));

          // Calculate nutrition per actual serving (not reference serving)
          // Example: Label shows per 100g, actual serving is 3.5g
          // User should see nutrition for 3.5g, not 100g
          const multiplier = nutritionData.actualServingSize / nutritionData.referenceSize;
          const perServingNutrition = {
            calories: Math.round(nutritionData.calories * multiplier),
            protein: Math.round(nutritionData.protein * multiplier * 10) / 10,
            fat: Math.round(nutritionData.fat * multiplier * 10) / 10,
            carbs: Math.round(nutritionData.carbs * multiplier * 10) / 10,
            fiber: Math.round(nutritionData.fiber * multiplier * 10) / 10,
          };

          return {
            success: true,
            imageUrl,
            imageKey,
            ...nutritionData,
            perServingNutrition, // Nutrition for 1 actual serving
          };
        } catch (error) {
          console.error('Error in extractNutritionLabel:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to extract nutrition label data',
          });
        }
      }),

    // Analyze nutrition label meal with optional beverage
    analyzeNutritionLabelMeal: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        imageUrl: z.string(),
        imageKey: z.string(),
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
        // Product info
        productName: z.string(),
        servingDescription: z.string(), // e.g., "2 sachets (7g total)"
        ingredients: z.array(z.string()), // List of ingredients
        // Final calculated nutrition (already multiplied by servings consumed)
        calories: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number(),
        fiber: z.number(),
        notes: z.string().optional(),
        // Optional beverage data
        drinkType: z.string().optional(),
        volumeMl: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          // 1. Use the final calculated nutrition (already scaled by frontend)
          const adjustedNutrition = {
            calories: input.calories,
            protein: input.protein,
            fat: input.fat,
            carbs: input.carbs,
            fibre: input.fiber,
          };
          
          // 2. Create components array from ingredients
          const components = input.ingredients.map(ingredient => ({
            name: ingredient,
            calories: 0, // We don't have per-ingredient breakdown
            protein: 0,
            fat: 0,
            carbs: 0,
            fibre: 0,
          }));

          // 2. If drink is provided, estimate its nutrition
          let drinkNutrition = null;
          if (input.drinkType && input.volumeMl) {
            drinkNutrition = await estimateBeverageNutrition(input.drinkType, input.volumeMl);
          }

          // 3. Get client's nutrition goals
          const goals = await db.getNutritionGoalByClientId(input.clientId);
          if (!goals) {
            throw new TRPCError({ 
              code: 'NOT_FOUND', 
              message: 'Nutrition goals not found for this client' 
            });
          }

          // 4. Calculate today's totals (before this meal)
          const allMeals = await db.getMealsByClientId(input.clientId);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const todaysMeals = allMeals.filter(meal => {
            const mealDate = new Date(meal.loggedAt);
            mealDate.setHours(0, 0, 0, 0);
            return mealDate.getTime() === today.getTime();
          });
          
          const todaysTotals = todaysMeals.reduce(
            (totals, meal) => ({
              calories: totals.calories + (meal.calories || 0) + (meal.beverageCalories || 0),
              protein: totals.protein + (meal.protein || 0) + (meal.beverageProtein || 0),
              fat: totals.fat + (meal.fat || 0) + (meal.beverageFat || 0),
              carbs: totals.carbs + (meal.carbs || 0) + (meal.beverageCarbs || 0),
              fibre: totals.fibre + (meal.fibre || 0) + (meal.beverageFibre || 0),
            }),
            { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }
          );

          // 5. Calculate combined nutrition (label + drink)
          const combinedCalories = adjustedNutrition.calories + (drinkNutrition?.calories || 0);
          const combinedProtein = adjustedNutrition.protein + (drinkNutrition?.protein || 0);
          const combinedFat = adjustedNutrition.fat + (drinkNutrition?.fat || 0);
          const combinedCarbs = adjustedNutrition.carbs + (drinkNutrition?.carbs || 0);
          const combinedFibre = adjustedNutrition.fibre + (drinkNutrition?.fibre || 0);

          // 6. Calculate final score based on combined nutrition
          const finalScore = calculateNutritionScore(
            {
              calories: combinedCalories,
              protein: combinedProtein,
              fat: combinedFat,
              carbs: combinedCarbs,
              fibre: combinedFibre,
            },
            goals,
            todaysTotals,
            new Date(),
            drinkNutrition?.category
          );

          // 7. Create description for nutrition label meal
          const description = `${input.productName}: ${input.servingDescription}`;
          const finalDescription = drinkNutrition && input.drinkType
            ? `${description} Consumed with ${input.drinkType}.`
            : description;

          // 8. Return analysis results
          return {
            success: true,
            finalScore,
            mealAnalysis: {
              description: finalDescription,
              calories: adjustedNutrition.calories,
              protein: adjustedNutrition.protein,
              fat: adjustedNutrition.fat,
              carbs: adjustedNutrition.carbs,
              fibre: adjustedNutrition.fibre,
              components, // Add components array
            },
            drinkNutrition: drinkNutrition ? {
              calories: drinkNutrition.calories,
              protein: drinkNutrition.protein,
              fat: drinkNutrition.fat,
              carbs: drinkNutrition.carbs,
              fibre: drinkNutrition.fibre,
            } : null,
            combinedNutrition: {
              calories: combinedCalories,
              protein: combinedProtein,
              fat: combinedFat,
              carbs: combinedCarbs,
              fibre: combinedFibre,
            },
          };
        } catch (error) {
          console.error('Error in analyzeNutritionLabelMeal:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to analyze nutrition label meal',
          });
        }
      }),

    // NEW FLOW: Step 4-6 - Analyze meal with drink and save
    analyzeMealWithDrink: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        imageUrl: z.string(),
        imageKey: z.string(),
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
        itemDescriptions: z.array(z.string()),
        notes: z.string().optional(),
        // Optional beverage data
        drinkType: z.string().optional(),
        volumeMl: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          // 1. Analyze meal nutrition from item descriptions (or use zero values for beverage-only)
          let mealAnalysis;
          if (input.itemDescriptions.length > 0) {
            mealAnalysis = await analyzeMealNutrition(input.itemDescriptions, input.imageUrl);
          } else {
            // Beverage-only entry - no food components
            mealAnalysis = {
              description: "No food items",
              calories: 0,
              protein: 0,
              fat: 0,
              carbs: 0,
              fibre: 0,
              confidence: 1.0,
              components: [],
            };
          }

          // 2. If drink is provided, estimate its nutrition
          let drinkNutrition = null;
          if (input.drinkType && input.volumeMl) {
            drinkNutrition = await estimateBeverageNutrition(input.drinkType, input.volumeMl);
          }

          // 3. Get client's nutrition goals
          const goals = await db.getNutritionGoalByClientId(input.clientId);
          if (!goals) {
            throw new TRPCError({ 
              code: 'NOT_FOUND', 
              message: 'Nutrition goals not found for this client' 
            });
          }

          // 4. Calculate today's totals (before this meal)
          const allMeals = await db.getMealsByClientId(input.clientId);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const todaysMeals = allMeals.filter(meal => {
            const mealDate = new Date(meal.loggedAt);
            mealDate.setHours(0, 0, 0, 0);
            return mealDate.getTime() === today.getTime();
          });
          
          const todaysTotals = todaysMeals.reduce(
            (totals, meal) => ({
              calories: totals.calories + (meal.calories || 0) + (meal.beverageCalories || 0),
              protein: totals.protein + (meal.protein || 0) + (meal.beverageProtein || 0),
              fat: totals.fat + (meal.fat || 0) + (meal.beverageFat || 0),
              carbs: totals.carbs + (meal.carbs || 0) + (meal.beverageCarbs || 0),
              fibre: totals.fibre + (meal.fibre || 0) + (meal.beverageFibre || 0),
            }),
            { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }
          );

          // 5. Calculate combined nutrition (meal + drink)
          const combinedCalories = mealAnalysis.calories + (drinkNutrition?.calories || 0);
          const combinedProtein = mealAnalysis.protein + (drinkNutrition?.protein || 0);
          const combinedFat = mealAnalysis.fat + (drinkNutrition?.fat || 0);
          const combinedCarbs = mealAnalysis.carbs + (drinkNutrition?.carbs || 0);
          const combinedFibre = mealAnalysis.fibre + (drinkNutrition?.fibre || 0);

          // 6. Calculate final score based on combined nutrition
          const finalScore = calculateNutritionScore(
            {
              calories: combinedCalories,
              protein: combinedProtein,
              fat: combinedFat,
              carbs: combinedCarbs,
              fibre: combinedFibre,
            },
            goals,
            todaysTotals,
            new Date(), // Use current time for analysis
            drinkNutrition?.category // Pass beverage category for quality adjustment
          );

          // 7. Return analysis data WITHOUT saving to database
          // Actual saving will happen when user clicks "Log Meal" button
          // Append beverage info to description if drink is present
          const finalDescription = drinkNutrition && input.drinkType
            ? `${mealAnalysis.description} Consumed with ${input.drinkType}.`
            : mealAnalysis.description;
          // Return analysis results only - no database operations
          return {
            success: true,
            finalScore,
            mealAnalysis: {
              description: finalDescription, // Use finalDescription which includes drink mention
              calories: mealAnalysis.calories,
              protein: mealAnalysis.protein,
              fat: mealAnalysis.fat,
              carbs: mealAnalysis.carbs,
              fibre: mealAnalysis.fibre,
              components: mealAnalysis.components,
            },
            drinkNutrition: drinkNutrition ? {
              calories: drinkNutrition.calories,
              protein: drinkNutrition.protein,
              fat: drinkNutrition.fat,
              carbs: drinkNutrition.carbs,
              fibre: drinkNutrition.fibre,
            } : null,
            combinedNutrition: {
              calories: combinedCalories,
              protein: combinedProtein,
              fat: combinedFat,
              carbs: combinedCarbs,
              fibre: combinedFibre,
            },
          };
        } catch (error) {
          console.error('Error in analyzeMealWithDrink:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to analyze meal with drink',
          });
        }
      }),

    // Toggle favorite status for a meal
    toggleFavorite: authenticatedProcedure
      .input(z.object({
        mealId: z.number(),
        clientId: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          const meal = await db.getMealById(input.mealId);
          if (!meal || meal.clientId !== input.clientId) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Meal not found' });
          }

          // Check if toggling to favorite would exceed limit
          if (!meal.isFavorite) {
            const favorites = await db.getFavoriteMeals(input.clientId);
            if (favorites.length >= 3) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Maximum 3 favorite meals allowed. Remove a favorite first.',
              });
            }
          }

          await db.toggleMealFavorite(input.mealId, !meal.isFavorite);
          return { success: true, isFavorite: !meal.isFavorite };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to toggle favorite',
          });
        }
      }),

    // Get favorite meals for quick access
    getFavorites: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await db.getFavoriteMeals(input.clientId);
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get favorite meals',
          });
        }
      }),

    // Log a favorite meal with current timestamp
    logFavorite: authenticatedProcedure
      .input(z.object({
        mealId: z.number(),
        clientId: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          const meal = await db.getMealById(input.mealId);
          if (!meal || meal.clientId !== input.clientId || !meal.isFavorite) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Favorite meal not found' });
          }

          // Create a copy of the meal with current timestamp and preserve favorite status
          const newMeal = await db.duplicateMeal(input.mealId, new Date(), true);
          return { success: true, meal: newMeal };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to log favorite meal',
          });
        }
      }),

    // Repeat last logged meal
    repeatLast: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          const lastMeal = await db.getLastMeal(input.clientId);
          if (!lastMeal) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'No previous meals found' });
          }

          // Create a copy of the last meal with current timestamp
          const newMeal = await db.duplicateMeal(lastMeal.id, new Date());
          return { success: true, meal: newMeal };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to repeat last meal',
          });
        }
      }),
  }),

  // Drinks
  drinks: router({
    create: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        drinkType: z.string(),
        volumeMl: z.number(),
        calories: z.number(),
        protein: z.number(),
        fat: z.number(),
        carbs: z.number(),
        fibre: z.number(),
        nutritionScore: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await db.createDrink({
          clientId: input.clientId,
          drinkType: input.drinkType,
          volumeMl: input.volumeMl,
          calories: input.calories,
          protein: input.protein,
          fat: input.fat,
          carbs: input.carbs,
          fibre: input.fibre,
          nutritionScore: input.nutritionScore,
          notes: input.notes,
          loggedAt: new Date(),
        });
        
        // Also log hydration in body_metrics for Today's Summary
        await db.createBodyMetric({
          clientId: input.clientId,
          hydration: input.volumeMl,
          recordedAt: new Date(),
        });
        
        return { success: true, drinkId: Number(result[0].insertId) };
      }),

    list: authenticatedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getDrinksByClientId(input.clientId);
      }),

    delete: authenticatedProcedure
      .input(z.object({ drinkId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteDrink(input.drinkId);
        return { success: true };
      }),

    update: authenticatedProcedure
      .input(z.object({
        drinkId: z.number(),
        drinkType: z.string().optional(),
        volumeMl: z.number().optional(),
        notes: z.string().optional(),
        loggedAt: z.date().optional(),
        // Nutrition fields from AI re-analysis
        calories: z.number().optional(),
        protein: z.number().optional(),
        fat: z.number().optional(),
        carbs: z.number().optional(),
        fibre: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { drinkId, ...data } = input;
        await db.updateDrink(drinkId, data);
        return { success: true };
      }),

    // Toggle favorite status for a drink
    toggleFavorite: authenticatedProcedure
      .input(z.object({
        drinkId: z.number(),
        clientId: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          const drink = await db.getDrinkById(input.drinkId);
          if (!drink || drink.clientId !== input.clientId) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Drink not found' });
          }

          // Check if toggling to favorite would exceed limit
          if (!drink.isFavorite) {
            const favorites = await db.getFavoriteDrinks(input.clientId);
            if (favorites.length >= 3) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Maximum 3 favorite drinks allowed. Remove a favorite first.',
              });
            }
          }

          await db.toggleDrinkFavorite(input.drinkId, !drink.isFavorite);
          return { success: true, isFavorite: !drink.isFavorite };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to toggle favorite',
          });
        }
      }),

    // Get favorite drinks for quick access
    getFavorites: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await db.getFavoriteDrinks(input.clientId);
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get favorite drinks',
          });
        }
      }),

    // Log a favorite drink with current timestamp
    logFavorite: authenticatedProcedure
      .input(z.object({
        drinkId: z.number(),
        clientId: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          const drink = await db.getDrinkById(input.drinkId);
          if (!drink || drink.clientId !== input.clientId || !drink.isFavorite) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Favorite drink not found' });
          }

          // Create a copy of the drink with current timestamp and preserve favorite status
          const newDrink = await db.duplicateDrink(input.drinkId, new Date(), true);
          return { success: true, drink: newDrink };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to log favorite drink',
          });
        }
      }),

    // Repeat last drink
    repeatLast: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          const lastDrink = await db.getLastDrink(input.clientId);
          if (!lastDrink) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'No previous drink found' });
          }

          // Create a copy of the last drink with current timestamp
          const newDrink = await db.duplicateDrink(lastDrink.id, new Date());
          return { success: true, drink: newDrink };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to repeat last drink',
          });
        }
      }),

    // Calculate nutrition score for a drink
    calculateScore: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        calories: z.number(),
        protein: z.number(),
        fat: z.number(),
        carbs: z.number(),
        fibre: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          // 1. Get client's nutrition goals
          const goals = await db.getNutritionGoalByClientId(input.clientId);
          if (!goals) {
            throw new TRPCError({ 
              code: 'NOT_FOUND', 
              message: 'Nutrition goals not found for this client' 
            });
          }

          // 2. Calculate today's totals (before this drink)
          const allMeals = await db.getMealsByClientId(input.clientId);
          const allDrinks = await db.getDrinksByClientId(input.clientId);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const todaysMeals = allMeals.filter(meal => {
            const mealDate = new Date(meal.loggedAt);
            mealDate.setHours(0, 0, 0, 0);
            return mealDate.getTime() === today.getTime();
          });

          const todaysDrinks = allDrinks.filter(drink => {
            const drinkDate = new Date(drink.loggedAt);
            drinkDate.setHours(0, 0, 0, 0);
            return drinkDate.getTime() === today.getTime();
          });
          
          const todaysTotals = {
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
            fibre: 0,
          };

          // Sum meals
          todaysMeals.forEach(meal => {
            todaysTotals.calories += (meal.calories || 0) + (meal.beverageCalories || 0);
            todaysTotals.protein += (meal.protein || 0) + (meal.beverageProtein || 0);
            todaysTotals.fat += (meal.fat || 0) + (meal.beverageFat || 0);
            todaysTotals.carbs += (meal.carbs || 0) + (meal.beverageCarbs || 0);
            todaysTotals.fibre += (meal.fibre || 0) + (meal.beverageFibre || 0);
          });

          // Sum drinks
          todaysDrinks.forEach(drink => {
            todaysTotals.calories += drink.calories || 0;
            todaysTotals.protein += drink.protein || 0;
            todaysTotals.fat += drink.fat || 0;
            todaysTotals.carbs += drink.carbs || 0;
            todaysTotals.fibre += drink.fibre || 0;
          });

          // 3. Calculate nutrition score
          const score = calculateNutritionScore(
            {
              calories: input.calories,
              protein: input.protein,
              fat: input.fat,
              carbs: input.carbs,
              fibre: input.fibre,
            },
            goals,
            todaysTotals,
            new Date()
          );

          return { success: true, score };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to calculate score',
          });
        }
      }),
  }),

  // Body metrics
  bodyMetrics: router({
    create: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        weight: z.number().optional(),
        hydration: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await db.createBodyMetric({
          ...input,
          recordedAt: new Date(),
        });
        return { success: true, metricId: Number(result[0].insertId) };
      }),

    list: authenticatedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getBodyMetricsByClientId(input.clientId);
      }),
  }),

  // ============================================================================
  // DEXA Scan Router (Trainer & Client)
  // ============================================================================
  dexa: router({
    // Trainer: Upload DEXA PDF and trigger AI extraction
    uploadScan: adminProcedure
      .input(z.object({
        clientId: z.number(),
        pdfFile: z.object({
          data: z.string(), // base64 encoded PDF
          filename: z.string(),
        }),
      }))
      .mutation(async ({ input }) => {
        const { analyzeDexaPdf } = await import("./dexaPdfAnalysis");
        const { extractDexaImages } = await import("./dexaImageExtraction");
        const { writeFile, unlink } = await import('fs/promises');
        const { randomBytes } = await import('crypto');
        
        // Upload PDF to S3
        const pdfBuffer = Buffer.from(input.pdfFile.data, 'base64');
        const pdfKey = `dexa-scans/${input.clientId}/${Date.now()}-${input.pdfFile.filename}`;
        const { url: pdfUrl } = await storagePut(pdfKey, pdfBuffer, 'application/pdf');
        
        // Save PDF temporarily for image extraction
        const tempPdfPath = `/tmp/dexa-${randomBytes(8).toString('hex')}.pdf`;
        await writeFile(tempPdfPath, pdfBuffer);
        
        // Extract data using AI
        const extractedData = await analyzeDexaPdf(pdfUrl);
        
        // Extract images from PDF
        let extractedImages: any[] = [];
        try {
          extractedImages = await extractDexaImages(tempPdfPath);
        } catch (error) {
          console.error('Image extraction failed:', error);
          // Continue without images if extraction fails
        } finally {
          // Clean up temp PDF
          await unlink(tempPdfPath).catch(() => {});
        }
        
        // Create scan record
        const scanId = await db.createDexaScan({
          clientId: input.clientId,
          trainerId: 1, // TODO: Get from ctx.user.id
          pdfUrl,
          pdfKey,
          scanDate: extractedData.scanMetadata.scanDate,
          scanId: extractedData.scanMetadata.scanId || null,
          scanType: extractedData.scanMetadata.scanType || null,
          scanVersion: extractedData.scanMetadata.analysisVersion || null,
          operator: extractedData.scanMetadata.operator || null,
          model: extractedData.scanMetadata.model || null,
          patientHeight: extractedData.scanMetadata.patientHeight || null,
          patientWeight: extractedData.scanMetadata.patientWeight ? Math.round(extractedData.scanMetadata.patientWeight * 10) : null,
          patientAge: extractedData.scanMetadata.patientAge || null,
          status: 'pending',
        });
        
        // Store BMD data
        if (extractedData.bmdData && extractedData.bmdData.length > 0) {
          const bmdRecords = extractedData.bmdData.map((bmd: any) => ({
            scanId,
            region: bmd.region,
            area: bmd.area?.toString() || null,
            bmc: bmd.bmc?.toString() || null,
            bmd: bmd.bmd?.toString() || null,
            tScore: bmd.tScore?.toString() || null,
            zScore: bmd.zScore?.toString() || null,
          }));
          await db.createDexaBmdData(bmdRecords);
        }
        
        // Store body composition data
        if (extractedData.bodyComposition || extractedData.adiposeIndices) {
          await db.createDexaBodyComp({
            scanId,
            totalFatMass: extractedData.bodyComposition?.totalFatMass || null,
            totalLeanMass: extractedData.bodyComposition?.totalLeanMass || null,
            totalMass: extractedData.bodyComposition?.totalMass || null,
            totalBodyFatPct: extractedData.bodyComposition?.totalBodyFatPct?.toString() || null,
            totalBodyFatPctTScore: extractedData.bodyComposition?.totalBodyFatPctTScore?.toString() || null,
            totalBodyFatPctZScore: extractedData.bodyComposition?.totalBodyFatPctZScore?.toString() || null,
            trunkFatMass: extractedData.bodyComposition?.trunkFatMass || null,
            trunkFatPct: extractedData.bodyComposition?.trunkFatPct?.toString() || null,
            androidFatMass: extractedData.bodyComposition?.androidFatMass || null,
            androidFatPct: extractedData.bodyComposition?.androidFatPct?.toString() || null,
            gynoidFatMass: extractedData.bodyComposition?.gynoidFatMass || null,
            gynoidFatPct: extractedData.bodyComposition?.gynoidFatPct?.toString() || null,
            lArmLeanMass: extractedData.bodyComposition?.lArmLeanMass || null,
            rArmLeanMass: extractedData.bodyComposition?.rArmLeanMass || null,
            lLegLeanMass: extractedData.bodyComposition?.lLegLeanMass || null,
            rLegLeanMass: extractedData.bodyComposition?.rLegLeanMass || null,
            trunkLeanMass: extractedData.bodyComposition?.trunkLeanMass || null,
            fatMassHeightRatio: extractedData.adiposeIndices?.fatMassHeightRatio?.toString() || null,
            androidGynoidRatio: extractedData.adiposeIndices?.androidGynoidRatio?.toString() || null,
            trunkLegsFatRatio: extractedData.adiposeIndices?.trunkLegsFatRatio?.toString() || null,
            trunkLimbFatMassRatio: extractedData.adiposeIndices?.trunkLimbFatMassRatio?.toString() || null,
            vatMass: extractedData.adiposeIndices?.vatMass || null,
            vatVolume: extractedData.adiposeIndices?.vatVolume || null,
            vatArea: extractedData.adiposeIndices?.vatArea?.toString() || null,
            leanMassHeightRatio: extractedData.leanIndices?.leanMassHeightRatio?.toString() || null,
            appendicularLeanMassHeightRatio: extractedData.leanIndices?.appendicularLeanMassHeightRatio?.toString() || null,
          });
        }
        
        // Store extracted images
        if (extractedImages.length > 0) {
          const imageRecords = extractedImages.map((img: any) => ({
            scanId,
            imageType: img.type,
            imageUrl: img.imageUrl,
            imageKey: img.imageKey,
            pageNumber: img.pageNumber,
          }));
          await db.createDexaImages(imageRecords);
        }
        
        return {
          scanId,
          extractedData,
          extractedImages: extractedImages.length,
        };
      }),

    // Trainer: Approve or reject a scan
    updateScanStatus: adminProcedure
      .input(z.object({
        scanId: z.number(),
        status: z.enum(['approved', 'rejected']),
        rejectionReason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateDexaScanStatus(input.scanId, input.status, input.rejectionReason);
        return { success: true };
      }),

    // Trainer: Get all scans for a client (including pending)
    getClientScans: adminProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const scans = await db.getDexaScansByClient(input.clientId);
        return scans;
      }),

    // Client: Get approved scans only
    getMyScans: authenticatedProcedure
      .query(async ({ ctx }) => {
        // Get client session
        const clientCookie = ctx.req.cookies?.['client_session'];
        if (!clientCookie) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No client session found' });
        }
        
        const decoded = JSON.parse(Buffer.from(clientCookie, 'base64').toString());
        const clientId = decoded.clientId;
        
        const allScans = await db.getDexaScansByClient(clientId);
        // Filter to approved scans only
        return allScans.filter(scan => scan.status === 'approved');
      }),

    // Get detailed scan data (BMD + Body Comp + Images)
    getScanDetails: protectedProcedure
      .input(z.object({ scanId: z.number() }))
      .query(async ({ input }) => {
        const { storageGetPresigned } = await import('./storage');
        
        const scan = await db.getDexaScanById(input.scanId);
        const bmdData = await db.getDexaBmdData(input.scanId);
        const bodyComp = await db.getDexaBodyComp(input.scanId);
        const images = await db.getDexaImages(input.scanId);
        
        // Generate presigned URLs for PDF and images (5-minute expiry)
        let presignedPdfUrl: string | null = null;
        if (scan?.pdfKey) {
          try {
            const { url } = await storageGetPresigned(scan.pdfKey, 300);
            presignedPdfUrl = url;
          } catch (error) {
            console.error('[DEXA] Failed to generate presigned PDF URL:', error);
          }
        }
        
        // Generate presigned URLs for images
        const imagesWithPresignedUrls = await Promise.all(
          images.map(async (image: any) => {
            if (image.imageKey) {
              try {
                const { url } = await storageGetPresigned(image.imageKey, 300);
                return { ...image, presignedUrl: url };
              } catch (error) {
                console.error('[DEXA] Failed to generate presigned image URL:', error);
                return image;
              }
            }
            return image;
          })
        );
        
        return {
          scan: scan ? { ...scan, presignedPdfUrl } : null,
          bmdData,
          bodyComp,
          images: imagesWithPresignedUrls,
        };
      }),

    // Get body composition history for trend charts
    getBodyCompTrend: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const history = await db.getDexaBodyCompHistory(input.clientId);
        // Filter to approved scans only
        return history.filter((record: any) => record.status === 'approved');
      }),

    // Get BMD history for trend charts
    getBmdTrend: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const history = await db.getDexaBmdHistory(input.clientId);
        // Filter to approved scans only
        return history.filter((record: any) => record.status === 'approved');
      }),

    // Get DEXA goals for a client (accessible to both trainers and clients)
    getGoals: authenticatedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getDexaGoalsByClientId(input.clientId);
      }),

    // Update DEXA goals (trainer only)
    updateGoals: adminProcedure
      .input(z.object({
        clientId: z.number(),
        vatTarget: z.number().optional(),
        bodyFatPctTarget: z.number().optional(),
        leanMassTarget: z.number().optional(),
        boneDensityTarget: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { clientId, ...goals } = input;
        // Convert numbers to strings for decimal fields
        const convertedGoals: any = {};
        if (goals.vatTarget !== undefined) convertedGoals.vatTarget = goals.vatTarget.toString();
        if (goals.bodyFatPctTarget !== undefined) convertedGoals.bodyFatPctTarget = goals.bodyFatPctTarget.toString();
        if (goals.leanMassTarget !== undefined) convertedGoals.leanMassTarget = goals.leanMassTarget.toString();
        if (goals.boneDensityTarget !== undefined) convertedGoals.boneDensityTarget = goals.boneDensityTarget.toString();
        
        await db.upsertDexaGoals(clientId, convertedGoals);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
