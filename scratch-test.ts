import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

console.log("Connecting to:", process.env.DATABASE_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  const start = Date.now();
  console.log("Attempting connect...");
  try {
    const res = await pool.query('SELECT NOW()');
    console.log("Success in", Date.now() - start, "ms", res.rows);
  } catch (err) {
    console.error("Failed in", Date.now() - start, "ms", err);
  } finally {
    pool.end();
  }
}
test();
