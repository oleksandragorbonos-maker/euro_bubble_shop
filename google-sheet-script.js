// Цей код вставляється в Google-таблицю: Розширення → Apps Script.
// Він приймає замовлення від сайту і додає їх рядками в таблицю.
// На сам сайт (GitHub/Netlify) цей файл впливу не має — він лише зберігається тут як копія.

// ЗАМІНИТИ (тільки в Google Apps Script, НЕ в цьому файлі на GitHub — він публічний):
// придумайте довгий пароль і вкажіть той самий у Netlify як GOOGLE_SHEET_SECRET
const SECRET = "придумайте-довгий-пароль-123";

const HEADERS = ["Дата", "Товар", "Ім'я", "Прізвище", "Телефон", "Месенджер", "Джерело", "Статус"];

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  if (data.secret !== SECRET) return reply({ ok: false, error: "wrong secret" });

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#dcfce7");
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    text(data.time),
    text(data.product),
    text(data.firstName),
    text(data.lastName),
    text(data.phone),
    text(data.messenger),
    text(data.source),
    "Нове",
  ]);

  return reply({ ok: true });
}

// Апостроф на початку змушує таблицю зберігати значення як текст:
// так "+380..." не перетвориться на число, а "=..." не стане формулою.
function text(value) {
  return "'" + String(value || "");
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
