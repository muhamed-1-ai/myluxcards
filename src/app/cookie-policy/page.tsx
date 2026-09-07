import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Cookie Policy - Zappit",
  description: "Zappit Cookie Policy and cookie management guide.",
};

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy" updated="1 September 2026">
      <h2>1. What Are Cookies?</h2>
      <p>
        Cookies are small text files stored on your browser or device when you visit a website. They allow the website to recognize your session, keep you signed in, remember your preferences, and maintain security.
      </p>

      <h2>2. Essential Cookies</h2>
      <p>
        Zappit uses essential cookies required for authentication, CSRF security, and session management. Disabling essential cookies will prevent you from signing in or using protected account features.
      </p>
      <ul>
        <li>
          <strong>next-auth.session-token</strong> / <strong>__Secure-next-auth.session-token</strong>: Maintains your authenticated user session securely across pages.
        </li>
        <li>
          <strong>next-auth.csrf-token</strong> / <strong>__Host-next-auth.csrf-token</strong>: Protects against Cross-Site Request Forgery (CSRF) attacks during authentication and form submissions.
        </li>
        <li>
          <strong>next-auth.callback-url</strong>: Stores your intended destination URL to seamlessly redirect you after signing in.
        </li>
        <li>
          <strong>zappit_consent</strong>: Records your accepted legal and cookie consent version so you are not prompted repeatedly.
        </li>
      </ul>

      <h2>3. Functional &amp; Optional Cookies</h2>
      <p>
        Zappit uses a first-party referral cookie when you visit the site via a partner affiliate link:
      </p>
      <ul>
        <li>
          <strong>zappit_ref</strong>: A signed HTTP-only cookie used to attribute order commissions to approved Zappit affiliate partners when you complete a purchase.
        </li>
      </ul>

      <h2>4. No Third-Party Tracking or Advertising Cookies</h2>
      <p>
        Zappit <strong>does not</strong> use Google Analytics, Meta Pixel, cross-site advertising cookies, or third-party behavioral tracking cookies. All analytics (such as NFC card taps and QR code scans) are first-party metrics processed directly on Zappit servers without selling or sharing data with ad networks.
      </p>

      <h2>5. Managing Cookies</h2>
      <p>
        You can control and manage cookies through your web browser settings. Most browsers allow you to block or delete cookies. Please note that if you block essential cookies, Zappit account login and ordering functions will not operate correctly.
      </p>
    </LegalPage>
  );
}
