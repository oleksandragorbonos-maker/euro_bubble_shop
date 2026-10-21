// Серверна функція Netlify: приймає замовлення з форми, надсилає його в Telegram
// і (якщо налаштовано) зберігає копію в Google-таблицю.
// Усі ключі беруться з налаштувань Netlify (Environment variables),
// тому їх не видно в коді сторінки.

const MESSENGERS = ["Telegram", "Viber", "WhatsApp", "Дзвінок"];

// Telegram з parse_mode=HTML вимагає екранувати ці символи
const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const clean = (v, max) => String(v || "").trim().slice(0, max);

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function sendToTelegram(order) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error("Не задані TELEGRAM_BOT_TOKEN або TELEGRAM_CHAT_ID");
  }

  const digits = order.phone.slice(1);
  const links = {
    Telegram: `https://t.me/+${digits}`,
    Viber: `viber://chat?number=%2B${digits}`,
    WhatsApp: `https://wa.me/${digits}`,
  };

  const lines = [
    "🫧 <b>Нове замовлення — eurobubbleshop</b>",
    `📦 ${escapeHtml(order.product)}`,
    "",
    `👤 ${escapeHtml(order.firstName)} ${escapeHtml(order.lastName)}`,
    `📞 <code>${order.phone}</code>`,
    `💬 Зв'язок: <b>${order.messenger}</b>`,
    links[order.messenger] ? `🔗 <a href="${links[order.messenger]}">Написати в ${order.messenger}</a>` : null,
    "",
    `📍 Джерело: ${escapeHtml(order.source)}`,
    `🕐 ${order.time}`,
  ].filter((l) => l !== null);

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: lines.join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
}

async function saveToSheet(order) {
  const { GOOGLE_SHEET_URL, GOOGLE_SHEET_SECRET } = process.env;
  if (!GOOGLE_SHEET_URL) return "skipped"; // таблицю ще не підключили — це не помилка

  const res = await fetch(GOOGLE_SHEET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...order, secret: GOOGLE_SHEET_SECRET || "" }),
  });
  const body = await res.text();
  if (!res.ok || !body.includes('"ok":true')) throw new Error(`Google Sheet ${res.status}: ${body.slice(0, 200)}`);
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let data;
  try {
    data = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  // Бот заповнив приховане поле — робимо вигляд, що все ок, але нічого не шлемо
  if (data.website) return json(200, { ok: true });

  const order = {
    product: clean(data.product, 100) || "—",
    firstName: clean(data.firstName, 50),
    lastName: clean(data.lastName, 50),
    phone: String(data.phone || "").replace(/\s/g, ""),
    messenger: MESSENGERS.includes(data.messenger) ? data.messenger : "—",
    source: clean(data.source, 120) || "—",
    time: new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" }),
  };

  if (order.firstName.length < 2 || order.lastName.length < 2 || !/^\+380\d{9}$/.test(order.phone)) {
    return json(400, { error: "Invalid fields" });
  }

  // Надсилаємо в Telegram і таблицю одночасно; якщо хоч щось спрацювало — замовлення не втрачене
  const [tg, sheet] = await Promise.allSettled([sendToTelegram(order), saveToSheet(order)]);
  if (tg.status === "rejected") console.error(tg.reason);
  if (sheet.status === "rejected") console.error(sheet.reason);

  const savedToSheet = sheet.status === "fulfilled" && sheet.value !== "skipped";
  if (tg.status === "rejected" && !savedToSheet) {
    return json(502, { error: "Order was not delivered" });
  }
  return json(200, { ok: true });
};

// Функція буде доступна за адресою /api/order
export const config = { path: "/api/order" };
