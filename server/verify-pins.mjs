/**
 * Verification script to check that PINs are hashed
 */
import { drizzle } from 'drizzle-orm/mysql2';
import { clients } from '../drizzle/schema';

async function verifyPins() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const db = drizzle(databaseUrl);

  console.log('Fetching all clients...');
  const allClients = await db.select().from(clients);
  
  let hashedCount = 0;
  let plaintextCount = 0;
  
  console.log('\nVerifying PIN hashing status:');
  console.log('================================\n');
  
  for (const client of allClients.slice(0, 10)) {
    if (!client.pin) {
      console.log(`Client ${client.id} (${client.name}): No PIN`);
      continue;
    }
    
    const isHashed = client.pin.startsWith('$2');
    if (isHashed) {
      hashedCount++;
      console.log(`Client ${client.id} (${client.name}): ✓ HASHED`);
    } else {
      plaintextCount++;
      console.log(`Client ${client.id} (${client.name}): ✗ PLAINTEXT`);
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Total clients: ${allClients.length}`);
  
  const allHashed = allClients.filter(c => c.pin && c.pin.startsWith('$2')).length;
  const allPlaintext = allClients.filter(c => c.pin && !c.pin.startsWith('$2')).length;
  
  console.log(`Hashed PINs: ${allHashed}`);
  console.log(`Plaintext PINs: ${allPlaintext}`);
  
  if (allPlaintext === 0) {
    console.log('\n✓ All PINs are now hashed!');
    process.exit(0);
  } else {
    console.log(`\n✗ Warning: ${allPlaintext} PINs are still plaintext`);
    process.exit(1);
  }
}

verifyPins().catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});
