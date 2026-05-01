import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy - CalBot",
  description: "Refund Policy for CalBot subscriptions processed by Paddle."
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
            CalBot is operated by Pomo Cowork. Purchases and subscriptions for CalBot
            are processed by Paddle, our merchant of record and authorized reseller.
            Paddle&apos;s Buyer Terms and Refund Policy apply to your purchase.
          </p>

          <div>
            <h2>1. Paddle refund policy</h2>
            <p>
              Refunds are governed by Paddle&apos;s Refund Policy, which forms part of
              Paddle&apos;s Buyer Terms. Paddle handles refund eligibility, statutory
              withdrawal rights, discretionary refund requests, timing, and payment
              method processing.
            </p>
            <p>
              You can review Paddle&apos;s Buyer Terms at{" "}
              <a href="https://www.paddle.com/legal/buyer-terms">
                https://www.paddle.com/legal/buyer-terms
              </a>{" "}
              and Paddle&apos;s Refund Policy at{" "}
              <a href="https://www.paddle.com/legal/refund-policy">
                https://www.paddle.com/legal/refund-policy
              </a>
              .
            </p>
          </div>

          <div>
            <h2>2. Cancellations</h2>
            <p>
              You may cancel a subscription at any time through Paddle. Cancellation
              takes effect at the end of the current billing period and prevents future
              renewal charges, as described in Paddle&apos;s Buyer Terms.
            </p>
          </div>

          <div>
            <h2>3. How to request a refund</h2>
            <p>
              Request a refund through Paddle using the &quot;View receipt&quot; or
              &quot;Manage subscription&quot; link in your transaction confirmation email, the
              support link in your receipt or billing page, or Paddle&apos;s buyer support
              site at{" "}
              <a href="https://paddle.net">https://paddle.net</a>.
            </p>
            <p>
              You may also contact us through the CalBot support flow in Telegram if
              you need help identifying your transaction or reaching Paddle support.
            </p>
          </div>

          <div>
            <h2>4. Related documents</h2>
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
