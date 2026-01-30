import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.js';
import 'dotenv/config';

const TEST_CLIENT_ID = 990036;

async function addHydrationData() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection, { schema, mode: 'default' });

  console.log('Adding hydration data for TEST Client (ID 990036)...');

  const now = new Date();
  const hydrationRecordsCreated = [];

  // Generate hydration data for the last 10 days
  for (let dayOffset = 9; dayOffset >= 0; dayOffset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    
    // Reset to start of day in Hong Kong timezone (GMT+8)
    const hkDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
    hkDate.setHours(0, 0, 0, 0);

    // Generate realistic daily hydration (1800-2500 ml, with some variation)
    const baseHydration = 2000;
    const variation = Math.random() * 500 - 250; // -250 to +250
    const dailyHydration = Math.round(baseHydration + variation);

    console.log(`\nAdding hydration for ${hkDate.toDateString()}: ${dailyHydration} ml`);

    // Create body_metrics record with hydration
    await db.insert(schema.bodyMetrics).values({
      clientId: TEST_CLIENT_ID,
      weight: null, // No weight data for now
      hydration: dailyHydration,
      recordedAt: hkDate,
      createdAt: hkDate,
    });

    hydrationRecordsCreated.push({ date: hkDate.toDateString(), hydration: dailyHydration });
  }

  await connection.end();
  
  console.log(`\n✅ Successfully created ${hydrationRecordsCreated.length} hydration records for TEST Client (ID 990036)`);
  console.log('Hydration data is now available in the Hydration Trend section.');
  console.log('\nHydration Summary:');
  hydrationRecordsCreated.forEach(record => {
    console.log(`  ${record.date}: ${record.hydration} ml`);
  });
}

// Run the script
addHydrationData().catch(console.error);
