import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Політика повернення коштів — CalBot",
  description: "Політика повернення коштів за підписки CalBot, оброблені через Paddle."
};

export default function RefundPolicyPage() {
  return (
    <main className="legalPage">
      <nav className="legalTopNav" aria-label="Навігація юридичними документами">
        <Link className="brand" href="/"><span className="brandMark">C</span><span>CalBot</span></Link>
        <div>
          <Link href="/terms">Умови</Link>
          <Link href="/privacy">Конфіденційність</Link>
          <Link aria-current="page" href="/refund">Повернення коштів</Link>
        </div>
      </nav>
      <article className="legalDocument">
        <header className="legalHeader">
          <h1>Політика повернення коштів</h1>
          <p>Дата набрання чинності: 1 травня 2026 року</p>
        </header>
        <section>
          <p>CalBot керує Pomo Cowork. Покупки та підписки CalBot обробляє Paddle — наш офіційний продавець і уповноважений реселер. До вашої покупки застосовуються Умови для покупців і Політика повернення коштів Paddle.</p>
          <div>
            <h2>1. Політика повернення коштів Paddle</h2>
            <p>Повернення коштів регулюється Політикою повернення коштів Paddle, яка є частиною Умов для покупців Paddle. Paddle визначає право на повернення, законодавчі права на відмову, розглядає запити та проводить виплати.</p>
            <p>Ознайомитися з Умовами для покупців Paddle можна на сторінці <a href="https://www.paddle.com/legal/buyer-terms">https://www.paddle.com/legal/buyer-terms</a>, а з Політикою повернення — на сторінці <a href="https://www.paddle.com/legal/refund-policy">https://www.paddle.com/legal/refund-policy</a>.</p>
          </div>
          <div>
            <h2>2. Строк подання запиту</h2>
            <p>Стандартний строк подання запиту на повернення становить 14 календарних днів від дати транзакції. Він поширюється на першу покупку підписки та її поновлення, якщо місцеве законодавство не передбачає довшого строку.</p>
            <p>Подання запиту протягом 14 днів не гарантує повернення. Paddle перевіряє право на нього з урахуванням використання продукту, технічних проблем, підозри на шахрайство чи зловживання та вимог законодавства.</p>
          </div>
          <div><h2>3. Скасування</h2><p>Підписку можна скасувати через Paddle у будь-який час. Скасування набуде чинності наприкінці поточного розрахункового періоду та зупинить майбутні списання, як описано в Умовах для покупців Paddle.</p></div>
          <div>
            <h2>4. Як подати запит на повернення</h2>
            <p>Скористайтеся посиланням «Переглянути квитанцію» або «Керувати підпискою» в листі з підтвердженням транзакції, посиланням підтримки у квитанції чи на сторінці оплати або сайтом підтримки покупців Paddle: <a href="https://paddle.net">https://paddle.net</a>.</p>
            <p>Якщо вам потрібна допомога з пошуком транзакції або зверненням до Paddle, зв’яжіться з підтримкою CalBot у Telegram.</p>
          </div>
          <div><h2>5. Пов’язані документи</h2><p>Дивіться також наші <Link href="/terms">Умови користування</Link> та <Link href="/privacy">Політику конфіденційності</Link>.</p></div>
        </section>
      </article>
    </main>
  );
}
