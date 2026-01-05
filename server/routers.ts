import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, authenticatedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";
import { analyzeMealImage, calculateNutritionScore } from "./qwenVision";
import { calculateScoreBreakdown, generateImprovementAdvice } from "./improvementAdvice";
import { estimateBeverageNutrition } from "./beverageNutrition";
import { reEstimateComponentNutrition } from "./componentReEstimation";
import { estimateFoodNutrition } from "./foodQuantityEstimation";

// Admin-only procedure for trainers
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only trainers can access this resource' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    clientSession: publicProcedure.query(({ ctx }) => {
      console.log('[clientSession] Checking session, cookies:', ctx.req.cookies);
      if (!ctx.req.cookies) {
        console.log('[clientSession] No cookies object');
        return null;
      }
      
      const clientCookie = ctx.req.cookies['client_session'];
      console.log('[clientSession] client_session cookie:', clientCookie);
      if (!clientCookie) {
        return null;
      }
      
      try {
        const decoded = JSON.parse(Buffer.from(clientCookie, 'base64').toString());
        return {
          clientId: decoded.clientId,
          name: decoded.name,
        };
      } catch (e) {
        return null;
      }
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
        
        if (!isValidPIN(input.pin)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid PIN format' });
        }
        
        const client = await db.getClientByPIN(input.pin);
        if (!client) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid PIN' });
        }
        
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
        };
      }),
  }),

  // Client management (trainer only)
  clients: router({
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
        pin: z.string().length(6).regex(/^\d{6}$/, "PIN must be 6 digits"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { pin, ...clientData } = input;
        
        // Check if PIN already exists
        const existingClient = await db.getClientByPIN(pin);
        if (existingClient) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'This PIN is already in use. Please choose a different PIN.' });
        }
        
        const result = await db.createClient({
          trainerId: ctx.user.id,
          pin,
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
        
        return { success: true, clientId, pin };
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
      }))
      .mutation(async ({ input }) => {
        const { clientId, ...data } = input;
        await db.updateNutritionGoal(clientId, data);
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

          // 5. Calculate nutrition score with quality + progress
          const score = calculateNutritionScore(
            {
              calories: analysis.calories,
              protein: analysis.protein,
              fat: analysis.fat,
              carbs: analysis.carbs,
              fibre: analysis.fibre,
            },
            goals,
            todaysTotals
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
              score,
              components: (analysis as any).components || [],
              validationWarnings: (analysis as any).validationWarnings || [],
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
            todaysTotals
          );

          // Save meal to database
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
            loggedAt: new Date(),
          });

          // If beverage is included, also create drinks table entry for hydration tracking
          if (input.beverageType && input.beverageVolumeMl) {
            await db.createDrink({
              clientId: input.clientId,
              drinkType: input.beverageType,
              volumeMl: input.beverageVolumeMl,
              notes: input.notes,
              loggedAt: new Date(),
            });
            
            // Create body_metrics entry for hydration
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
          
          dailyMap.set(dateKey, existing);
        });
        
        // Add hydration data from drinks table
        drinks.forEach(drink => {
          const drinkDate = new Date(drink.loggedAt);
          const drinkDateUTC = new Date(drinkDate.getTime() - (timezoneOffset * 60 * 1000));
          const dateKey = drinkDateUTC.toISOString().split('T')[0];
          
          const existing = dailyMap.get(dateKey);
          if (existing) {
            existing.hydration += drink.volumeMl;
          }
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
            todaysTotals
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
        beverageType: z.string().optional(),
        beverageVolumeMl: z.number().optional(),
        beverageCalories: z.number().optional(),
        beverageProtein: z.number().optional(),
        beverageFat: z.number().optional(),
        beverageCarbs: z.number().optional(),
        beverageFibre: z.number().optional(),
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
            dayTotals
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
            beverageType: input.beverageType,
            beverageVolumeMl: input.beverageVolumeMl,
            beverageCalories: input.beverageCalories,
            beverageProtein: input.beverageProtein,
            beverageFat: input.beverageFat,
            beverageCarbs: input.beverageCarbs,
            beverageFibre: input.beverageFibre,
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
  }),

  // Drinks
  drinks: router({
    create: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        drinkType: z.string(),
        volumeMl: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await db.createDrink({
          ...input,
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
      }))
      .mutation(async ({ input }) => {
        const { drinkId, ...data } = input;
        await db.updateDrink(drinkId, data);
        return { success: true };
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
});

export type AppRouter = typeof appRouter;
