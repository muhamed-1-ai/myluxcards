import "server-only"; import { pool } from "../db"; import type { Queryable } from "../db/types"; import type { OrderRow } from "@/types/database";
export async function findOrderById(id:string,db:Queryable=pool){return (await db.query<OrderRow>("select * from orders where id=$1",[id])).rows[0]??null}
export async function listUserOrders(userId:string,db:Queryable=pool){return (await db.query<OrderRow>("select * from orders where customer_id=$1 order by created_at desc limit 100",[userId])).rows}
