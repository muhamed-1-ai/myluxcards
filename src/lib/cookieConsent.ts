export type CookieConsentChoice = 'accepted' | 'rejected';

export interface CookieConsentState {
  choice: CookieConsentChoice;
  timestamp: string;
}

const COOKIE_NAME = 'zappit_cookie_consent';
const STORAGE_KEY = 'zappit_cookie_consent';
const EXPIRY_DAYS = 365;

/**
 * Retrieves the current cookie consent choice.
 * Returns 'accepted', 'rejected', or null if no choice has been made yet.
 */
export function getCookieConsent(): CookieConsentChoice | null {
  if (typeof window === 'undefined') return null;

  // 1. Check browser cookie
  try {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const c = cookies[i].trim();
      if (c.startsWith(`${COOKIE_NAME}=`)) {
        const val = c.substring(COOKIE_NAME.length + 1);
        if (val === 'accepted' || val === 'rejected') {
          return val;
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. Fallback to localStorage
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'accepted' || stored === 'rejected') {
      // Re-sync cookie if missing
      setCookieConsent(stored);
      return stored;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Saves the cookie consent choice in browser cookie (1 year expiry) and localStorage.
 */
export function setCookieConsent(choice: CookieConsentChoice): void {
  if (typeof window === 'undefined') return;

  const maxAge = EXPIRY_DAYS * 24 * 60 * 60;
  const isSecure = window.location.protocol === 'https:';
  const cookieStr = `${COOKIE_NAME}=${choice}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure ? '; Secure' : ''}`;
  
  try {
    document.cookie = cookieStr;
  } catch {
    // ignore
  }

  try {
    localStorage.setItem(STORAGE_KEY, choice);
    localStorage.setItem(`${STORAGE_KEY}_timestamp`, new Date().toISOString());
  } catch {
    // ignore
  }

  // Broadcast event for analytics scripts or other listeners
  try {
    window.dispatchEvent(
      new CustomEvent('zappit_cookie_consent_changed', {
        detail: { choice, hasAnalytics: choice === 'accepted' },
      })
    );
  } catch {
    // ignore
  }
}

/**
 * Returns true if the user has accepted optional analytics/preference cookies.
 */
export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === 'accepted';
}

/**
 * Essential cookies are always active for core platform functionality.
 */
export function hasEssentialConsent(): boolean {
  return true;
}

/**
 * Resets cookie consent (useful for testing or privacy settings).
 */
export function resetCookieConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`${STORAGE_KEY}_timestamp`);
  } catch {
    // ignore
  }
}
