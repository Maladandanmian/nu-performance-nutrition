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
import { sendPasswordSetupInvitation, sendEmailVerification as sendVerificationEmail } from "./emailService";

import { randomBytes } from "crypto";
import { calculateGripStrengthScore } from "../shared/gripStrengthScoring";

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

      const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches cookie maxAge

      function decodeAndValidate(token: string) {
        try {
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          // Reject if timestamp is present and older than 7 days
          if (typeof decoded.timestamp === 'number') {
            if (Date.now() - decoded.timestamp > SESSION_MAX_AGE_MS) {
              console.log('[clientSession] Token expired (timestamp check)');
              return null;
            }
          }
          // Reject if expiresAt is present and in the past
          if (typeof decoded.expiresAt === 'number') {
            if (Date.now() > decoded.expiresAt) {
              console.log('[clientSession] Token expired (expiresAt check)');
              return null;
            }
          }
          if (!decoded.clientId || !decoded.name) return null;
          return { clientId: decoded.clientId, name: decoded.name };
        } catch {
          return null;
        }
      }

      // First, try to get from cookie
      const clientCookie = ctx.req.cookies?.['client_session'];
      if (clientCookie) {
        console.log('[clientSession] Found cookie');
        const result = decodeAndValidate(clientCookie);
        if (result) return result;
        console.log('[clientSession] Cookie invalid or expired');
      }

      // Fallback: try to get from X-Client-Session header
      const sessionHeader = ctx.req.headers['x-client-session'] as string | undefined;
      if (sessionHeader) {
        console.log('[clientSession] Found header');
        const result = decodeAndValidate(sessionHeader);
        if (result) return result;
        console.log('[clientSession] Header invalid or expired');
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
    

  }),

  // Client management (trainer only)
  clients: router({
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(), // Required for new clients
        phone: z.string().optional(),
        notes: z.string().optional(),
        // Nutrition goals — required at creation, no server-side defaults
        caloriesTarget: z.number().int().min(1, 'Calories target is required'),
        proteinTarget: z.number().int().min(0, 'Protein target is required'),
        fatTarget: z.number().int().min(0, 'Fat target is required'),
        carbsTarget: z.number().int().min(0, 'Carbs target is required'),
        fibreTarget: z.number().int().min(0, 'Fibre target is required'),
        hydrationTarget: z.number().int().min(0, 'Hydration target is required'),
      }))
      .mutation(async ({ ctx, input }) => {
        
        // Check if email already exists for this trainer
        const existingClientByEmail = await db.getClientByEmail(input.email);
        if (existingClientByEmail) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'A client with this email already exists.' });
        }

        const { caloriesTarget, proteinTarget, fatTarget, carbsTarget, fibreTarget, hydrationTarget, ...clientData } = input;

        const result = await db.createClient({
          trainerId: ctx.user.id,
          ...clientData,
        });
        
        // Create nutrition goals with trainer-specified values
        const clientId = result.id;
        await db.createNutritionGoal({
          clientId,
          caloriesTarget,
          proteinTarget,
          fatTarget,
          carbsTarget,
          fibreTarget,
          hydrationTarget,
        });
        
        // Generate password setup token and send invitation email
        // Wrap in try-catch to prevent mutation failure if email sending fails
        let emailSent = false;
        let token = '';
        try {
          token = await db.generatePasswordSetupToken(clientId);
          emailSent = await sendPasswordSetupInvitation(
            input.email,
            input.name,
            token
          );
        } catch (emailError) {
          console.error(`[ClientInvitation] Error sending email to ${input.email}:`, emailError);
        }
        
        if (!emailSent) {
          console.warn(`[ClientInvitation] Failed to send email to ${input.email}. Token: ${token}`);
        }
        
        return { success: true, clientId, invitationSent: emailSent };
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

    // Update client info with email verification support
    updateClientInfo: adminProcedure
      .input(z.object({
        clientId: z.number(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        age: z.number().min(1).max(150).optional(),
        height: z.number().min(50).max(300).optional(), // cm
        gender: z.enum(["male", "female", "other"]).optional(),
        notes: z.string().optional(),
        sendEmailVerification: z.boolean().optional(), // If true, send verification email
      }))
      .mutation(async ({ input }) => {
        const { clientId, sendEmailVerification, email, height, ...data } = input;
        
        // Get current client data
        const client = await db.getClientById(clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found' });
        }
        
        let emailVerificationSent = false;
        
        // Prepare update data with height as string if provided
        const baseUpdateData: any = { ...data };
        if (height !== undefined) {
          baseUpdateData.height = height.toString();
        }
        
        // If email is being updated and verification is requested
        if (email && email !== client.email && sendEmailVerification) {
          try {
            // Generate verification token
            const token = randomBytes(32).toString('hex');
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration
            
            await db.createEmailVerificationToken({
              clientId,
              token,
              expiresAt,
            });
            
            // Send verification email
            emailVerificationSent = await sendVerificationEmail(
              email,
              data.name || client.name,
              token
            );
            
            // Update email but mark as unverified
            await db.updateClient(clientId, {
              ...baseUpdateData,
              email,
              emailVerified: false,
            });
          } catch (error) {
            console.error('[UpdateClientInfo] Email verification error:', error);
            // Still update other fields even if email verification fails
            await db.updateClient(clientId, { ...baseUpdateData, email });
          }
        } else {
          // Update without email verification
          const updateData: any = { ...baseUpdateData };
          if (email) updateData.email = email;
          await db.updateClient(clientId, updateData);
        }
        
        return { success: true, emailVerificationSent };
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
        // Pre-calculated score from frontend (to maintain consistency)
        preCalculatedScore: z.number().optional(),
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
          // Use pre-calculated score if provided (from frontend preview) to maintain consistency
          let score: number;
          
          if (input.preCalculatedScore !== undefined && input.preCalculatedScore > 0) {
            // Use the score calculated during preview
            score = input.preCalculatedScore;
          } else {
            // Recalculate score (fallback for old clients or direct API calls)
            const totalNutrition = {
              calories: input.calories + (input.beverageCalories || 0),
              protein: input.protein + (input.beverageProtein || 0),
              fat: input.fat + (input.beverageFat || 0),
              carbs: input.carbs + (input.beverageCarbs || 0),
              fibre: input.fibre + (input.beverageFibre || 0),
            };
            
            score = calculateNutritionScore(
              totalNutrition,
              goals,
              todaysTotals,
              new Date() // Use current time (loggedAt not available in this procedure)
            );
          }

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

          // Note: We do NOT create a separate body_metrics entry for beverage hydration
          // because the beverage data is already stored in the meal's beverage fields
          // (beverageType, beverageVolumeMl, etc.) and will be counted during aggregation.
          // Creating a body_metrics entry would result in double-counting of hydration.

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
        
        // Get body metrics for hydration data
        const bodyMetrics = await db.getBodyMetricsByClientId(input.clientId);
        
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
        
        // Add hydration data from body_metrics table
        bodyMetrics.forEach(metric => {
          const metricDate = new Date(metric.recordedAt);
          if (metricDate < cutoffDate) return;
          
          const metricDateUTC = new Date(metricDate.getTime() - (timezoneOffset * 60 * 1000));
          const dateKey = new Date(Date.UTC(
            metricDateUTC.getUTCFullYear(),
            metricDateUTC.getUTCMonth(),
            metricDateUTC.getUTCDate()
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
          
          // Add body metric hydration
          if (metric.hydration) {
            existing.hydration += metric.hydration;
          }
          
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

**SUPPLEMENT DETECTION (CRITICAL):**
Before extracting nutrition data, check if this is a vitamin/mineral supplement:
- Look for keywords: "vitamin", "supplement", "capsule", "tablet", "softgel", "multivitamin"
- If detected, set calories=5, protein=0, carbs=1, fat=0, fiber=0 (typical binder/coating values)
- Do NOT extract food-like nutrition values for supplements

1. **Reference Serving**: The serving size that nutrition values on the label are based on
   - IMPORTANT: Always extract the weight/volume in grams or ml, NOT a count like "1 serving"
   - Example: If label says "Per Serving (35.5g)", extract referenceSize=35.5, referenceUnit="g"
   - Example: If label says "Per 100g", extract referenceSize=100, referenceUnit="g"
   - Example: If label says "Per 100ml", extract referenceSize=100, referenceUnit="ml"
   - For supplements: Extract the tablet/capsule weight if shown, otherwise use 1g as default
   - referenceSize: number (the gram/ml amount, e.g., 35.5, 100, or 1 for supplements)
   - referenceUnit: string (must be "g" or "ml", never "serving")

2. **Actual Serving**: The recommended serving size per consumption (if different from reference)
   - Only fill this if the label shows a DIFFERENT serving size than the reference
   - Example: Label shows "Per 100g" but recommends "1 sachet (3.5g)" → actualServingSize=3.5
   - Example: Label shows "Per Serving (35.5g)" with no other serving → actualServingSize=35.5 (same as reference)
   - For supplements: Use "1 tablet" or "1 capsule" as serving description
   - actualServingSize: number (e.g., 3.5, 35.5, or 1 for supplements)
   - actualServingUnit: string (e.g., "g", "ml")
   - actualServingDescription: string (e.g., "per sachet", "1 scoop", "1 tablet", "1 capsule")
   - If not found or same as reference, set actualServingSize = referenceSize

3. **Nutrition per reference serving**:
   - REMINDER: For supplements, use minimal values (calories=5, protein=0, carbs=1, fat=0, fiber=0)
   - For food products, extract actual values:
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

          // With locked Quick Log, toggleMealFavorite automatically un-favorites
          // other meals with the same description, so no need to check limit here
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

          // Create a copy of the meal with current timestamp but DON'T preserve favorite status
          // Only the original favorite should remain marked as favorite (locked Quick Log button)
          const newMeal = await db.duplicateMeal(input.mealId, new Date(), false);
          return { success: true, newMealId: newMeal?.id };
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
          return { success: true, newMealId: newMeal?.id };
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

          // With locked Quick Log, toggleDrinkFavorite automatically un-favorites
          // other drinks of the same type, so no need to check limit here
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

          // Create a copy of the drink with current timestamp but DON'T preserve favorite status
          // Only the original favorite should remain marked as favorite (locked Quick Log button)
          const newDrink = await db.duplicateDrink(input.drinkId, new Date(), false, "favorite");
          return { success: true, newDrinkId: newDrink?.id, drink: newDrink };
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
          const newDrink = await db.duplicateDrink(lastDrink.id, new Date(), false, "repeat");
          return { success: true, newDrinkId: newDrink?.id, drink: newDrink };
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

    // Trainer: Delete a scan
    deleteScan: adminProcedure
      .input(z.object({
        scanId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.deleteDexaScan(input.scanId);
        return { success: true };
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
    getScanDetails: authenticatedProcedure
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
    getBodyCompTrend: authenticatedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const history = await db.getDexaBodyCompHistory(input.clientId);
        // Filter to approved scans only
        return history.filter((record: any) => record.status === 'approved');
      }),

    // Get BMD history for trend charts
    getBmdTrend: authenticatedProcedure
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

  /**
   * Athlete Monitoring Router
   * Wellness check-ins with fatigue, sleep, soreness, stress, and mood tracking
   */
  /**
   * Strength Tests Router
   * Track various strength test results (grip strength, etc.)
   * Only trainers can enter data, clients can view
   */
  strengthTests: router({    // Add grip strength test (trainer only)
    addGripStrength: adminProcedure
      .input(z.object({
        clientId: z.number(),
        value: z.number().positive(), // kg
        testedAt: z.date(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Get client info for gender/age-based scoring
        const client = await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found' });
        }

        // Insert test result
        await db.addStrengthTest({
          clientId: input.clientId,
          testType: 'grip_strength',
          value: input.value,
          unit: 'kg',
          testedAt: input.testedAt,
          notes: input.notes,
        });

        // Calculate score for response
        const score = calculateGripStrengthScore(input.value, client.gender, client.age);
        
        return { success: true, score };
      }),

    // Update grip strength test (trainer only)
    updateGripStrength: adminProcedure
      .input(z.object({
        testId: z.number(),
        value: z.number().positive(), // kg
        testedAt: z.date(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {        // Get the test to find clientId
        const existingTest = await db.getStrengthTestById(input.testId);
        if (!existingTest) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Test not found' });
        }

        // Get client info for gender/age-based scoring
        const client = await db.getClientById(existingTest.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found' });
        }

        // Update test result
        await db.updateStrengthTest({
          id: input.testId,
          value: input.value,
          testedAt: input.testedAt,
          notes: input.notes,
        });

        // Calculate score for response
        const score = calculateGripStrengthScore(input.value, client.gender, client.age);
        
        return { success: true, score };
      }),

    // Get latest grip strength test for a client
    getLatestGripStrength: authenticatedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const test = await db.getLatestStrengthTest(input.clientId, 'grip_strength');
        if (!test) return null;

        // Get client info for scoring
        const client = await db.getClientById(input.clientId);
        const score = client 
          ? calculateGripStrengthScore(parseFloat(test.value), client.gender, client.age)
          : 'Normal';

        return {
          ...test,
          value: parseFloat(test.value),
          score,
        };
      }),

    // Get grip strength trend data (all tests, filtering done on frontend)
    getGripStrengthTrend: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
      }))
      .query(async ({ input }) => {
        const tests = await db.getAllGripStrengthTests(input.clientId);

        // Get client info for scoring
        const client = await db.getClientById(input.clientId);
        
        return tests.map(test => ({
          date: test.testedAt,
          value: parseFloat(test.value),
          score: client 
            ? calculateGripStrengthScore(parseFloat(test.value), client.gender, client.age)
            : 'Normal',
          notes: test.notes,
        }));
      }),

    // Delete a strength test (trainer only)
    deleteTest: adminProcedure
      .input(z.object({ testId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteStrengthTest(input.testId);
        return { success: true };
      }),
  }),

  nutritionReports: router({
    // Upload nutrition report PDF (trainer only)
    upload: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        filename: z.string(),
        fileData: z.string(), // Base64 encoded PDF
        reportDate: z.date(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const { analyzeNutritionReport } = await import('./nutritionReportAnalysis');
          const { storagePut } = await import('./storage');
          
          // Decode base64 and upload to S3
          const buffer = Buffer.from(input.fileData, 'base64');
          const fileKey = `nutrition-reports/${input.clientId}/${Date.now()}-${input.filename}`;
          const { url } = await storagePut(fileKey, buffer, 'application/pdf');
          
          // Create initial report record
          const result = await db.createNutritionReport({
            clientId: input.clientId,
            pdfUrl: url,
            pdfFileKey: fileKey,
            filename: input.filename,
            reportDate: input.reportDate,
            uploadedBy: ctx.user.id,
          });
          
          const reportId = Number(result[0].insertId);
          console.log('[nutritionReports.upload] Created report with ID:', reportId);
          
          // Analyze PDF with AI in background
          console.log('[nutritionReports.upload] Triggering AI analysis...');
          analyzeNutritionReport(reportId).catch(error => {
            console.error('[nutritionReports.upload] Failed to analyze nutrition report:', error);
          });
          
          return { success: true, reportId };
        } catch (error) {
          console.error('Error uploading nutrition report:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to upload nutrition report',
          });
        }
      }),

    // Get all nutrition reports for a client (ordered by upload date, newest first)
    getAll: authenticatedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const reports = await db.getNutritionReportsByClientId(input.clientId);
        return reports; // Return all reports, ordered by uploadedAt DESC
      }),

    // Update nutrition report summary (trainer only)
    updateSummary: protectedProcedure
      .input(z.object({
        reportId: z.number(),
        goals: z.string().optional(),
        currentStatus: z.string().optional(),
        recommendations: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          await db.updateNutritionReportSummary(input.reportId, {
            goals: input.goals,
            currentStatus: input.currentStatus,
            recommendations: input.recommendations,
          });
          return { success: true };
        } catch (error) {
          console.error('Error updating nutrition report summary:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to update summary',
          });
        }
      }),

    // Delete nutrition report (trainer only)
    delete: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await db.deleteNutritionReport(input.reportId);
          return { success: true };
        } catch (error) {
          console.error('Error deleting nutrition report:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to delete report',
          });
        }
      }),
  }),

  athleteMonitoring: router({
    // Submit wellness check-in (client only, once per day)
    submit: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        fatigue: z.number().min(1).max(5),
        sleepQuality: z.number().min(1).max(5),
        muscleSoreness: z.number().min(1).max(5),
        stressLevels: z.number().min(1).max(5),
        mood: z.number().min(1).max(5),
      }))
      .mutation(async ({ input }) => {
        try {
          await db.submitAthleteMonitoring(input);
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message || 'Failed to submit wellness check-in',
          });
        }
      }),

    // Get last submission for a client
    getLastSubmission: authenticatedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const result = await db.getLastAthleteMonitoring(input.clientId);
        return result || null;
      }),

    // Get trend data for a client
    getTrend: authenticatedProcedure
      .input(z.object({
        clientId: z.number(),
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        const result = await db.getAthleteMonitoringTrend(input.clientId, input.startDate, input.endDate);
        return result || [];
      }),
  }),

  vo2MaxTests: router({
    // Upload VO2 Max test PDF (trainer only)
    upload: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        filename: z.string(),
        fileData: z.string(), // Base64 encoded PDF
        testDate: z.date(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const { analyzeVo2MaxPdf } = await import('./vo2MaxAnalysis');
          const { storagePut } = await import('./storage');
          
          // Decode base64 and upload to S3
          const buffer = Buffer.from(input.fileData, 'base64');
          const fileKey = `vo2-max-tests/${input.clientId}/${Date.now()}-${input.filename}`;
          const { url } = await storagePut(fileKey, buffer, 'application/pdf');
          
          // Create initial test record
          const testId = await db.createVo2MaxTest({
            clientId: input.clientId,
            pdfUrl: url,
            pdfFileKey: fileKey,
            filename: input.filename,
            testDate: input.testDate,
            uploadedBy: ctx.user.id,
          });
          
          console.log('[vo2MaxTests.upload] Created test with ID:', testId);
          
          // Analyze PDF with AI in background
          console.log('[vo2MaxTests.upload] Triggering AI analysis...');
          analyzeVo2MaxPdf(url).then(async (extracted) => {
            console.log('[vo2MaxTests.upload] AI extraction complete, saving to database...');
            
            // Save ambient data
            if (extracted.ambientData) {
              await db.createVo2MaxAmbientData({
                testId,
                temperature: extracted.ambientData.temperature?.toString(),
                pressure: extracted.ambientData.pressure || undefined,
                humidity: extracted.ambientData.humidity || undefined,
              });
            }
            
            // Save anthropometric data
            if (extracted.anthropometric) {
              await db.createVo2MaxAnthropometric({
                testId,
                height: extracted.anthropometric.height?.toString(),
                weight: extracted.anthropometric.weight?.toString(),
                restingHeartRate: extracted.anthropometric.restingHeartRate || undefined,
                restingBpSystolic: extracted.anthropometric.restingBpSystolic || undefined,
                restingBpDiastolic: extracted.anthropometric.restingBpDiastolic || undefined,
                restingLactate: extracted.anthropometric.restingLactate?.toString(),
              });
            }
            
            // Save fitness assessment data
            if (extracted.fitnessAssessment) {
              await db.createVo2MaxFitnessAssessment({
                testId,
                aerobicThresholdLactate: extracted.fitnessAssessment.aerobicThresholdLactate?.toString(),
                aerobicThresholdSpeed: extracted.fitnessAssessment.aerobicThresholdSpeed?.toString(),
                aerobicThresholdHr: extracted.fitnessAssessment.aerobicThresholdHr || undefined,
                aerobicThresholdHrPct: extracted.fitnessAssessment.aerobicThresholdHrPct || undefined,
                lactateThresholdLactate: extracted.fitnessAssessment.lactateThresholdLactate?.toString(),
                lactateThresholdSpeed: extracted.fitnessAssessment.lactateThresholdSpeed?.toString(),
                lactateThresholdHr: extracted.fitnessAssessment.lactateThresholdHr || undefined,
                lactateThresholdHrPct: extracted.fitnessAssessment.lactateThresholdHrPct || undefined,
                maximumLactate: extracted.fitnessAssessment.maximumLactate?.toString(),
                maximumSpeed: extracted.fitnessAssessment.maximumSpeed?.toString(),
                maximumHr: extracted.fitnessAssessment.maximumHr || undefined,
                maximumHrPct: extracted.fitnessAssessment.maximumHrPct || undefined,
                vo2MaxMlKgMin: extracted.fitnessAssessment.vo2MaxMlKgMin?.toString(),
                vo2MaxLMin: extracted.fitnessAssessment.vo2MaxLMin?.toString(),
                vco2LMin: extracted.fitnessAssessment.vco2LMin?.toString(),
                rer: extracted.fitnessAssessment.rer?.toString(),
                rrBrMin: extracted.fitnessAssessment.rrBrMin?.toString(),
                veBtpsLMin: extracted.fitnessAssessment.veBtpsLMin?.toString(),
                rpe: extracted.fitnessAssessment.rpe || undefined,
              });
            }
            
            // Save lactate profile data points
            if (extracted.lactateProfile && extracted.lactateProfile.length > 0) {
              const profileData = extracted.lactateProfile.map((point: { stageNumber: number; workloadSpeed: number; lactate: number; heartRate: number }) => ({
                testId,
                stageNumber: point.stageNumber,
                workloadSpeed: point.workloadSpeed.toString(),
                lactate: point.lactate.toString(),
                heartRate: point.heartRate,
              }));
              await db.createVo2MaxLactateProfile(profileData);
            }
            
            console.log('[vo2MaxTests.upload] AI analysis saved successfully');
          }).catch(error => {
            console.error('[vo2MaxTests.upload] Failed to analyze VO2 Max test:', error);
          });
          
          return { success: true, testId };
        } catch (error) {
          console.error('Error uploading VO2 Max test:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to upload VO2 Max test',
          });
        }
      }),

    // Get all VO2 Max tests for a client (ordered by test date, newest first)
    getAll: authenticatedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const tests = await db.getVo2MaxTestsByClientId(input.clientId);
        return tests;
      }),

    // Get detailed data for a specific test
    getTestDetails: authenticatedProcedure
      .input(z.object({ testId: z.number() }))
      .query(async ({ input }) => {
        console.log('[getTestDetails] Fetching data for testId:', input.testId);
        const [test, ambientData, anthropometric, fitnessAssessment, lactateProfile] = await Promise.all([
          db.getVo2MaxTestById(input.testId),
          db.getVo2MaxAmbientData(input.testId),
          db.getVo2MaxAnthropometric(input.testId),
          db.getVo2MaxFitnessAssessment(input.testId),
          db.getVo2MaxLactateProfile(input.testId),
        ]);
        
        console.log('[getTestDetails] Results:', {
          test: !!test,
          ambientData: !!ambientData,
          anthropometric: !!anthropometric,
          fitnessAssessment: !!fitnessAssessment,
          lactateProfileCount: lactateProfile.length
        });
        
        return {
          test,
          ambientData,
          anthropometric,
          fitnessAssessment,
          lactateProfile,
        };
      }),

    // Get trend data for anthropometric metrics across all tests
    getAnthropometricTrend: authenticatedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const data = await db.getVo2MaxAnthropometricByClientId(input.clientId);
        return data;
      }),

    // Get trend data for fitness assessment metrics across all tests
    getFitnessAssessmentTrend: authenticatedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const data = await db.getVo2MaxFitnessAssessmentByClientId(input.clientId);
        return data;
      }),

    // Update ambient data (trainer only)
    updateAmbientData: protectedProcedure
      .input(z.object({
        testId: z.number(),
        temperature: z.string().optional(),
        pressure: z.string().optional(),
        humidity: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateVo2MaxAmbientData(input.testId, {
          temperature: input.temperature,
          pressure: input.pressure ? parseInt(input.pressure, 10) : undefined,
          humidity: input.humidity ? parseInt(input.humidity, 10) : undefined,
        });
        return { success: true };
      }),

    // Update anthropometric data (trainer only)
    updateAnthropometric: protectedProcedure
      .input(z.object({
        testId: z.number(),
        height: z.string().optional(),
        weight: z.string().optional(),
        restingHr: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateVo2MaxAnthropometric(input.testId, {
          height: input.height,
          weight: input.weight,
          restingHr: input.restingHr,
        });
        return { success: true };
      }),

    // Update fitness assessment data (trainer only)
    updateFitnessAssessment: protectedProcedure
      .input(z.object({
        testId: z.number(),
        aerobicThresholdLactate: z.string().optional(),
        aerobicThresholdSpeed: z.string().optional(),
        aerobicThresholdHr: z.number().optional(),
        lactateThresholdLactate: z.string().optional(),
        lactateThresholdSpeed: z.string().optional(),
        lactateThresholdHr: z.number().optional(),
        maximumLactate: z.string().optional(),
        maximumSpeed: z.string().optional(),
        maximumHr: z.number().optional(),
        vo2MaxMlKgMin: z.string().optional(),
        vo2MaxLMin: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateVo2MaxFitnessAssessment(input.testId, {
          aerobicThresholdLactate: input.aerobicThresholdLactate,
          aerobicThresholdSpeed: input.aerobicThresholdSpeed,
          aerobicThresholdHr: input.aerobicThresholdHr,
          lactateThresholdLactate: input.lactateThresholdLactate,
          lactateThresholdSpeed: input.lactateThresholdSpeed,
          lactateThresholdHr: input.lactateThresholdHr,
          maximumLactate: input.maximumLactate,
          maximumSpeed: input.maximumSpeed,
          maximumHr: input.maximumHr,
          vo2MaxMlKgMin: input.vo2MaxMlKgMin,
          vo2MaxLMin: input.vo2MaxLMin,
        });
        return { success: true };
      }),

    // Delete a VO2 Max test (trainer only)
    delete: protectedProcedure
      .input(z.object({ testId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteVo2MaxTest(input.testId);
        return { success: true };
      }),
  }),

  // ============================================================================
  // Trainer Notifications
  // ============================================================================
  notifications: router({
    // Get unread notifications for the logged-in trainer
    getUnread: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUnreadNotifications(ctx.user.id);
    }),

    // Get all notifications for the logged-in trainer
    getAll: protectedProcedure
      .input(z.object({ limit: z.number().optional().default(50) }))
      .query(async ({ ctx, input }) => {
        return await db.getTrainerNotifications(ctx.user.id, input.limit);
      }),

    // Mark notification as read
    markAsRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ input }) => {
        await db.markNotificationAsRead(input.notificationId);
        return { success: true };
      }),

    // Dismiss notification
    dismiss: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ input }) => {
        await db.dismissNotification(input.notificationId);
        return { success: true };
      }),

    // Get notification settings
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      return await db.getNotificationSettings(ctx.user.id);
    }),

    // Update notification settings
    updateSettings: protectedProcedure
      .input(
        z.object({
          nutritionDeviationEnabled: z.boolean().optional(),
          nutritionDeviationThreshold: z.number().optional(),
          nutritionDeviationDays: z.number().optional(),
          wellnessAlertsEnabled: z.boolean().optional(),
          wellnessPoorScoreThreshold: z.number().optional(),
          wellnessPoorScoreDays: z.number().optional(),
          emailNotificationsEnabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateNotificationSettings(ctx.user.id, input);
        return { success: true };
      }),

    // Manually trigger pattern check for a specific client (trainer only)
    checkClientPatterns: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { checkClientPatterns } = await import("./notificationService");
        await checkClientPatterns(input.clientId, ctx.user.id);
        return { success: true };
      }),

    // Manually trigger pattern check for all clients (trainer only)
    checkAllClients: protectedProcedure.mutation(async ({ ctx }) => {
      const { checkAllClientsForTrainer } = await import("./notificationService");
      await checkAllClientsForTrainer(ctx.user.id);
      return { success: true };
    }),
  }),

  // Supplement management
  supplements: router({
    // Get all supplement templates for a client
    getTemplates: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getSupplementTemplatesByClient(input.clientId);
      }),

    // Create a new supplement template
    createTemplate: publicProcedure
      .input(
        z.object({
          clientId: z.number(),
          name: z.string().min(1).max(255),
          dose: z.string().min(1).max(100),
        })
      )
      .mutation(async ({ input }) => {
        // Check if client already has 5 templates
        const existing = await db.getSupplementTemplatesByClient(input.clientId);
        if (existing.length >= 5) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Maximum 5 supplement templates allowed per client",
          });
        }
        
        return db.createSupplementTemplate(input);
      }),

    // Update a supplement template
    updateTemplate: publicProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(255).optional(),
          dose: z.string().min(1).max(100).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        return db.updateSupplementTemplate(id, updates);
      }),

    // Delete a supplement template
    deleteTemplate: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteSupplementTemplate(input.id);
      }),

    // Log a supplement intake
    logSupplement: publicProcedure
      .input(
        z.object({
          clientId: z.number(),
          supplementTemplateId: z.number(),
          name: z.string(),
          dose: z.string(),
          loggedAt: z.date(),
        })
      )
      .mutation(async ({ input }) => {
        return db.createSupplementLog(input);
      }),

    // Get supplement logs for a client
    getLogs: publicProcedure
      .input(
        z.object({
          clientId: z.number(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        })
      )
      .query(async ({ input }) => {
        return db.getSupplementLogsByClient(
          input.clientId,
          input.startDate,
          input.endDate
        );
      }),

    // Delete a supplement log
    deleteLog: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteSupplementLog(input.id);
      }),
  }),

  // Training Sessions & Scheduling
  trainingSessions: router({
    // Update an existing training session (trainer only)
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          sessionDate: z.string().optional(), // YYYY-MM-DD format
          startTime: z.string().optional(), // HH:MM format
          endTime: z.string().optional(), // HH:MM format
          sessionType: z.enum(["1on1_pt", "2on1_pt", "nutrition_initial", "nutrition_coaching"]).optional(),
          paymentStatus: z.enum(["paid", "unpaid", "from_package"]).optional(),
          packageId: z.number().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const updates: any = {};
        if (input.sessionDate) updates.sessionDate = new Date(input.sessionDate);
        if (input.startTime) updates.startTime = input.startTime;
        if (input.endTime) updates.endTime = input.endTime;
        if (input.sessionType) updates.sessionType = input.sessionType;
        if (input.paymentStatus) updates.paymentStatus = input.paymentStatus;
        if (input.packageId !== undefined) updates.packageId = input.packageId;

        const session = await db.updateTrainingSession(input.id, updates);

        // TODO: Send email notification to client about session changes
        // await sendSessionUpdateEmail(session);

        return session;
      }),

    // Create a new training session (trainer only)
    create: adminProcedure
      .input(
        z.object({
          clientId: z.number(),
          sessionType: z.enum(["1on1_pt", "2on1_pt", "nutrition_initial", "nutrition_coaching", "custom"]),
          sessionDate: z.string(), // YYYY-MM-DD format
          startTime: z.string(), // HH:MM format
          endTime: z.string(), // HH:MM format
          paymentStatus: z.enum(["paid", "unpaid", "from_package"]).default("unpaid"),
          packageId: z.number().optional(),
          notes: z.string().optional(),
          // Custom session fields
          customSessionName: z.string().optional(),
          customDurationMinutes: z.number().optional(),
          customPrice: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
         // Note: Package balance is now calculated dynamically based on completed sessions
        // We no longer decrement immediately on booking
        
        // Cast to any to avoid type issues with date strings
        const session = await db.createTrainingSession({
          trainerId: ctx.user.id,
          clientId: input.clientId,
          sessionType: input.sessionType,
          sessionDate: input.sessionDate,
          startTime: input.startTime,
          endTime: input.endTime,
          paymentStatus: input.paymentStatus,
          packageId: input.packageId || null,
          notes: input.notes || null,
          recurringRuleId: null,
          cancelled: false,
          cancelledAt: null,
          customSessionName: input.customSessionName || null,
          customDurationMinutes: input.customDurationMinutes || null,
          customPrice: input.customPrice || null,
        } as any);

        // Send booking confirmation email
        const client = await db.getClientById(input.clientId);
        if (client && client.email) {
          const { sendSessionBookingConfirmation } = await import('./sessionEmailNotifications');
          await sendSessionBookingConfirmation({
            id: session.id,
            clientName: client.name,
            clientEmail: client.email,
            sessionType: input.sessionType,
            customSessionName: input.customSessionName,
            customPrice: input.customPrice,
            sessionDate: input.sessionDate,
            startTime: input.startTime,
            endTime: input.endTime,
            trainerName: ctx.user.name || 'Your Trainer',
            notes: input.notes,
          });
        }

        return session;
      }),

    // Get sessions for a client
    getByClient: publicProcedure
      .input(
        z.object({
          clientId: z.number(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        })
      )
      .query(async ({ input }) => {
        return db.getTrainingSessionsByClient(
          input.clientId,
          input.startDate,
          input.endDate
        );
      }),

    // Get sessions for a trainer
    getByTrainer: adminProcedure
      .input(
        z.object({
          startDate: z.string().optional(), // YYYY-MM-DD format
          endDate: z.string().optional(), // YYYY-MM-DD format
        })
      )
      .query(async ({ ctx, input }) => {
        // Convert string dates to Date objects if provided
        const startDate = input.startDate ? new Date(input.startDate) : undefined;
        const endDate = input.endDate ? new Date(input.endDate) : undefined;
        return db.getTrainingSessionsByTrainer(
          ctx.user.id,
          startDate,
          endDate
        );
      }),

    // Get a specific session by ID
    getById: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return db.getTrainingSessionById(input.sessionId);
      }),

    // Cancel a training session (trainer only)
    cancel: adminProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        return db.cancelTrainingSession(input.sessionId);
      }),

    // Delete a training session (trainer only)
    delete: adminProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Get session details before deletion for email notification
        const session = await db.getTrainingSessionById(input.sessionId);
        
        if (session && !session.cancelled) {
          // Get client details
          const client = await db.getClientById(session.clientId);
          
          // Delete the session
          await db.deleteTrainingSession(input.sessionId);
          
          // Send cancellation email
          if (client && client.email) {
            const { sendSessionCancellationNotification } = await import('./sessionEmailNotifications');
            await sendSessionCancellationNotification({
              id: session.id,
              clientName: client.name,
              clientEmail: client.email,
              sessionType: session.sessionType,
              sessionDate: new Date(session.sessionDate).toISOString().split('T')[0],
              startTime: session.startTime,
              endTime: session.endTime,
              trainerName: ctx.user.name || 'Your Trainer',
              notes: session.notes || undefined,
            });
          }
        } else {
          await db.deleteTrainingSession(input.sessionId);
        }
        
        return { success: true };
      }),

    // Get upcoming sessions for a client (client-accessible)
    getUpcoming: publicProcedure
      .input(
        z.object({
          clientId: z.number(),
          days: z.number().default(30), // Number of days to look ahead
        })
      )
      .query(async ({ input }) => {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + input.days);

        const sessions = await db.getTrainingSessionsByClient(
          input.clientId,
          new Date(startDate.toISOString().split('T')[0]),
          new Date(endDate.toISOString().split('T')[0])
        );

        return sessions;
      }),

    // Create recurring training sessions (trainer only)
    createRecurring: adminProcedure
      .input(
        z.object({
          clientId: z.number(),
          sessionType: z.enum(["1on1_pt", "2on1_pt", "nutrition_initial", "nutrition_coaching", "custom"]),
          startTime: z.string(), // HH:MM format
          endTime: z.string(), // HH:MM format
          paymentStatus: z.enum(["paid", "unpaid", "from_package"]).default("unpaid"),
          packageId: z.number().optional(),
          notes: z.string().optional(),
          startDate: z.string(), // YYYY-MM-DD format
          endDate: z.string(), // YYYY-MM-DD format
          daysOfWeek: z.array(z.number().min(0).max(6)), // 0 = Sunday, 6 = Saturday
          // Custom session fields
          customSessionName: z.string().optional(),
          customDurationMinutes: z.number().optional(),
          customPrice: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { generateRecurringSessions } = await import('./recurringSessionGenerator');
        
        const sessionIds = await generateRecurringSessions({
          trainerId: ctx.user.id,
          clientId: input.clientId,
          sessionType: input.sessionType,
          startTime: input.startTime,
          endTime: input.endTime,
          paymentStatus: input.paymentStatus,
          packageId: input.packageId,
          notes: input.notes,
          startDate: input.startDate,
          endDate: input.endDate,
          daysOfWeek: input.daysOfWeek,
          customSessionName: input.customSessionName,
          customDurationMinutes: input.customDurationMinutes,
          customPrice: input.customPrice,
        });

        // Send booking confirmation emails for all sessions
        const client = await db.getClientById(input.clientId);
        if (client && client.email) {
          const { sendSessionBookingConfirmation } = await import('./sessionEmailNotifications');
          
          // Send one email summarizing the recurring sessions
          const firstSession = await db.getTrainingSessionById(sessionIds[0]);
          if (firstSession) {
            await sendSessionBookingConfirmation({
              id: firstSession.id,
              clientName: client.name,
              clientEmail: client.email,
              sessionType: input.sessionType,
              sessionDate: new Date(firstSession.sessionDate).toISOString().split('T')[0],
              startTime: input.startTime,
              endTime: input.endTime,
              trainerName: ctx.user.name || 'Your Trainer',
              notes: `Recurring session: ${sessionIds.length} sessions created`,
            });
          }
        }

        return { success: true, sessionIds, count: sessionIds.length };
      }),
  }),

  // Session Packages
  sessionPackages: router({
    // Create a new package (trainer only)
    create: adminProcedure
      .input(
        z.object({
          clientId: z.number(),
          packageType: z.string(),
          sessionsTotal: z.number(),
          purchaseDate: z.string(), // YYYY-MM-DD format
          expiryDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Cast to any to avoid type issues with date strings
        return db.createSessionPackage({
          trainerId: ctx.user.id,
          clientId: input.clientId,
          packageType: input.packageType,
          sessionsTotal: input.sessionsTotal,
          sessionsRemaining: input.sessionsTotal, // Initialised once at creation; not maintained thereafter — balance is derived dynamically
          purchaseDate: input.purchaseDate,
          expiryDate: input.expiryDate || null,
          notes: input.notes || null,
        } as any);
      }),

    // Get packages for a client
    getByClient: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getSessionPackagesByClient(input.clientId);
      }),

    // Get packages for a trainer
    getByTrainer: adminProcedure
      .input(z.object({ trainerId: z.number() }))
      .query(async ({ input }) => {
        return db.getSessionPackagesByTrainer(input.trainerId);
      }),

    // Get a specific package by ID
    getById: publicProcedure
      .input(z.object({ packageId: z.number() }))
      .query(async ({ input }) => {
        return db.getSessionPackageById(input.packageId);
      }),

    // Update a package (trainer only)
    update: adminProcedure
      .input(
        z.object({
          packageId: z.number(),
          // sessionsRemaining intentionally excluded — balance is derived dynamically from session records
          expiryDate: z.string().optional(), // YYYY-MM-DD format
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { packageId, ...updates } = input;
        // Cast to any to avoid type issues with date strings
        return db.updateSessionPackage(packageId, updates as any);
      }),
  }),

  // Group Classes
  groupClasses: router({
    // Create a new group class (trainer only)
    create: adminProcedure
      .input(
        z.object({
          classType: z.enum(["hyrox", "mobility", "rehab", "conditioning", "strength_conditioning"]),
          classDate: z.string(), // YYYY-MM-DD format
          startTime: z.string(), // HH:MM format
          endTime: z.string(), // HH:MM format
          capacity: z.number().default(20),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Cast to any to avoid type issues with date strings
        return db.createGroupClass({
          trainerId: ctx.user.id,
          classType: input.classType,
          classDate: input.classDate,
          startTime: input.startTime,
          endTime: input.endTime,
          capacity: input.capacity,
          notes: input.notes || null,
          recurringRuleId: null,
          cancelled: false,
          cancelledAt: null,
        } as any);
      }),

    // Get group classes for a trainer
    getByTrainer: adminProcedure
      .input(
        z.object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        return db.getGroupClassesByTrainer(
          ctx.user.id,
          input.startDate,
          input.endDate
        );
      }),

    // Get group classes for a client
    getByClient: publicProcedure
      .input(
        z.object({
          clientId: z.number(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        })
      )
      .query(async ({ input }) => {
        return db.getGroupClassesByClient(
          input.clientId,
          input.startDate,
          input.endDate
        );
      }),

    // Get a specific group class by ID
    getById: publicProcedure
      .input(z.object({ classId: z.number() }))
      .query(async ({ input }) => {
        return db.getGroupClassById(input.classId);
      }),

    // Update a group class (trainer only)
    update: adminProcedure
      .input(
        z.object({
          classId: z.number(),
          classDate: z.string().optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          capacity: z.number().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { classId, ...updates } = input;
        // Cast to any to avoid type issues with date strings
        return db.updateGroupClass(classId, updates as any);
      }),

    // Cancel a group class (trainer only)
    cancel: adminProcedure
      .input(z.object({ classId: z.number() }))
      .mutation(async ({ input }) => {
        return db.cancelGroupClass(input.classId);
      }),

    // Delete a group class (trainer only)
    delete: adminProcedure
      .input(z.object({ classId: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteGroupClass(input.classId);
      }),

    // Add a client to a group class (trainer only)
    addClient: adminProcedure
      .input(
        z.object({
          classId: z.number(),
          clientId: z.number(),
          paymentStatus: z.enum(["paid", "unpaid", "from_package"]).default("unpaid"),
          packageId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return db.addClientToGroupClass({
          groupClassId: input.classId,
          clientId: input.clientId,
          paymentStatus: input.paymentStatus,
          packageId: input.packageId || null,
          attended: false,
        });
      }),

    // Remove a client from a group class (trainer only)
    removeClient: adminProcedure
      .input(z.object({ attendanceId: z.number() }))
      .mutation(async ({ input }) => {
        return db.removeClientFromGroupClass(input.attendanceId);
      }),

    // Get attendees for a group class
    getAttendees: publicProcedure
      .input(z.object({ classId: z.number() }))
      .query(async ({ input }) => {
        return db.getGroupClassAttendees(input.classId);
      }),

    // Mark attendance (trainer only)
    markAttendance: adminProcedure
      .input(
        z.object({
          attendanceId: z.number(),
          attended: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        return db.markGroupClassAttendance(input.attendanceId, input.attended);
      }),

    // Get upcoming group classes for a client (client-accessible)
    getClientClasses: publicProcedure
      .input(
        z.object({
          clientId: z.number(),
          days: z.number().default(30),
        })
      )
      .query(async ({ input }) => {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + input.days);

        return db.getGroupClassesByClient(
          input.clientId,
          new Date(startDate.toISOString().split('T')[0]),
          new Date(endDate.toISOString().split('T')[0])
        );
      }),

    // Create recurring group classes (trainer only)
    createRecurring: adminProcedure
      .input(
        z.object({
          classType: z.enum(["hyrox", "mobility", "rehab", "conditioning", "strength_conditioning"]),
          startTime: z.string(), // HH:MM format
          endTime: z.string(), // HH:MM format
          capacity: z.number().default(20),
          notes: z.string().optional(),
          startDate: z.string(), // YYYY-MM-DD format
          endDate: z.string(), // YYYY-MM-DD format
          daysOfWeek: z.array(z.number().min(0).max(6)), // 0 = Sunday, 6 = Saturday
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { generateRecurringGroupClasses } = await import('./recurringSessionGenerator');
        
        const classIds = await generateRecurringGroupClasses({
          trainerId: ctx.user.id,
          classType: input.classType,
          startTime: input.startTime,
          endTime: input.endTime,
          capacity: input.capacity,
          notes: input.notes,
          startDate: input.startDate,
          endDate: input.endDate,
          daysOfWeek: input.daysOfWeek,
        });

        return { success: true, classIds, count: classIds.length };
      }),
  }),

  // Database Backup
  backup: router({
    // Get the most recent backup log entry (global — same result for all trainers)
    getLastLog: protectedProcedure.query(async ({ ctx: _ctx }) => {
      return db.getLastBackupLog();
    }),

    // Manually trigger database backup email (admin only)
    sendBackup: adminProcedure
      .input(z.object({
        recipientEmail: z.string().email(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createAndEmailBackup } = await import('./backup');
        // Pass trainerId so backup.ts writes to backup_logs (single source of truth)
        const result = await createAndEmailBackup(input.recipientEmail, ctx.user.id);

        if (!result.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.message });
        }

        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
