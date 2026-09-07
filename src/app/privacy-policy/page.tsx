import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy - Zappit",
  description: "Zappit Privacy Policy and data protection guidelines.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="1 September 2026">
      <h2>1. Information We Collect</h2>
      <p>
        Zappit collects information necessary to provide NFC cards, QR profiles, digital business cards, and account authentication. This includes account details (name, email address, profile image), profile content you voluntarily publish, and transaction records.
      </p>

      <h2>2. How We Use Your Information</h2>
      <p>
        Information is used solely to maintain your account, process card orders, deliver digital card pages to profile visitors, provide support, and manage account security. We do not sell or rent user data to third parties.
      </p>

      <h2>3. Public Card Profiles &amp; Finder Controls</h2>
      <p>
        You control which contact details, social links, and fields are displayed on your public digital card. Emergency phone numbers and private owner details remain protected according to your designated visibility settings.
      </p>

      <h2>4. Data Storage &amp; Security</h2>
      <p>
        Account passwords are hashed securely, and sessions are protected with industry-standard JWT authentication tokens and encrypted HTTPS connections.
      </p>

      <h2>5. Your Data Rights</h2>
      <p>
        You have the right to access, update, or delete your account information and card profiles at any time through your dashboard or by contacting support.
      </p>
    </LegalPage>
  );
}
