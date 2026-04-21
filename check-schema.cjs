const mysql = require('mysql2/promise');

async function main() {
  const c = await mysql.createConnection(process.env.DATABASE_URL);

  const [t] = await c.query('SHOW TABLES LIKE "business_costs"');
  console.log('business_costs table:', t.length > 0 ? 'EXISTS' : 'MISSING');

  const [ic] = await c.query('DESCRIBE invoices');
  const invoiceFields = ic.map(r => r.Field);
  const expectedInvoice = ['serviceType', 'discountAmount', 'discountDescription', 'paidAt', 'dueDate'];
  for (const f of expectedInvoice) {
    const col = ic.find(r => r.Field === f);
    console.log('invoices.' + f + ': ' + (col ? col.Type : 'MISSING'));
  }

  const [sc] = await c.query('DESCRIBE service_types');
  const stFields = sc.map(r => r.Field);
  console.log('service_types.standardPrice: ' + (stFields.includes('standardPrice') ? 'EXISTS' : 'MISSING'));

  const [bc] = await c.query('DESCRIBE business_costs');
  console.log('business_costs columns: ' + bc.map(r => r.Field).join(', '));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
