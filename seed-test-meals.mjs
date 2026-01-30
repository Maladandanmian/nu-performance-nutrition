import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.js';
import 'dotenv/config';

const TEST_CLIENT_ID = 990036;

// Mock meal data templates
const mealTemplates = [
  // Breakfasts
  {
    type: 'breakfast',
    items: [
      { name: 'Oatmeal with berries', quantity: '1 bowl', calories: 280, protein: 8, carbs: 52, fat: 5, fibre: 8 },
      { name: 'Banana', quantity: '1 medium', calories: 105, protein: 1, carbs: 27, fat: 0, fibre: 3 },
    ],
  },
  {
    type: 'breakfast',
    items: [
      { name: 'Scrambled eggs', quantity: '2 eggs', calories: 180, protein: 12, carbs: 2, fat: 14, fibre: 0 },
      { name: 'Whole wheat toast', quantity: '2 slices', calories: 160, protein: 8, carbs: 28, fat: 2, fibre: 4 },
      { name: 'Avocado', quantity: '1/2 avocado', calories: 120, protein: 1, carbs: 6, fat: 11, fibre: 5 },
    ],
  },
  {
    type: 'breakfast',
    items: [
      { name: 'Greek yogurt', quantity: '200g', calories: 150, protein: 15, carbs: 12, fat: 4, fibre: 0 },
      { name: 'Granola', quantity: '1/2 cup', calories: 210, protein: 5, carbs: 38, fat: 6, fibre: 4 },
      { name: 'Mixed berries', quantity: '1 cup', calories: 70, protein: 1, carbs: 17, fat: 0, fibre: 4 },
    ],
  },
  // Lunches
  {
    type: 'lunch',
    items: [
      { name: 'Grilled chicken breast', quantity: '150g', calories: 240, protein: 45, carbs: 0, fat: 5, fibre: 0 },
      { name: 'Brown rice', quantity: '1 cup', calories: 215, protein: 5, carbs: 45, fat: 2, fibre: 4 },
      { name: 'Steamed broccoli', quantity: '1 cup', calories: 55, protein: 4, carbs: 11, fat: 1, fibre: 5 },
    ],
  },
  {
    type: 'lunch',
    items: [
      { name: 'Salmon fillet', quantity: '120g', calories: 280, protein: 35, carbs: 0, fat: 15, fibre: 0 },
      { name: 'Quinoa', quantity: '1 cup', calories: 220, protein: 8, carbs: 39, fat: 4, fibre: 5 },
      { name: 'Mixed salad', quantity: '2 cups', calories: 40, protein: 2, carbs: 8, fat: 0, fibre: 3 },
    ],
  },
  {
    type: 'lunch',
    items: [
      { name: 'Turkey sandwich', quantity: '1 sandwich', calories: 350, protein: 28, carbs: 42, fat: 8, fibre: 6 },
      { name: 'Apple', quantity: '1 medium', calories: 95, protein: 0, carbs: 25, fat: 0, fibre: 4 },
    ],
  },
  // Dinners
  {
    type: 'dinner',
    items: [
      { name: 'Beef stir-fry', quantity: '200g', calories: 320, protein: 35, carbs: 12, fat: 15, fibre: 3 },
      { name: 'White rice', quantity: '1 cup', calories: 205, protein: 4, carbs: 45, fat: 0, fibre: 1 },
      { name: 'Mixed vegetables', quantity: '1.5 cups', calories: 80, protein: 3, carbs: 16, fat: 1, fibre: 6 },
    ],
  },
  {
    type: 'dinner',
    items: [
      { name: 'Baked cod', quantity: '150g', calories: 180, protein: 38, carbs: 0, fat: 2, fibre: 0 },
      { name: 'Sweet potato', quantity: '1 medium', calories: 115, protein: 2, carbs: 27, fat: 0, fibre: 4 },
      { name: 'Green beans', quantity: '1 cup', calories: 45, protein: 2, carbs: 10, fat: 0, fibre: 4 },
    ],
  },
  {
    type: 'dinner',
    items: [
      { name: 'Chicken pasta', quantity: '1.5 cups', calories: 420, protein: 32, carbs: 55, fat: 10, fibre: 4 },
      { name: 'Caesar salad', quantity: '1 cup', calories: 150, protein: 4, carbs: 8, fat: 12, fibre: 2 },
    ],
  },
  // Snacks
  {
    type: 'snack',
    items: [
      { name: 'Protein shake', quantity: '1 scoop', calories: 140, protein: 25, carbs: 6, fat: 2, fibre: 1 },
    ],
  },
  {
    type: 'snack',
    items: [
      { name: 'Almonds', quantity: '30g', calories: 170, protein: 6, carbs: 6, fat: 15, fibre: 4 },
    ],
  },
  {
    type: 'snack',
    items: [
      { name: 'Protein bar', quantity: '1 bar', calories: 200, protein: 20, carbs: 22, fat: 6, fibre: 3 },
    ],
  },
];

async function seedMockMeals() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection, { schema, mode: 'default' });

  console.log('Starting mock meal data generation for TEST Client (ID 990036)...');

  const now = new Date();
  const mealsCreated = [];

  // Generate meals for the last 10 days
  for (let dayOffset = 9; dayOffset >= 0; dayOffset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    
    // Reset to start of day in Hong Kong timezone (GMT+8)
    const hkDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
    hkDate.setHours(0, 0, 0, 0);

    console.log(`\nGenerating meals for ${hkDate.toDateString()}...`);

    // Breakfast (7-9 AM)
    const breakfastTemplate = mealTemplates[Math.floor(Math.random() * 3)];
    const breakfastTime = new Date(hkDate);
    breakfastTime.setHours(7 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));
    
    await createMeal(db, breakfastTemplate, breakfastTime);
    mealsCreated.push(breakfastTemplate.type);
    console.log(`  ✓ Breakfast created at ${breakfastTime.toLocaleTimeString()}`);

    // Lunch (12-2 PM)
    const lunchTemplate = mealTemplates[3 + Math.floor(Math.random() * 3)];
    const lunchTime = new Date(hkDate);
    lunchTime.setHours(12 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));
    
    await createMeal(db, lunchTemplate, lunchTime);
    mealsCreated.push(lunchTemplate.type);
    console.log(`  ✓ Lunch created at ${lunchTime.toLocaleTimeString()}`);

    // Dinner (6-8 PM)
    const dinnerTemplate = mealTemplates[6 + Math.floor(Math.random() * 3)];
    const dinnerTime = new Date(hkDate);
    dinnerTime.setHours(18 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));
    
    await createMeal(db, dinnerTemplate, dinnerTime);
    mealsCreated.push(dinnerTemplate.type);
    console.log(`  ✓ Dinner created at ${dinnerTime.toLocaleTimeString()}`);

    // Snacks (1-2 per day, random times)
    const numSnacks = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numSnacks; i++) {
      const snackTemplate = mealTemplates[9 + Math.floor(Math.random() * 3)];
      const snackTime = new Date(hkDate);
      snackTime.setHours(10 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
      
      await createMeal(db, snackTemplate, snackTime);
      mealsCreated.push(snackTemplate.type);
      console.log(`  ✓ Snack ${i + 1} created at ${snackTime.toLocaleTimeString()}`);
    }
  }

  await connection.end();
  
  console.log(`\n✅ Successfully created ${mealsCreated.length} mock meals for TEST Client (ID 990036)`);
  console.log('Data is now available in the Nutrition Trends section.');
}

async function createMeal(db, template, timestamp) {
  // Calculate totals
  const totalCalories = template.items.reduce((sum, item) => sum + item.calories, 0);
  const totalProtein = template.items.reduce((sum, item) => sum + item.protein, 0);
  const totalCarbs = template.items.reduce((sum, item) => sum + item.carbs, 0);
  const totalFat = template.items.reduce((sum, item) => sum + item.fat, 0);
  const totalFibre = template.items.reduce((sum, item) => sum + item.fibre, 0);

  // Calculate a simple nutrition score (0-100)
  const score = Math.min(100, Math.round(
    (totalProtein * 2) + (totalFibre * 5) - (totalFat * 0.5) + 40
  ));

  // Create meal record with components as JSON
  await db.insert(schema.meals).values({
    clientId: TEST_CLIENT_ID,
    mealType: template.type,
    imageUrl: '',
    imageKey: '',
    calories: totalCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat,
    fibre: totalFibre,
    nutritionScore: score,
    components: template.items, // Store items as JSON
    loggedAt: timestamp,
    createdAt: timestamp,
  });
}

// Run the seed script
seedMockMeals().catch(console.error);
