import "server-only";

export type HttpErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500;

export class ApplicationError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: HttpErrorStatus,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApplicationError";
  }
}

export function errorResponse(error: ApplicationError) {
  return Response.json(
    { message: error.message, code: error.code },
    { status: error.status },
  );
}

export function unexpectedErrorResponse(context: string, error: unknown) {
  const diagnostic = error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "UnknownError" };
  console.error(`[${context}] Unexpected failure`, diagnostic);
  return Response.json(
    { message: "The request could not be completed." },
    { status: 500 },
  );
}

