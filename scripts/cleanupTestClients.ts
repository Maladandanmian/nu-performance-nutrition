/**
 * Manual Test Client Cleanup Script
 * 
 * Finds and deletes all test clients from the database.
 * Run this script manually if tests fail to clean up or to remove orphaned test data.
 * 
 * Usage:
 *   pnpm cleanup:test-clients
 */

import { cleanupAllTestClients, findTestClients } from '../server/testCleanup';

async function main() {
  console.log('='.repeat(60));
  console.log('Test Client Cleanup Script');
  console.log('='.repeat(60));
  console.log('');
  
  // First, list all test clients
  console.log('Finding test clients...');
  const testClients = await findTestClients();
  
  if (testClients.length === 0) {
    console.log('✅ No test clients found. Database is clean!');
    process.exit(0);
  }
  
  console.log(`\nFound ${testClients.length} test client(s):\n`);
  testClients.forEach((client, index) => {
    console.log(`  ${index + 1}. ${client.name} (${client.email}) - ID: ${client.id}`);
  });
  
  console.log('\n' + '-'.repeat(60));
  console.log('Starting cleanup...\n');
  
  // Delete all test clients
  const deletedCount = await cleanupAllTestClients();
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Cleanup complete: ${deletedCount} of ${testClients.length} test clients deleted`);
  console.log('='.repeat(60));
  
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Cleanup script failed:', error);
  process.exit(1);
});
