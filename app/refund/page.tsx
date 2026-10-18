import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy — CalBot",
  description: "Refund Policy for CalBot subscriptions processed through Paddle."
};

export default function RefundPolicyPage() {
  return (
    <main className="legalPage">
      <nav className="legalTopNav" aria-label="Legal navigation">
        <Link className="brand" href="/"><span className="brandMark">C</span><span>CalBot</span></Link>
        <div>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link aria-current="page" href="/refund">Refunds</Link>
        </div>
      </nav>
      <article className="legalDocument">
        <header className="legalHeader">
          <h1>Refund Policy</h1>
          <p>Effective date: May 1, 2026</p>
        </header>
        <section>
          <p>CalBot is operated by Pomo Cowork. CalBot purchases and subscriptions are processed by Paddle, our merchant of record and authorized reseller. The Paddle Buyer Terms and Refund Policy apply to your purchase.</p>
          <div>
            <h2>1. Paddle Refund Policy</h2>
            <p>Refunds are governed by the Paddle Refund Policy, which forms part of the Paddle Buyer Terms. Paddle determines refund eligibility and statutory withdrawal rights, reviews requests and issues refunds.</p>
            <p>You can read the Paddle Buyer Terms at <a href="https://www.paddle.com/legal/buyer-terms">https://www.paddle.com/legal/buyer-terms</a> and the Refund Policy at <a href="https://www.paddle.com/legal/refund-policy">https://www.paddle.com/legal/refund-policy</a>.</p>
          </div>
          <div>
            <h2>2. Request period</h2>
            <p>The standard refund request period is 14 calendar days from the transaction date. It applies to initial subscription purchases and renewals, unless local law provides a longer period.</p>
            <p>Submitting a request within 14 days does not guarantee a refund. Paddle reviews eligibility based on product usage, technical issues, suspected fraud or abuse, and legal requirements.</p>
          </div>
          <div><h2>3. Cancellation</h2><p>You may cancel your subscription through Paddle at any time. Cancellation takes effect at the end of the current billing period and stops future charges, as described in the Paddle Buyer Terms.</p></div>
          <div>
            <h2>4. How to request a refund</h2>
            <p>Use the “View receipt” or “Manage subscription” link in your transaction confirmation email, the support link in your receipt or on the checkout page, or the Paddle buyer support website: <a href="https://paddle.net">https://paddle.net</a>.</p>
            <p>If you need help finding your transaction or contacting Paddle, contact CalBot support in Telegram.</p>
          </div>
          <div><h2>5. Related documents</h2><p>See also our <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</p></div>
        </section>
      </article>
    </main>
  );
}
