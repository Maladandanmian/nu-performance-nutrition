import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);

// Get Noad's client ID
const [clients] = await connection.execute(
  "SELECT id FROM clients WHERE name = 'Noad' LIMIT 1"
);

if (clients.length === 0) {
  console.error('Client "Noad" not found');
  process.exit(1);
}

const clientId = clients[0].id;
console.log(`Found Noad with clientId: ${clientId}`);

// Test meal data with realistic nutrition values
const testMeals = [
  {
    clientId,
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
    imageKey: `meals/${clientId}/test-salad.jpg`,
    mealType: 'lunch',
    calories: 450,
    protein: 25,
    fat: 18,
    carbs: 45,
    fibre: 8,
    aiDescription: 'Grilled chicken salad with mixed greens, cherry tomatoes, cucumbers, and balsamic vinaigrette',
    aiConfidence: 85,
    nutritionScore: 4,
    components: JSON.stringify([
      { name: 'Grilled chicken breast', calories: 165, protein: 31, fat: 3.6, carbs: 0, fibre: 0 },
      { name: 'Mixed greens (2 cups)', calories: 20, protein: 2, fat: 0, carbs: 4, fibre: 2 },
      { name: 'Cherry tomatoes (10)', calories: 30, protein: 1.5, fat: 0.3, carbs: 6.5, fibre: 2 },
      { name: 'Cucumber slices (1 cup)', calories: 16, protein: 0.7, fat: 0.1, carbs: 3.6, fibre: 0.5 },
      { name: 'Balsamic vinaigrette (2 tbsp)', calories: 90, protein: 0, fat: 9, carbs: 4, fibre: 0 },
      { name: 'Whole grain croutons (1/4 cup)', calories: 60, protein: 2, fat: 2, carbs: 10, fibre: 1 },
      { name: 'Feta cheese (30g)', calories: 75, protein: 4, fat: 6, carbs: 1.2, fibre: 0 }
    ]),
    loggedAt: new Date('2026-01-21T13:30:00'),
  },
  {
    clientId,
    imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    imageKey: `meals/${clientId}/test-pizza.jpg`,
    mealType: 'dinner',
    calories: 850,
    protein: 35,
    fat: 38,
    carbs: 85,
    fibre: 6,
    aiDescription: 'Pepperoni pizza (3 slices) with mozzarella cheese and tomato sauce',
    aiConfidence: 90,
    nutritionScore: 2,
    components: JSON.stringify([
      { name: 'Pizza dough (3 slices)', calories: 450, protein: 15, fat: 6, carbs: 75, fibre: 4 },
      { name: 'Mozzarella cheese (90g)', calories: 270, protein: 18, fat: 21, carbs: 3, fibre: 0 },
      { name: 'Pepperoni (30g)', calories: 130, protein: 5, fat: 11, carbs: 1, fibre: 0 },
      { name: 'Tomato sauce (1/2 cup)', calories: 40, protein: 2, fat: 0, carbs: 9, fibre: 2 }
    ]),
    beverageType: 'Coca-Cola',
    beverageVolumeMl: 330,
    beverageCalories: 140,
    beverageProtein: 0,
    beverageFat: 0,
    beverageCarbs: 39,
    beverageFibre: 0,
    loggedAt: new Date('2026-01-21T19:15:00'),
  },
  {
    clientId,
    imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
    imageKey: `meals/${clientId}/test-oatmeal.jpg`,
    mealType: 'breakfast',
    calories: 380,
    protein: 15,
    fat: 12,
    carbs: 52,
    fibre: 8,
    aiDescription: 'Oatmeal with banana, almonds, and honey',
    aiConfidence: 88,
    nutritionScore: 5,
    components: JSON.stringify([
      { name: 'Rolled oats (1 cup cooked)', calories: 150, protein: 6, fat: 3, carbs: 27, fibre: 4 },
      { name: 'Banana (1 medium)', calories: 105, protein: 1.3, fat: 0.4, carbs: 27, fibre: 3 },
      { name: 'Almonds (15 pieces)', calories: 100, protein: 4, fat: 9, carbs: 3.5, fibre: 2 },
      { name: 'Honey (1 tbsp)', calories: 64, protein: 0.1, fat: 0, carbs: 17, fibre: 0 },
      { name: 'Skim milk (1/2 cup)', calories: 45, protein: 4.5, fat: 0, carbs: 6, fibre: 0 }
    ]),
    loggedAt: new Date('2026-01-22T08:00:00'),
  },
  {
    clientId,
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
    imageKey: `meals/${clientId}/test-stirfry.jpg`,
    mealType: 'dinner',
    calories: 620,
    protein: 42,
    fat: 22,
    carbs: 58,
    fibre: 7,
    aiDescription: 'Beef and vegetable stir-fry with brown rice',
    aiConfidence: 87,
    nutritionScore: 4,
    components: JSON.stringify([
      { name: 'Lean beef strips (150g)', calories: 250, protein: 36, fat: 11, carbs: 0, fibre: 0 },
      { name: 'Brown rice (1 cup cooked)', calories: 215, protein: 5, fat: 1.8, carbs: 45, fibre: 3.5 },
      { name: 'Mixed vegetables (broccoli, bell peppers, carrots)', calories: 80, protein: 4, fat: 0.5, carbs: 16, fibre: 5 },
      { name: 'Stir-fry sauce (2 tbsp)', calories: 40, protein: 1, fat: 0, carbs: 8, fibre: 0 },
      { name: 'Sesame oil (1 tsp)', calories: 40, protein: 0, fat: 4.5, carbs: 0, fibre: 0 }
    ]),
    loggedAt: new Date('2026-01-22T18:45:00'),
  },
  {
    clientId,
    imageUrl: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=800',
    imageKey: `meals/${clientId}/test-protein-shake.jpg`,
    mealType: 'snack',
    calories: 280,
    protein: 30,
    fat: 8,
    carbs: 25,
    fibre: 3,
    aiDescription: 'Protein shake with whey protein, banana, and almond milk',
    aiConfidence: 92,
    nutritionScore: 5,
    components: JSON.stringify([
      { name: 'Whey protein powder (1 scoop)', calories: 120, protein: 24, fat: 1.5, carbs: 3, fibre: 1 },
      { name: 'Banana (1 small)', calories: 90, protein: 1.1, fat: 0.3, carbs: 23, fibre: 2.6 },
      { name: 'Almond milk (1 cup)', calories: 40, protein: 1, fat: 3, carbs: 2, fibre: 1 },
      { name: 'Ice cubes', calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }
    ]),
    loggedAt: new Date('2026-01-22T15:30:00'),
  }
];

// Insert test meals
for (const meal of testMeals) {
  await connection.execute(
    `INSERT INTO meals (clientId, imageUrl, imageKey, mealType, calories, protein, fat, carbs, fibre, aiDescription, aiConfidence, nutritionScore, components, loggedAt, beverageType, beverageVolumeMl, beverageCalories, beverageProtein, beverageFat, beverageCarbs, beverageFibre, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      meal.clientId,
      meal.imageUrl,
      meal.imageKey,
      meal.mealType,
      meal.calories,
      meal.protein,
      meal.fat,
      meal.carbs,
      meal.fibre,
      meal.aiDescription,
      meal.aiConfidence,
      meal.nutritionScore,
      meal.components,
      meal.loggedAt,
      meal.beverageType || null,
      meal.beverageVolumeMl || null,
      meal.beverageCalories || null,
      meal.beverageProtein || null,
      meal.beverageFat || null,
      meal.beverageCarbs || null,
      meal.beverageFibre || null
    ]
  );
  console.log(`✓ Added ${meal.mealType}: ${meal.aiDescription}`);
}

// Add some body metrics (weight tracking)
const bodyMetrics = [
  { clientId, weight: 755, recordedAt: new Date('2026-01-20T08:00:00') }, // 75.5 kg
  { clientId, weight: 754, recordedAt: new Date('2026-01-21T08:00:00') }, // 75.4 kg
  { clientId, weight: 753, recordedAt: new Date('2026-01-22T08:00:00') }, // 75.3 kg
];

for (const metric of bodyMetrics) {
  await connection.execute(
    `INSERT INTO body_metrics (clientId, weight, recordedAt, createdAt)
     VALUES (?, ?, ?, NOW())`,
    [metric.clientId, metric.weight, metric.recordedAt]
  );
  console.log(`✓ Added weight: ${metric.weight / 10} kg on ${metric.recordedAt.toDateString()}`);
}

console.log('\n✅ Test data added successfully!');
await connection.end();
