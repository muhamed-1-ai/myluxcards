import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const pool = new pg.Pool({ connectionString: dbUrl });

  try {
    const displayEmail = "Muhammedfebincholayil@gmail.com";
    const email = normalizeEmail(displayEmail);
    const name = "Muhammed";
    const assignedRole = "USER";
    const DEFAULT_FEATURE_PERMISSIONS = {};

    console.log("Attempting insert...");
    
    // Simulate what linkGoogleIdentityOnce does for a new user
    await pool.query('BEGIN');
    try {
      const userRes = await pool.query(
        `insert into users(email,normalized_email,name,role,feature_permissions)
         values($1,$2,$3,$4,$5::jsonb) returning id,email,name,session_version,role`,
        [displayEmail, email, name, assignedRole, JSON.stringify(DEFAULT_FEATURE_PERMISSIONS)]
      );
      console.log("Insert success:", userRes.rows[0]);
      await pool.query('ROLLBACK'); // rollback test
    } catch (err: any) {
      console.error("DB Error:", err.message, err.code, err.constraint);
      await pool.query('ROLLBACK');
    }

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    pool.end();
  }
}

main();
