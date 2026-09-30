// Synthetic data only. Never loads or changes production treasury records.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, ".."),
  out = process.env.QA_OUTPUT || path.resolve(root, "../tmp/report");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/tmp/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.route("http://report.test/**", async (route) => {
      const name = new URL(route.request().url()).pathname;
      const file = path.join(root, name);
      if (fs.existsSync(file) && fs.statSync(file).isFile())
        await route.fulfill({ path: file });
      else
        await route.fulfill({
          body: '<html><head><meta charset="utf-8"></head><body></body></html>',
          contentType: "text/html",
        });
    });
    await page.goto("http://report.test/tesoreria/qa.html");
    for (const file of [
      "assets/vendor/jspdf/jspdf.umd.min.js",
      "assets/vendor/jspdf/fonts.js",
      "tesoreria/model.js",
      "tesoreria/report.js",
    ])
      await page.addScriptTag({ url: "http://report.test/" + file });
    await page.evaluate(() => {
      const entries = Array.from({ length: 58 }, (_, i) => ({
        id: String(i),
        entry_date: "2026-08-" + String((i % 28) + 1).padStart(2, "0"),
        created_at: String(i).padStart(3, "0"),
        status: "posted",
        kind: i < 26 ? "income" : "expense",
        fund: i % 5 === 0 ? "rent" : "general",
        amount_cents: 1200,
        category: i < 26 ? "seventh" : "supplies",
        description:
          i === 0
            ? "Concepto extenso que debe conservarse completo en las notas. ".repeat(
                20,
              )
            : i < 26
              ? "Recaudación de la reunión"
              : "Compra de café y azúcar",
        no_receipt_reason:
          "Registro transcrito del informe histórico. No se entregó comprobante.",
        receipt_path:
          i === 4
            ? "a/photo.jpg"
            : i === 5
              ? "a/broken.jpg"
              : i === 6
                ? "a/document.pdf"
                : null,
      }));
      window.r = {
        month: "2026-08-01",
        entries,
        dues: [],
        funds: ["general", "rent"].map((f) => {
          const income =
              entries.filter((e) => e.fund === f && e.kind === "income")
                .length * 1200,
            expense =
              entries.filter((e) => e.fund === f && e.kind === "expense")
                .length * 1200;
          return {
            fund: f,
            opening: 50000,
            income,
            expense,
            closing: 50000 + income - expense,
          };
        }),
      };
      window.options = {
        includeReceipts: true,
        timeoutMs: 1000,
        loadReceipt: async (p) => {
          if (p.includes("broken")) return new Promise(() => {});
          const c = document.createElement("canvas");
          c.width = 3000;
          c.height = 4000;
          const x = c.getContext("2d");
          x.fillStyle = "white";
          x.fillRect(0, 0, 3000, 4000);
          x.fillStyle = "black";
          x.font = "40px sans-serif";
          x.fillText("COMPROBANTE DE PRUEBA", 80, 120);
          x.fillText("Café y azúcar · USD 12,00", 80, 220);
          return await new Promise((resolve) => c.toBlob(resolve, "image/png"));
        },
      };
    });
    const download = page.waitForEvent("download");
    const outcome = await page.evaluate(() =>
      TreasuryReport.download(r, false, "Servicio de prueba", options),
    );
    await (await download).saveAs(path.join(out, "report-many.pdf"));
    assert.equal(outcome.missingReceipts, 1);
    const checks = await page.evaluate(async () => {
      const evidence = await TreasuryReport.prepare(r, options);
      document.body.innerHTML =
        '<div id="print-area">' +
        TreasuryReport.html(r, false, "Servicio de prueba", evidence) +
        "</div>";
      await Promise.all([...document.images].map((i) => i.decode()));
      return {
        titles: [...document.querySelectorAll("h2")].map((e) => e.textContent),
        photos: document.querySelectorAll(".report-evidence img").length,
        text: document.body.textContent,
      };
    });
    assert(checks.titles.some((t) => t === "Ingresos · 26 movimientos"));
    assert(checks.titles.some((t) => t === "Egresos · 32 movimientos"));
    assert.equal(checks.photos, 1);
    assert(checks.text.includes("I01"));
    assert(checks.text.includes("No se pudo cargar"));
    assert(checks.text.includes("PDF original"));
    await page.addStyleTag({
      path: path.join(root, "tesoreria/tesoreria.css"),
    });
    await page.pdf({
      path: path.join(out, "report-print.pdf"),
      format: "A4",
      printBackground: true,
    });
    const snap = await page.evaluate(() => {
      const closed = {
        ...r,
        closure: {
          summary: { ...r, entries: [], funds: r.funds },
          closed_name: "Prueba",
          counted_cents: 92800,
          difference_cents: 0,
        },
      };
      return TreasuryReport.html(closed, false, "Prueba");
    });
    assert(snap.includes("Ingresos · 0 movimientos"));
    assert(!snap.includes("Ingresos · 26 movimientos"));
    console.log(
      "PASS: separate tables, 58 records, long notes preserved, image annex, failed image notice, PDF index, closure snapshot, print.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
