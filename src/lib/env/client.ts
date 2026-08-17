/**
 * Public environment belongs here only when browser code genuinely needs it.
 * Never add database credentials, authentication secrets, or provider keys.
 */
export type ClientEnvironment = Record<string, never>;

export const clientEnvironment: ClientEnvironment = {};

