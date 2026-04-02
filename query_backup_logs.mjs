import { createConnection } from 'mysql2/promise';

const conn = await createConnection({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0] || 'root',
  password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0] || '',
  database: 'nu_performance',
});

const [rows] = await conn.execute(
  'SELECT id, trainerId, status, backupDate, fileSizeKB, errorMessage FROM backup_logs ORDER BY backupDate DESC LIMIT 5'
);

console.log(JSON.stringify(rows, null, 2));
await conn.end();
