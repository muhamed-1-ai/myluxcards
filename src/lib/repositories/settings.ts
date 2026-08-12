import "server-only"; import { pool } from "../db"; import type { Queryable } from "../db/types";
export async function getWebsiteSettings(db:Queryable=pool){return (await db.query("select * from website_settings where id=true")).rows[0]??null}
export async function getAffiliateSettings(db:Queryable=pool){return (await db.query("select * from affiliate_settings where id=true")).rows[0]??null}
