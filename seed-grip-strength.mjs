import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { strengthTests } from './drizzle/schema.ts';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

const clientId = 990036; // TEST CLIENT

// Create 4 weeks of grip strength tests (one per week)
// Showing realistic progression: 58kg -> 60kg -> 62kg -> 64kg
const tests = [
  {
    date: '2026-01-09', // 4 weeks ago
    value: 58,
    notes: 'Baseline test - good form'
  },
  {
    date: '2026-01-16', // 3 weeks ago
    value: 60,
    notes: 'Slight improvement, consistent training'
  },
  {
    date: '2026-01-23', // 2 weeks ago
    value: 62,
    notes: 'Noticeable strength gains'
  },
  {
    date: '2026-01-30', // 1 week ago (today)
    value: 64,
    notes: 'Excellent progress, maintaining form'
  },
];

console.log(`Creating ${tests.length} grip strength tests for client ${clientId}...`);

for (const test of tests) {
  const testDate = new Date(test.date);
  
  await db.insert(strengthTests).values({
    clientId,
    testType: 'grip_strength',
    value: test.value.toString(),
    unit: 'kg',
    testedAt: testDate,
    notes: test.notes,
    createdAt: new Date(),
  });
  
  console.log(`✓ Added test: ${test.date} - ${test.value}kg`);
}

console.log('\n✅ All grip strength tests created successfully!');
console.log('\nTest progression:');
tests.forEach(t => console.log(`  ${t.date}: ${t.value}kg - ${t.notes}`));

await connection.end();
