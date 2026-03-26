import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy-initialized db client — defers neon connection to first use rather than
// module load time. Prevents build failures when DATABASE_URL isn't available
// during Next.js static analysis / page data collection.
let _db: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL not configured");
    }
    const sql = neon(databaseUrl);
    _db = drizzle({ client: sql, schema });
  }
  return _db;
}

// Proxy preserves the `import { db }` API so existing code works unchanged.
// Property access is forwarded to the lazy-initialized instance.
export const db: NeonHttpDatabase<typeof schema> = new Proxy(
  {} as NeonHttpDatabase<typeof schema>,
  {
    get(_target, prop) {
      const instance = getDb();
      const value = instance[prop as keyof typeof instance];
      if (typeof value === "function") {
        return value.bind(instance);
      }
      return value;
    },
  }
);
