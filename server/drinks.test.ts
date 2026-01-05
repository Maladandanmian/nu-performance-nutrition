import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';

describe('Drink logging and editing', () => {
  let clientId: number;
  let drinkId: number;

  beforeAll(async () => {
    // Create a test client
    const result = await db.createClient({
      name: 'Test Drink Client',
      pin: '123456',
      email: 'drinktest@example.com',
      trainerId: 1,
    });
    clientId = Number(result[0].insertId);
  });

  afterAll(async () => {
    // Cleanup - delete test data
    if (drinkId) {
      await db.deleteDrink(drinkId);
    }
    if (clientId) {
      // Delete client and related data
      const meals = await db.getMealsByClientId(clientId);
      for (const meal of meals) {
        await db.deleteMeal(meal.id);
      }
      const drinks = await db.getDrinksByClientId(clientId);
      for (const drink of drinks) {
        await db.deleteDrink(drink.id);
      }
      // Delete client
      await db.deleteClient(clientId);
    }
  });

  it('should create a drink with nutrition data', async () => {
    const result = await db.createDrink({
      clientId,
      drinkType: 'English Breakfast Tea with Milk',
      volumeMl: 350,
      calories: 28,
      protein: 1,
      fat: 1,
      carbs: 3,
      fibre: 0,
      loggedAt: new Date(),
    });

    drinkId = Number(result[0].insertId);
    expect(drinkId).toBeGreaterThan(0);

    // Verify drink was created
    const drinks = await db.getDrinksByClientId(clientId);
    const drink = drinks.find(d => d.id === drinkId);
    expect(drink).toBeDefined();
    expect(drink?.drinkType).toBe('English Breakfast Tea with Milk');
    expect(drink?.volumeMl).toBe(350);
    expect(drink?.calories).toBe(28);
  });

  it('should update a drink with new values', async () => {
    if (!drinkId) {
      throw new Error('Drink not created');
    }

    await db.updateDrink(drinkId, {
      drinkType: 'Green Tea with Milk',
      volumeMl: 250,
    });

    const drinks = await db.getDrinksByClientId(clientId);
    const drink = drinks.find(d => d.id === drinkId);
    expect(drink?.drinkType).toBe('Green Tea with Milk');
    expect(drink?.volumeMl).toBe(250);
  });

  it('should delete a drink', async () => {
    if (!drinkId) {
      throw new Error('Drink not created');
    }

    await db.deleteDrink(drinkId);

    const drinks = await db.getDrinksByClientId(clientId);
    const drink = drinks.find(d => d.id === drinkId);
    expect(drink).toBeUndefined();
  });
});
