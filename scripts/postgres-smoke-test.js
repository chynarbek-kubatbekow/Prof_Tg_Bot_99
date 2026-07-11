import assert from "node:assert/strict";
import pg from "pg";
import { createAdminStorage } from "../src/lib/admin-storage.js";

const { Pool } = pg;

function poolFromDatabaseUrl(databaseUrl) {
  const parsedUrl = new URL(databaseUrl);
  const sslMode = parsedUrl.searchParams.get("sslmode");
  const channelBinding = parsedUrl.searchParams.get("channel_binding");

  parsedUrl.searchParams.delete("sslmode");
  parsedUrl.searchParams.delete("channel_binding");

  return new Pool({
    connectionString: parsedUrl.toString(),
    max: 1,
    ssl: sslMode ? { rejectUnauthorized: true } : undefined,
    enableChannelBinding: channelBinding === "require",
  });
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for PostgreSQL smoke test");
}

const marker = `__smoke_pg_${Date.now()}__`;
const storage = createAdminStorage();
await storage.ready;

assert.equal(storage.kind, "postgres");

await storage.upsertKnowledgeSource({
  key: `${marker}_source`,
  title: "Smoke src/data source",
  sourceType: "src_data",
  content: `${marker}_content`,
});
assert.match(await storage.getStoredKnowledgeContext(), new RegExp(`${marker}_content`));

const faq = await storage.createFaq(`${marker}_question`, `${marker}_answer`, {
  id: 111,
  first_name: "Smoke",
});
const found = await storage.getFaq(faq.id);

assert.equal(found.question, `${marker}_question`);
assert.equal(found.answer, `${marker}_answer`);

const deleted = await storage.deleteFaq(faq.id, { id: 111, first_name: "Smoke" });
assert.equal(deleted, true);
assert.equal(await storage.getFaq(faq.id), null);

await storage.close();

const pool = poolFromDatabaseUrl(process.env.DATABASE_URL);
try {
  await pool.query("DELETE FROM change_logs WHERE details LIKE $1", [`${marker}%`]);
  await pool.query("DELETE FROM knowledge_sources WHERE key = $1", [`${marker}_source`]);
} finally {
  await pool.end();
}

console.log("PostgreSQL smoke test passed");
