/**
 * Migration script to hash existing plaintext PINs with bcrypt
 * Run with: node server/migrate-pins.mjs
 */
import bcrypt from 'bcrypt';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';

const BCRYPT_ROUNDS = 12;

// Check if PIN is already hashed (bcrypt hashes start with $2)
function isPINHashed(pin) {
  return pin && pin.startsWith('$2');
}

async function migratePins() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const db = drizzle(databaseUrl);

  // Import schema dynamically
  const { clients } = await import('../drizzle/schema.js');

  console.log('Fetching all clients...');
  const allClients = await db.select().from(clients);
  
  console.log(`Found ${allClients.length} clients`);
  
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const client of allClients) {
    if (!client.pin) {
      console.log(`Client ${client.id} (${client.name}): No PIN set, skipping`);
      skippedCount++;
      continue;
    }

    if (isPINHashed(client.pin)) {
      console.log(`Client ${client.id} (${client.name}): PIN already hashed, skipping`);
      skippedCount++;
      continue;
    }

    try {
      console.log(`Client ${client.id} (${client.name}): Hashing PIN...`);
      const hashedPin = await bcrypt.hash(client.pin, BCRYPT_ROUNDS);
      
      await db.update(clients)
        .set({ pin: hashedPin })
        .where(eq(clients.id, client.id));
      
      console.log(`Client ${client.id} (${client.name}): PIN hashed successfully`);
      migratedCount++;
    } catch (error) {
      console.error(`Client ${client.id} (${client.name}): Error hashing PIN:`, error.message);
      errorCount++;
    }
  }

  console.log('\n=== Migration Summary ===');
  console.log(`Total clients: ${allClients.length}`);
  console.log(`Migrated: ${migratedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  
  if (errorCount > 0) {
    console.log('\nSome PINs failed to migrate. Please check the errors above.');
    process.exit(1);
  }
  
  console.log('\nMigration completed successfully!');
  process.exit(0);
}

migratePins().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
