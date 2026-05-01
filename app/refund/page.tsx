import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy - CalBot",
  description: "Refund Policy for CalBot subscriptions."
};

export default function RefundPolicyPage() {
  return (
    <main className="legalPage">
      <nav className="legalTopNav" aria-label="Legal navigation">
        <Link className="brand" href="/">
          <span className="brandMark">C</span>
          <span>CalBot</span>
        </Link>
        <div>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link aria-current="page" href="/refund">
            Refund
          </Link>
        </div>
      </nav>

      <article className="legalDocument">
        <header className="legalHeader">
          <h1>Refund Policy</h1>
          <p>Effective date: 1 May 2026</p>
        </header>

        <section>
          <p>
            This Refund Policy explains how refunds work for CalBot paid subscriptions.
            Payments may be processed by third-party payment providers, and their
            consumer terms, refund rules, and payment processing timelines may also
            apply.
          </p>

          <div>
            <h2>1. Definitions</h2>
            <ul>
              <li>
                <strong>Subscription:</strong> recurring access to paid CalBot features
                billed monthly, yearly, or as otherwise presented at checkout.
              </li>
              <li>
                <strong>Billing period:</strong> the time covered by a payment, such as
                one month or one year.
              </li>
              <li>
                <strong>Purchase:</strong> any subscription payment for the Service.
              </li>
            </ul>
          </div>

          <div>
            <h2>2. Refunds</h2>
            <p>
              You may request a refund within 14 days of the initial purchase or
              renewal, subject to applicable law and the rules of the payment provider
              used for your purchase.
            </p>
            <p>
              Refund requests submitted after this period may still be handled where
              required by law or where the payment provider&apos;s policies apply, for
              example in cases of billing errors, duplicate charges, or unauthorized
              charges.
            </p>
          </div>

          <div>
            <h2>3. Cancellations</h2>
            <p>
              You may cancel your subscription at any time. Cancellation stops future
              renewal charges. Cancellation does not automatically result in a refund
              for the current billing period, except where required by applicable law or
              the payment provider&apos;s refund policy.
            </p>
          </div>

          <div>
            <h2>4. How to request a refund</h2>
            <p>
              To request a refund, contact us through the CalBot support flow in
              Telegram or contact the payment provider listed on your receipt. Include:
            </p>
            <ul>
              <li>Telegram username or account identifier;</li>
              <li>invoice, receipt ID, or approximate purchase date;</li>
              <li>reason for the request.</li>
            </ul>
            <p>
              Approved refunds are returned to the original payment method where
              possible. Processing time depends on your bank, card network, app store,
              or payment provider.
            </p>
          </div>

          <div>
            <h2>5. Payment provider terms</h2>
            <p>
              Payment providers may act as merchants, resellers, payment processors, or
              platforms for your purchase. In the event of a conflict between this
              Policy and mandatory payment provider rules or applicable law, those rules
              or laws will prevail.
            </p>
          </div>

          <div>
            <h2>6. No refunds for abuse</h2>
            <p>
              We may refuse refund requests connected to fraud, abuse, violation of our
              Terms, chargeback misuse, or attempts to obtain repeated paid access
              without payment, except where a refund is required by law.
            </p>
          </div>

          <div>
            <h2>7. Changes to this Policy</h2>
            <p>
              We may update this Policy from time to time. The effective date above
              indicates the latest version.
            </p>
          </div>

          <div>
            <h2>8. Related documents</h2>
            <p>
              See also our <Link href="/terms">Terms of Service</Link> and{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
