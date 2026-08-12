import type { PoolClient, QueryResult, QueryResultRow } from "pg";

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}
export type TransactionClient = PoolClient;
