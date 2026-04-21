/**
 * Definitive test: does Drizzle's json() column call JSON.stringify internally?
 * We insert with a raw array, then read back and check what MySQL stored.
 */
const mysql = require('mysql2/promise');

async function main() {
  const c = await mysql.createConnection(process.env.DATABASE_URL);

  // 1. Check what Drizzle's mapToDriverValue does with a raw array
  // We do this by looking at what SQL is actually sent to MySQL
  // Insert a test row using raw SQL with a raw JSON value
  const testItems = [{ description: "Test", quantity: 1, unitPrice: 100, total: 100 }];
  
  // Test A: raw JSON string (what JSON.stringify produces)
  const jsonString = JSON.stringify(testItems);
  console.log('JSON.stringify result:', jsonString);
  console.log('Type:', typeof jsonString);
  
  // Test B: double-stringified (what JSON.stringify(JSON.stringify()) produces)
  const doubleString = JSON.stringify(jsonString);
  console.log('Double-stringified:', doubleString);
  
  // Test C: insert via raw SQL with JSON string — does MySQL accept it?
  try {
    await c.query('DELETE FROM invoices WHERE invoiceNumber = "TEST-JSON-001"');
    await c.query(
      `INSERT INTO invoices (trainerId, clientId, invoiceNumber, lineItems, subtotal, taxRate, taxAmount, total, currency, status) 
       VALUES (13, 2220001, 'TEST-JSON-001', ?, 100, 0, 0, 100, 'HKD', 'draft')`,
      [jsonString]
    );
    const [rows] = await c.query('SELECT lineItems FROM invoices WHERE invoiceNumber = "TEST-JSON-001"');
    console.log('\nTest C (raw JSON string via raw SQL):');
    console.log('  Stored value type:', typeof rows[0].lineItems);
    console.log('  Stored value:', JSON.stringify(rows[0].lineItems));
    console.log('  Is array:', Array.isArray(rows[0].lineItems));
    await c.query('DELETE FROM invoices WHERE invoiceNumber = "TEST-JSON-001"');
  } catch (e) {
    console.log('Test C failed:', e.message);
  }

  // Test D: insert via raw SQL with double-stringified value — does MySQL accept it?
  try {
    await c.query('DELETE FROM invoices WHERE invoiceNumber = "TEST-JSON-002"');
    await c.query(
      `INSERT INTO invoices (trainerId, clientId, invoiceNumber, lineItems, subtotal, taxRate, taxAmount, total, currency, status) 
       VALUES (13, 2220001, 'TEST-JSON-002', ?, 100, 0, 0, 100, 'HKD', 'draft')`,
      [doubleString]
    );
    const [rows] = await c.query('SELECT lineItems FROM invoices WHERE invoiceNumber = "TEST-JSON-002"');
    console.log('\nTest D (double-stringified via raw SQL):');
    console.log('  Stored value type:', typeof rows[0].lineItems);
    console.log('  Stored value:', JSON.stringify(rows[0].lineItems));
    console.log('  Is array:', Array.isArray(rows[0].lineItems));
    await c.query('DELETE FROM invoices WHERE invoiceNumber = "TEST-JSON-002"');
  } catch (e) {
    console.log('Test D failed:', e.message);
  }

  await c.end();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
