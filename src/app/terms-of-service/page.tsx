import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service - Zappit",
  description: "Zappit Terms of Service and Customer User Agreement.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service" updated="1 September 2026">
      <h2>1. Using Zappit</h2>
      <p>
        You must provide accurate account and order information, protect your login credentials, and use cards, QR codes, and profiles lawfully. You may publish only content you own or are authorised to use.
      </p>

      <h2>2. Account Security &amp; Legal Consent</h2>
      <p>
        By using Zappit services, you agree to comply with our Terms of Service, Privacy Policy, and Cookie Policy. You are responsible for all activities occurring under your authenticated session.
      </p>

      <h2>3. Orders and Custom Designs</h2>
      <p>
        Review names, links, images, colours, and delivery details before ordering. Manufacturing may begin after payment confirmation or acceptance of an order. Screen colours and physical finishes may vary slightly.
      </p>

      <h2>4. Public Profiles &amp; Digital Cards</h2>
      <p>
        Activated card profiles are public to anyone with the link, QR code, or NFC card. Publish only information you want visitors to access. We may suspend abusive, fraudulent, infringing, or unsafe content.
      </p>

      <h2>5. Service Availability</h2>
      <p>
        We work to keep services available but cannot promise uninterrupted operation. Features that depend on third-party networks, payment providers, email, telecom services, or device NFC capabilities may be affected by those services.
      </p>

      <h2>6. Liability</h2>
      <p>
        To the extent permitted by law, liability is limited to the amount paid for the affected product or service. Nothing here removes consumer rights that cannot legally be excluded.
      </p>
    </LegalPage>
  );
}
