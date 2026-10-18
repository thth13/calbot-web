import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — CalBot",
  description: "Terms of Service for CalBot, an AI calorie tracker in Telegram."
};

export default function TermsOfServicePage() {
  return (
    <main className="legalPage">
      <nav className="legalTopNav" aria-label="Legal navigation">
        <Link className="brand" href="/"><span className="brandMark">C</span><span>CalBot</span></Link>
        <div><Link aria-current="page" href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/refund">Refunds</Link></div>
      </nav>
      <article className="legalDocument">
        <header className="legalHeader"><h1>Terms of Service</h1><p>Effective date: May 1, 2026</p></header>
        <section>
          <p>These Terms of Service (“Terms”) govern access to the CalBot website, Telegram bot, subscriptions and related services (“Service”) provided by Pomo Cowork (“Pomo Cowork”, “CalBot”, “we”, “us”). By using the Service, you agree to these Terms.</p>
          <div><h2>1. Eligibility</h2><p>You must be at least 16 years old or have reached the age of digital consent in your country. By using the Service, you confirm that you meet this requirement and have the legal capacity to accept these Terms.</p></div>
          <div><h2>2. Telegram account and security</h2><p>CalBot operates through Telegram. You are responsible for your account, device security and all activity under your account. Your use of Telegram is also subject to its own terms and privacy policy.</p></div>
          <div><h2>3. Nutrition estimates</h2><p>CalBot uses AI to estimate nutritional values from food photos and text descriptions. Results may be incomplete or inaccurate and are provided only for general tracking and informational purposes. The Service does not provide medical, dietary or professional nutrition advice.</p></div>
          <div><h2>4. Acceptable use</h2><p>You agree not to misuse the Service. In particular, you must not:</p><ul><li>violate the law or the rights of others;</li><li>attempt to gain unauthorized access to, overload or disrupt our systems;</li><li>send malware, spam, abusive or illegal content;</li><li>reverse engineer, decompile or attempt to obtain source code;</li><li>abuse automation, scraping or excessive requests;</li><li>use the Service to build a competing product.</li></ul></div>
          <div><h2>5. Your content</h2><p>You retain ownership of the photos, meal descriptions, messages and other content you provide (“User Content”). You grant us a worldwide, non-exclusive, royalty-free license to host, process, transmit, analyze and display it solely to operate, protect, support and improve the Service. You confirm that you have all necessary rights to this content.</p></div>
          <div><h2>6. Changes to the Service</h2><p>We may update, change, suspend or discontinue individual features from time to time. We will make reasonable efforts to notify paid subscribers of material changes that adversely affect them.</p></div>
          <div><h2>7. Subscriptions and payments</h2><p>Paid plans may provide additional limits, features or analytics. Prices, renewal dates, taxes, payment methods and plan details are shown before purchase. Payments are processed by Paddle as merchant of record and authorized reseller.</p><ul><li>Automatic renewal: subscriptions renew automatically unless canceled before the renewal date.</li><li>Cancellation: you may cancel your subscription at any time through the available billing interface.</li><li>Trials and promotions: terms are displayed with the offer.</li><li>Price changes: we may change prices with advance notice where required.</li><li>Taxes: you are responsible for applicable taxes unless stated otherwise.</li></ul></div>
          <div><h2>8. Refunds</h2><p>Refunds, statutory withdrawal rights and cancellation-related charges are governed by the Paddle Buyer Terms and Refund Policy. For details, see our <Link href="/refund">Refund Policy</Link> and the Paddle terms at checkout.</p></div>
          <div><h2>9. Third-party services</h2><p>The Service may use or link to third-party services, including Telegram, payment processors, hosting, analytics tools and AI model providers. Their own terms and privacy policies apply, and we are not responsible for their operation.</p></div>
          <div><h2>10. Intellectual property</h2><p>The Service, its software, design, brand and website content belong to us or our licensors and are protected by intellectual property laws. You may not use our trademarks without prior written permission.</p></div>
          <div><h2>11. Feedback</h2><p>By providing feedback, you grant us a perpetual, irrevocable, worldwide, royalty-free license to use it without compensation or obligation to you.</p></div>
          <div><h2>12. Suspension and termination</h2><p>We may suspend or terminate access if you violate these Terms, misuse the Service, create a legal or security risk, or if required by law. You may stop using the Service at any time.</p></div>
          <div><h2>13. Data export and deletion</h2><p>Available export and deletion features may be provided through the bot or support. We may retain limited data where required by law or legitimate business needs. The collection and use of personal data are described in the <Link href="/privacy">Privacy Policy</Link>.</p></div>
          <div><h2>14. Disclaimer of warranties</h2><p>The Service is provided “as is” and “as available” without express or implied warranties. We do not guarantee uninterrupted, secure, accurate or error-free operation.</p></div>
          <div><h2>15. Limitation of liability</h2><p>To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential or punitive damages, or loss of profit, revenue, data or goodwill. Our total liability is limited to the amount you paid for the Service during the 12 months before the event giving rise to the claim.</p></div>
          <div><h2>16. Indemnification</h2><p>You agree to indemnify us against claims arising from your use of the Service, your User Content or your violation of these Terms.</p></div>
          <div><h2>17. Governing law and disputes</h2><p>For consumer transactions, these Terms are governed by the law applicable in your place of residence, unless mandatory rules require otherwise. In the event of a dispute, we will first try to resolve it informally.</p></div>
          <div><h2>18. Changes to these Terms</h2><p>We may update these Terms from time to time. We will notify you of material changes in the bot, on the website or by other reasonable means before they take effect. Continued use after the effective date means acceptance of the updated Terms.</p></div>
          <div><h2>19. Contact</h2><p>If you have questions about these Terms, contact CalBot support in Telegram.</p></div>
        </section>
      </article>
    </main>
  );
}
