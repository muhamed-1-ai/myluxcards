// src/lib/db.ts
import "server-only";
import { pool, query, withTransaction, databaseHealth, closeDatabasePool } from "./db/index";

export { pool, query, withTransaction, databaseHealth, closeDatabasePool };
export default { pool, query, withTransaction, databaseHealth, closeDatabasePool };

