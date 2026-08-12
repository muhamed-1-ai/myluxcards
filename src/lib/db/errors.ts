export function databaseErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : null;
}
export const isUniqueViolation = (error: unknown) => databaseErrorCode(error) === "23505";
export const isForeignKeyViolation = (error: unknown) => databaseErrorCode(error) === "23503";
