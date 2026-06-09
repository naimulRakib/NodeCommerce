import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const queries = [
  ['ACOAllocation',           'SELECT COUNT(*)::int AS c FROM "ACOAllocation"'],
  ['ACORoutingJob',           'SELECT COUNT(*)::int AS c FROM "ACORoutingJob"'],
  ['ShipmentPlan',            'SELECT COUNT(*)::int AS c FROM "ShipmentPlan"'],
  ['ShipmentLineItem',        'SELECT COUNT(*)::int AS c FROM "ShipmentLineItem"'],
  ['StockForecast',           'SELECT COUNT(*)::int AS c FROM "StockForecast"'],
  ['InterDistrictOpportunity','SELECT COUNT(*)::int AS c FROM "InterDistrictOpportunity"'],
  ['DemandPheromone',         'SELECT COUNT(*)::int AS c FROM "DemandPheromone"'],
  ['RoutePheromone',          'SELECT COUNT(*)::int AS c FROM "RoutePheromone"'],
];

for (const [name, q] of queries) {
  try {
    const r = await pool.query(q);
    console.log(`${name.padEnd(24)} ${r.rows[0].c}`);
  } catch (e) {
    console.log(`${name.padEnd(24)} ERR ${e.message}`);
  }
}
await pool.end();
