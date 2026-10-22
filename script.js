// ЗАМІНИТИ: назва товару, яка прийде вам у повідомленні в Telegram
const PRODUCT_NAME = "Холодне відновлення Triology Bondplex 2F";

const modal = document.getElementById("orderModal");
const form = document.getElementById("orderForm");
const successBox = document.getElementById("successBox");
const errorBox = document.getElementById("formError");
const submitBtn = document.getElementById("submitBtn");
const phoneInput = form.elements.phone;

// ----- Звідки прийшов клієнт (реклама, Instagram, пряме посилання) -----
// Запам'ятовуємо при першому відкритті, бо клієнт може погортати сторінку і повернутися.
function detectSource() {
  const params = new URLSearchParams(location.search);
  const utm = ["utm_source", "utm_medium", "utm_campaign"]
    .map((k) => params.get(k))
    .filter(Boolean)
    .join(" / ");
  if (utm) return utm;
  if (params.has("fbclid")) return "Реклама Facebook/Instagram";

  let host = "";
  try {
    host = new URL(document.referrer).hostname.replace(/^(www\.|l\.|lm\.|m\.)/, "");
  } catch {}
  if (host && host !== location.hostname) {
    if (host.includes("instagram")) return "Instagram";
    if (host.includes("facebook")) return "Facebook";
    if (host.includes("tiktok")) return "TikTok";
    return host;
  }
  return "Пряме посилання";
}

let source;
try {
  source = sessionStorage.getItem("source") || detectSource();
  sessionStorage.setItem("source", source);
} catch {
  source = detectSource();
}

// Подія для Meta Pixel (спрацює, лише якщо піксель увімкнено в index.html)
const track = (event) => window.fbq && window.fbq("track", event);

// ----- Галерея: клік по мініатюрі змінює головне фото -----
document.querySelectorAll(".thumb").forEach((thumb) => {
  thumb.addEventListener("click", () => {
    document.getElementById("mainImage").src = thumb.dataset.src;
    document.querySelectorAll(".thumb").forEach((t) => t.classList.remove("active"));
    thumb.classList.add("active");
  });
});

// ----- Відео: вантажиться і грає лише тоді, коли його видно на екрані -----
const promoVideo = document.getElementById("promoVideo");
if (promoVideo && "IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) promoVideo.play().catch(() => {});
    else promoVideo.pause();
  }, { threshold: 0.4 }).observe(promoVideo);
}

// ----- Відкриття / закриття вікна -----
function openModal() {
  form.hidden = false;
  successBox.hidden = true;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  track("InitiateCheckout");
  setTimeout(() => form.elements.firstName.focus(), 50);
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

document.querySelectorAll("[data-open-order]").forEach((b) => b.addEventListener("click", openModal));
modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
});

// ----- Маска телефону: +380 XX XXX XX XX -----
function formatPhone(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "38" + digits;      // 067... -> 38067...
  if (!digits.startsWith("380")) digits = "380" + digits.replace(/^3?8?0?/, "");
  digits = digits.slice(0, 12);

  const p = digits.slice(3);
  let out = "+380";
  if (p.length) out += " " + p.slice(0, 2);
  if (p.length > 2) out += " " + p.slice(2, 5);
  if (p.length > 5) out += " " + p.slice(5, 7);
  if (p.length > 7) out += " " + p.slice(7, 9);
  return out;
}

phoneInput.addEventListener("focus", () => {
  if (!phoneInput.value) phoneInput.value = "+380 ";
});
phoneInput.addEventListener("input", () => {
  phoneInput.value = formatPhone(phoneInput.value);
});

// ----- Перевірка полів -----
function validate() {
  const checks = {
    firstName: form.elements.firstName.value.trim().length >= 2,
    lastName: form.elements.lastName.value.trim().length >= 2,
    phone: /^\+380\d{9}$/.test(phoneInput.value.replace(/\s/g, "")),
  };
  let firstInvalid = null;
  for (const [name, ok] of Object.entries(checks)) {
    form.elements[name].classList.toggle("invalid", !ok);
    if (!ok && !firstInvalid) firstInvalid = form.elements[name];
  }
  if (firstInvalid) {
    firstInvalid.focus();
    return firstInvalid === phoneInput
      ? "Перевірте номер телефону: +380 XX XXX XX XX"
      : "Будь ласка, вкажіть ім'я та прізвище";
  }
  return null;
}

form.querySelectorAll("input").forEach((input) =>
  input.addEventListener("input", () => input.classList.remove("invalid"))
);

// ----- Відправка замовлення -----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.hidden = true;

  const error = validate();
  if (error) {
    errorBox.textContent = error;
    errorBox.hidden = false;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Надсилаємо...";

  try {
    const res = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: PRODUCT_NAME,
        firstName: form.elements.firstName.value.trim(),
        lastName: form.elements.lastName.value.trim(),
        phone: phoneInput.value.replace(/\s/g, ""),
        messenger: form.elements.messenger.value,
        source,
        website: form.elements.website.value, // пастка для ботів
      }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);

    track("Lead");
    form.reset();
    form.hidden = true;
    successBox.hidden = false;
  } catch (err) {
    errorBox.textContent = "Не вдалося надіслати замовлення. Спробуйте ще раз або напишіть нам в Instagram.";
    errorBox.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Підтвердити замовлення";
  }
});
