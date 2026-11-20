/**
 * Admin Multi-Factor Authentication (MFA)
 * 
 * NOTE: The administrator MFA feature has been retired.
 * Authorized Admins and Super Admins authenticate directly via standard password or Google OAuth.
 */

export const ADMIN_MFA_COOKIE_NAME = "zappit_admin_mfa";

export async function isSessionMfaVerified(): Promise<boolean> {
  return true;
}

export async function getAdminMfaStatus() {
  return {
    enrolled: false,
    enrolledAt: null,
    recoveryCodesRemaining: 0,
  };
}
