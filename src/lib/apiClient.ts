/**
 * Resilient API Client for ZAPPIT Frontend Components.
 * Handles 401 Unauthorized responses by attempting a single session refresh before retrying.
 * Exposes helper methods with AbortSignal support to prevent racing requests during component hydration.
 */

export interface ApiFetchOptions extends RequestInit {
  retryOnUnauthorized?: boolean;
  signal?: AbortSignal;
}

let isRefreshingSession = false;
let refreshSubscribers: ((success: boolean) => void)[] = [];

function subscribeTokenRefresh(cb: (success: boolean) => void) {
  refreshSubscribers.push(cb);
}

function onSessionRefreshed(success: boolean) {
  refreshSubscribers.forEach((cb) => cb(success));
  refreshSubscribers = [];
}

/**
 * Attempts a single session refresh using the auth refresh endpoint.
 */
export async function refreshSession(): Promise<boolean> {
  if (isRefreshingSession) {
    return new Promise((resolve) => {
      subscribeTokenRefresh((success) => resolve(success));
    });
  }

  isRefreshingSession = true;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "GET",
      headers: { "Cache-Control": "no-cache" },
    });

    const success = res.ok;
    onSessionRefreshed(success);
    return success;
  } catch (err) {
    console.error("[API_CLIENT] Session refresh error:", err);
    onSessionRefreshed(false);
    return false;
  } finally {
    isRefreshingSession = false;
  }
}

/**
 * Centralized fetch wrapper that intercepts 401 Unauthorized responses,
 * attempts one silent session refresh, and retries the original request once.
 */
export async function apiFetch<T = any>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const { retryOnUnauthorized = true, ...fetchOptions } = options;

  try {
    let response = await fetch(url, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...(fetchOptions.headers || {}),
      },
    });

    // Handle 401 Unauthorized with single retry
    if (response.status === 401 && retryOnUnauthorized) {
      console.warn(`[API_CLIENT] Received 401 from ${url}. Attempting session refresh...`);
      const refreshed = await refreshSession();

      if (refreshed) {
        console.log(`[API_CLIENT] Session refreshed successfully. Retrying ${url}...`);
        response = await fetch(url, {
          ...fetchOptions,
          headers: {
            "Content-Type": "application/json",
            ...(fetchOptions.headers || {}),
          },
        });
      }
    }

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      return {
        ok: false,
        status: response.status,
        data: null,
        error: errorPayload.message || errorPayload.error || `HTTP ${response.status}`,
      };
    }

    const data = await response.json().catch(() => null);
    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return { ok: false, status: 0, data: null, error: "Request aborted" };
    }

    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.message || "Network error",
    };
  }
}
