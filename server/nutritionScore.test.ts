import { describe, it, expect } from 'vitest';
import { calculateNutritionScore } from './qwenVision';

describe('Time-Aware Nutrition Scoring', () => {
  const goals = {
    caloriesTarget: 2200,
    proteinTarget: 152,
    fatTarget: 69,
    carbsTarget: 243,
    fibreTarget: 25,
  };

  const burger = {
    calories: 800,
    protein: 45,
    fat: 45,
    carbs: 50,
    fibre: 3,
  };

  const salad = {
    calories: 150,
    protein: 5,
    fat: 2,
    carbs: 25,
    fibre: 8,
  };

  describe('Morning meals (6am-12pm)', () => {
    it('should be forgiving for burger at 8am with 0% progress', () => {
      const morningTime = new Date('2026-01-22T08:00:00+08:00');
      const todaysTotals = { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 };
      
      const score = calculateNutritionScore(burger, goals, todaysTotals, morningTime);
      
      // Should score 3-4/5 (acceptable, can adjust later in the day)
      expect(score).toBeGreaterThanOrEqual(3);
      expect(score).toBeLessThanOrEqual(4);
    });

    it('should score salad highly at 9am with 0% progress', () => {
      const morningTime = new Date('2026-01-22T09:00:00+08:00');
      const todaysTotals = { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 };
      
      const score = calculateNutritionScore(salad, goals, todaysTotals, morningTime);
      
      // Should score 4-5/5 (good start)
      expect(score).toBeGreaterThanOrEqual(4);
      expect(score).toBeLessThanOrEqual(5);
    });
  });

  describe('Evening meals (6pm-11pm)', () => {
    it('should heavily penalize burger at 8pm with 90% progress', () => {
      const eveningTime = new Date('2026-01-22T20:00:00+08:00');
      const todaysTotals = {
        calories: 1980, // 90% of 2200
        protein: 137,   // 90% of 152
        fat: 62,        // 90% of 69
        carbs: 219,     // 90% of 243
        fibre: 22,      // 90% of 25
      };
      
      const score = calculateNutritionScore(burger, goals, todaysTotals, eveningTime);
      
      // Should score 1-2/5 (very bad timing - pushes way over targets)
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(2);
    });

    it('should reward salad at 8pm with 95% progress', () => {
      const eveningTime = new Date('2026-01-22T20:00:00+08:00');
      const todaysTotals = {
        calories: 2090, // 95% of 2200
        protein: 144,   // 95% of 152
        fat: 66,        // 95% of 69
        carbs: 231,     // 95% of 243
        fibre: 24,      // 95% of 25
      };
      
      const score = calculateNutritionScore(salad, goals, todaysTotals, eveningTime);
      
      // Should score 4-5/5 (good choice - light meal when budget exhausted)
      expect(score).toBeGreaterThanOrEqual(4);
      expect(score).toBeLessThanOrEqual(5);
    });

    it('should penalize burger at 8pm with 50% progress less than at 90%', () => {
      const eveningTime = new Date('2026-01-22T20:00:00+08:00');
      const todaysTotals50 = {
        calories: 1100, // 50% of 2200
        protein: 76,    // 50% of 152
        fat: 35,        // 50% of 69
        carbs: 122,     // 50% of 243
        fibre: 13,      // 50% of 25
      };
      const todaysTotals90 = {
        calories: 1980, // 90% of 2200
        protein: 137,   // 90% of 152
        fat: 62,        // 90% of 69
        carbs: 219,     // 90% of 243
        fibre: 22,      // 90% of 25
      };
      
      const score50 = calculateNutritionScore(burger, goals, todaysTotals50, eveningTime);
      const score90 = calculateNutritionScore(burger, goals, todaysTotals90, eveningTime);
      
      // Score at 50% should be higher than at 90%
      expect(score50).toBeGreaterThan(score90);
    });
  });

  describe('Late night meals (11pm+)', () => {
    it('should very heavily penalize any significant calories at 11pm with 100% progress', () => {
      const lateNightTime = new Date('2026-01-22T23:00:00+08:00');
      const todaysTotals = {
        calories: 2200, // 100% of target
        protein: 152,
        fat: 69,
        carbs: 243,
        fibre: 25,
      };
      
      const snack = {
        calories: 300,
        protein: 10,
        fat: 15,
        carbs: 30,
        fibre: 2,
      };
      
      const score = calculateNutritionScore(snack, goals, todaysTotals, lateNightTime);
      
      // Should score 1-2/5 (day is over, shouldn't be eating)
      // Note: Score is averaged across multiple factors, so 2/5 is realistic
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(2);
    });
  });

  describe('Afternoon meals (12pm-6pm)', () => {
    it('should score large meal reasonably at 12pm with 30% progress', () => {
      const afternoonTime = new Date('2026-01-22T12:00:00+08:00');
      const todaysTotals = {
        calories: 660,  // 30% of 2200
        protein: 46,    // 30% of 152
        fat: 21,        // 30% of 69
        carbs: 73,      // 30% of 243
        fibre: 8,       // 30% of 25
      };
      
      const largeMeal = {
        calories: 700,
        protein: 50,
        fat: 25,
        carbs: 80,
        fibre: 10,
      };
      
      const score = calculateNutritionScore(largeMeal, goals, todaysTotals, afternoonTime);
      
      // Should score 4-5/5 (reasonable - still have afternoon/evening to adjust)
      // Large balanced meal at noon with only 30% progress is fine
      expect(score).toBeGreaterThanOrEqual(4);
      expect(score).toBeLessThanOrEqual(5);
    });
  });

  describe('Critical nutrient violations', () => {
    it('should penalize meals that push calories >120% of target', () => {
      const eveningTime = new Date('2026-01-22T20:00:00+08:00');
      const todaysTotals = {
        calories: 2000, // 91% of 2200
        protein: 100,
        fat: 50,
        carbs: 200,
        fibre: 20,
      };
      
      const highCalorieMeal = {
        calories: 700, // Would push to 2700 (123% of target)
        protein: 30,
        fat: 35,
        carbs: 60,
        fibre: 3,
      };
      
      const score = calculateNutritionScore(highCalorieMeal, goals, todaysTotals, eveningTime);
      
      // Should score 2-3/5 (critical violation in evening)
      // Note: Violations are penalized but averaged with other factors
      expect(score).toBeGreaterThanOrEqual(2);
      expect(score).toBeLessThanOrEqual(3);
    });
  });

  describe('Zero-calorie beverages', () => {
    it('should return neutral score (3/5) for zero-calorie drinks', () => {
      const anyTime = new Date('2026-01-22T15:00:00+08:00');
      const anyProgress = { calories: 1000, protein: 50, fat: 30, carbs: 100, fibre: 10 };
      
      const water = {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        fibre: 0,
      };
      
      const score = calculateNutritionScore(water, goals, anyProgress, anyTime);
      
      // Should always return 3/5 (neutral)
      expect(score).toBe(3);
    });
  });
});
