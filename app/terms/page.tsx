import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - CalBot",
  description: "Terms of Service for CalBot, an AI calorie tracker in Telegram."
};

export default function TermsOfServicePage() {
  return (
    <main className="legalPage">
      <nav className="legalTopNav" aria-label="Legal navigation">
        <Link className="brand" href="/">
          <span className="brandMark">C</span>
          <span>CalBot</span>
        </Link>
        <div>
          <Link aria-current="page" href="/terms">
            Terms
          </Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refund">Refund</Link>
        </div>
      </nav>

      <article className="legalDocument">
        <header className="legalHeader">
          <h1>Terms of Service</h1>
          <p>Effective date: 1 May 2026</p>
        </header>

        <section>
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of
            the CalBot website, Telegram bot, subscriptions, and related services
            (&quot;Service&quot;) provided by Pomo Cowork (&quot;Pomo Cowork&quot;,
            &quot;CalBot&quot;, &quot;we&quot;, &quot;us&quot;). By opening the bot, using the
            website, creating a subscription, or otherwise using the Service, you agree
            to these Terms.
          </p>

          <div>
            <h2>1. Eligibility</h2>
            <p>
              You must be at least 16 years old, or the age of digital consent in your
              country, to use the Service. By using the Service, you represent that you
              meet this requirement and have the legal capacity to enter into these
              Terms.
            </p>
          </div>

          <div>
            <h2>2. Telegram account and security</h2>
            <p>
              CalBot is provided through Telegram. You are responsible for your
              Telegram account, device security, and all activity performed through your
              account. Telegram&apos;s own terms and privacy policy also apply to your use
              of Telegram.
            </p>
          </div>

          <div>
            <h2>3. Nutrition estimates</h2>
            <p>
              CalBot provides AI-generated nutrition estimates from food photos and text
              descriptions. Results may be incomplete or inaccurate and are provided for
              general tracking and informational purposes only. The Service is not
              medical, dietary, or professional nutrition advice.
            </p>
          </div>

          <div>
            <h2>4. Acceptable use</h2>
            <p>You agree not to misuse the Service. In particular, you will not:</p>
            <ul>
              <li>break the law or infringe the rights of others;</li>
              <li>attempt to access, probe, overload, or disrupt our systems;</li>
              <li>send malware, spam, abusive content, or illegal content;</li>
              <li>reverse engineer, decompile, or attempt to extract source code;</li>
              <li>use automated abuse, scraping, or excessive requests;</li>
              <li>use the Service to build or provide a competing product.</li>
            </ul>
          </div>

          <div>
            <h2>5. Your content</h2>
            <p>
              You retain ownership of photos, meal descriptions, messages, and other
              content you submit (&quot;User Content&quot;). You grant us a worldwide,
              non-exclusive, royalty-free license to host, process, transmit, analyze,
              and display User Content only as needed to operate, secure, support, and
              improve the Service. You represent that you have all rights necessary to
              submit the User Content.
            </p>
          </div>

          <div>
            <h2>6. Service changes</h2>
            <p>
              We may update, modify, suspend, or discontinue features from time to time.
              We will make reasonable efforts to provide notice of material changes that
              adversely impact paid subscribers.
            </p>
          </div>

          <div>
            <h2>7. Subscriptions and billing</h2>
            <p>
              Paid plans may be offered for additional limits, features, or analytics.
              Prices, renewal dates, taxes, payment methods, and plan details are shown
              before you complete a purchase. Purchases are processed by Paddle as
              merchant of record and authorized reseller.
            </p>
            <ul>
              <li>Auto-renewal: subscriptions renew automatically unless cancelled before renewal.</li>
              <li>Cancellation: you can cancel anytime through the available billing flow.</li>
              <li>Trials and promotions: terms are displayed when the offer is presented.</li>
              <li>Price changes: we may change prices with advance notice where required.</li>
              <li>Taxes: you are responsible for applicable taxes unless stated otherwise.</li>
            </ul>
          </div>

          <div>
            <h2>8. Refunds</h2>
            <p>
              Refunds, statutory withdrawal rights, refund requests, and
              cancellation-related billing handling are governed by Paddle&apos;s Buyer
              Terms and Refund Policy. For details, see our{" "}
              <Link href="/refund">
                Refund Policy
              </Link>{" "}
              and Paddle&apos;s terms presented at checkout.
            </p>
          </div>

          <div>
            <h2>9. Third-party services</h2>
            <p>
              The Service may rely on or link to third-party services, including
              Telegram, payment processors, hosting providers, analytics tools, and AI
              model providers. Their terms and privacy policies apply to your use of
              those services, and we are not responsible for them.
            </p>
          </div>

          <div>
            <h2>10. Intellectual property</h2>
            <p>
              The Service, including its software, design, branding, and website
              content, is owned by us or our licensors and is protected by intellectual
              property laws. You may not use our trademarks without prior written
              permission.
            </p>
          </div>

          <div>
            <h2>11. Feedback</h2>
            <p>
              If you provide feedback, you grant us a perpetual, irrevocable, worldwide,
              royalty-free license to use it without compensation or obligation to you.
            </p>
          </div>

          <div>
            <h2>12. Suspension and termination</h2>
            <p>
              We may suspend or terminate access if you violate these Terms, misuse the
              Service, create legal or security risk, or if required by law. You may stop
              using the Service at any time. Upon termination, your right to access the
              Service ends.
            </p>
          </div>

          <div>
            <h2>13. Data export and deletion</h2>
            <p>
              Available export and deletion options may be provided through the bot or
              support flow. We may retain limited data as required by law or for
              legitimate business purposes such as fraud prevention, security,
              accounting, and dispute handling. Our collection and use of personal data
              is described in our{" "}
              <Link href="/privacy">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          <div>
            <h2>14. Disclaimers</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without
              warranties of any kind, express or implied. We do not warrant that the
              Service will be uninterrupted, secure, accurate, or error-free.
            </p>
          </div>

          <div>
            <h2>15. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, we are not liable for indirect,
              incidental, special, consequential, or punitive damages, or for loss of
              profits, revenue, data, or goodwill. Our total liability for any claim is
              limited to the amount paid by you to us for the Service in the 12 months
              preceding the event giving rise to the claim.
            </p>
          </div>

          <div>
            <h2>16. Indemnification</h2>
            <p>
              You agree to indemnify and hold us harmless from claims arising out of
              your use of the Service, your User Content, or your violation of these
              Terms.
            </p>
          </div>

          <div>
            <h2>17. Governing law and disputes</h2>
            <p>
              These Terms are governed by the laws applicable where you reside for
              consumer transactions, unless a different law is required by mandatory
              provisions. If a dispute arises, we will try to resolve it informally
              first.
            </p>
          </div>

          <div>
            <h2>18. Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. If changes are material, we
              will provide notice in the bot, on the website, or through another
              reasonable channel before they take effect. Continued use after the
              effective date means you accept the updated Terms.
            </p>
          </div>

          <div>
            <h2>19. Contact</h2>
            <p>
              Questions about these Terms? Contact us through the CalBot support flow in
              Telegram.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
