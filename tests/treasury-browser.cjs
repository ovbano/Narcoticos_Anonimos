// Browser integration with an in-memory Supabase adapter. Database authorization is tested separately in treasury-database.sql.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, ".."),
  out = process.env.QA_OUTPUT || path.resolve(root, "../tmp/treasury");
fs.mkdirSync(out, { recursive: true });
const fixture = () => {
  const S = window.__fixture || {
    role: window.__qaRole || "admin",
    entries: [],
    members: [
      {
        id: "member-1",
        name: "Compañero de prueba A.",
        start_month: "2026-09-01",
        end_month: null,
        monthly_cents: 1200,
      },
    ],
    settings: window.__qaEmpty
      ? null
      : {
          id: true,
          start_month: "2026-09-01",
          opening_general: 14465,
          opening_rent: 0,
        },
    audit: [],
    files: {},
    logged: true,
    uploadFail: false,
  };
  window.__fixture = S;
  const user = { id: "qa-user", email: "qa@example.invalid" },
    profile = () => ({
      id: user.id,
      display_name: "Servicio de prueba",
      role: S.role,
      active: true,
    });
  const calc = (month) => {
    const entries = S.entries.filter(
        (e) => e.entry_date.slice(0, 7) === month.slice(0, 7),
      ),
      funds = ["general", "rent"].map((f) => {
        const prior = S.entries.filter(
          (e) => e.status === "posted" && e.fund === f && e.entry_date < month,
        );
        const opening =
            (f === "general"
              ? S.settings.opening_general
              : S.settings.opening_rent) +
            prior.reduce(
              (n, e) =>
                n + (e.kind === "income" ? e.amount_cents : -e.amount_cents),
              0,
            ),
          income = entries
            .filter(
              (e) =>
                e.fund === f && e.status === "posted" && e.kind === "income",
            )
            .reduce((n, e) => n + e.amount_cents, 0),
          expense = entries
            .filter(
              (e) =>
                e.fund === f && e.status === "posted" && e.kind === "expense",
            )
            .reduce((n, e) => n + e.amount_cents, 0);
        return {
          fund: f,
          opening,
          income,
          expense,
          closing: opening + income - expense,
        };
      });
    return {
      configured: true,
      month,
      entries,
      funds,
      dues: S.members.map((m) => ({
        id: m.id,
        name: m.name,
        expected: m.monthly_cents,
        paid: S.entries
          .filter(
            (e) =>
              e.member_id === m.id &&
              e.due_month === month &&
              e.status === "posted",
          )
          .reduce((n, e) => n + e.amount_cents, 0),
      })),
      closure: null,
    };
  };
  window.amigosSupabase = {
    auth: {
      getUser: async () => ({ data: { user: S.logged ? user : null } }),
      signInWithPassword: async () => {
        S.logged = true;
        return { data: { user } };
      },
      signOut: async () => {
        S.logged = false;
        return { data: {} };
      },
      onAuthStateChange: () => ({}),
      updateUser: async () => {
        S.passwordChanges = (S.passwordChanges || 0) + 1;
        return { data: { user } };
      },
      resetPasswordForEmail: async () => ({ data: {} }),
    },
    from(table) {
      let rows =
        table === "profiles"
          ? [profile()]
          : table === "treasury_settings"
            ? [S.settings]
            : table === "treasury_members"
              ? S.members
              : table === "treasury_entries"
                ? S.entries
                : S.audit;
      const q = {
        select() {
          return q;
        },
        eq(k, v) {
          rows = rows.filter((r) => r[k] === v);
          return q;
        },
        order() {
          return q;
        },
        range(a, b) {
          return Promise.resolve({
            data: structuredClone(rows.slice(a, b + 1)),
          });
        },
        maybeSingle() {
          return Promise.resolve({ data: structuredClone(rows[0] || null) });
        },
      };
      return q;
    },
    rpc: async (name, { p_action: a, p_data: d, p_month: m } = {}) => {
      if (name === "treasury_companions")
        return { data: [{ id: "source-1", name: "Ana Pérez QA" }] };
      if (name === "admin_list_users")
        return {
          data: [{ id: user.id, email: user.email, profile: profile() }],
        };
      if (name === "treasury_report" || name === "treasury_prepare_report")
        return { data: calc(m) };
      let record;
      if (a === "setup" || a === "initial_update") {
        S.settings = { id: true, ...d };
        record = S.settings;
      }
      if (a === "save" || a === "correct") {
        const idx = S.entries.findIndex((e) => e.id === d.id);
        record = {
          ...d,
          version: idx < 0 ? 1 : S.entries[idx].version + 1,
          created_at: new Date().toISOString(),
          member_name: S.members.find((x) => x.id === d.member_id)?.name,
        };
        if (idx < 0) S.entries.push(record);
        else S.entries[idx] = record;
      }
      if (a === "discard") S.entries = S.entries.filter((e) => e.id !== d.id);
      if (a === "void") {
        record = S.entries.find((e) => e.id === d.id);
        record.status = "void";
        record.void_reason = d.reason;
        record.version++;
      }
      if (a === "member") {
        record = { ...d, id: d.id || crypto.randomUUID() };
        const idx = S.members.findIndex((x) => x.id === record.id);
        if (idx < 0) S.members.push(record);
        else S.members[idx] = record;
      }
      S.audit.unshift({
        id: S.audit.length + 1,
        actor_name: "Servicio de prueba",
        action: a,
        happened_at: new Date().toISOString(),
        after_data: record,
      });
      return { data: { ok: true, record } };
    },
    storage: {
      from() {
        return {
          upload: async (p, file) => {
            if (S.uploadFail)
              return { error: { message: "Sin conexión de prueba" } };
            S.files[p] = file;
            return { data: { path: p } };
          },
          download: async (p) => ({ data: S.files[p] || new Blob(["test"]) }),
          createSignedUrl: async (p) => ({
            data: {
              signedUrl: URL.createObjectURL(S.files[p] || new Blob(["test"])),
            },
          }),
        };
      },
    },
  };
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("http://localhost:8765/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith("/assets/js/supabase-config.js"))
        return route.fulfill({
          contentType: "application/javascript",
          body: "(" + fixture.toString() + ")();",
        });
      let file = path.join(root, pathname);
      if (pathname.endsWith("/")) file = path.join(file, "index.html");
      if (!fs.existsSync(file))
        return route.fulfill({ status: 404, body: "Not found" });
      const ext = path.extname(file),
        types = {
          ".html": "text/html",
          ".js": "application/javascript",
          ".css": "text/css",
          ".png": "image/png",
        };
      return route.fulfill({
        contentType: types[ext] || "text/plain",
        body: fs.readFileSync(file),
      });
    });
    await page.goto("http://localhost:8765/tesoreria/");
    await page
      .locator("#period-status")
      .filter({ hasText: "Mes abierto" })
      .waitFor();
    // Use today's real Ecuador date; no clock-dependent fixture assumptions in the UI.
    await page.locator("#month").fill("2026-09");
    await page.locator("#month").dispatchEvent("change");
    for (const width of [320, 360, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "horizontal overflow " + width,
      );
      await page.screenshot({
        path: path.join(out, "overview-" + width + ".png"),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-new="expense"]').first().click();
    await page.locator("#attachment").setInputFiles({
      name: "comprobante.png",
      mimeType: "image/png",
      buffer: fs.readFileSync(
        path.join(root, "assets/img/logo-amigos-verdaderos.png"),
      ),
    });
    await page.evaluate(() => (window.__fixture.uploadFail = true));
    await page.locator("#save-draft").click();
    await page
      .locator("#entry-message")
      .filter({ hasText: "Sin conexión" })
      .waitFor();
    assert(await page.locator("#entry-dialog").isVisible());
    await page.evaluate(() => (window.__fixture.uploadFail = false));
    await page.locator("#save-draft").click();
    await page.locator("#entry-dialog").waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(() => window.__fixture.entries[0].status),
      "draft",
    );
    assert.equal(
      await page.evaluate(() => window.__fixture.entries[0].amount_cents),
      null,
    );
    assert((await page.locator("#balance").innerText()).includes("144"));
    await page.locator('.tabs [data-tab="drafts"]').click();
    await page.screenshot({
      path: path.join(out, "drafts-mobile.png"),
      fullPage: true,
    });
    await page.locator("#draft-list [data-entry]").click();
    await page.locator('[name="entry_date"]').fill("2026-09-15");
    await page.locator('[name="amount"]').fill("2,34");
    await page.locator('[name="description"]').fill("Compra de café de prueba");
    await page.screenshot({
      path: path.join(out, "form-mobile.png"),
      fullPage: true,
    });
    await page.locator("#post-entry").click();
    await page.locator("#entry-dialog").waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(() => window.__fixture.entries[0].status),
      "posted",
    );
    assert.equal(
      await page.evaluate(() => window.__fixture.entries[0].amount_cents),
      234,
    );
    await page.locator('.tabs [data-tab="movements"]').click();
    await page.locator("#movement-list [data-entry]").first().click();
    await page.locator("#correct-entry").click();
    await page.locator('[name="amount"]').fill("3,45");
    await page
      .locator('[name="correction_reason"]')
      .fill("Monto escrito incorrectamente");
    await page.locator("#post-entry").click();
    await page.locator("#entry-dialog").waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(() => window.__fixture.entries[0].amount_cents),
      345,
    );
    assert.equal(await page.evaluate(() => window.__fixture.entries.length), 1);
    await page.locator('.tabs [data-tab="overview"]').click();
    await page.locator('[data-new="income"]').first().click();
    await page.locator('[name="category"]').selectOption("rent_contribution");
    await page.locator("#member-search").fill("perez");
    await page
      .locator('#payment-options [role="option"]')
      .filter({ hasText: "Ana Pérez QA" })
      .click();
    assert.equal(
      await page.locator('[name="member_id"]').inputValue(),
      "source:source-1",
    );
    assert.equal(
      await page.locator("#member-search").inputValue(),
      "Ana Pérez QA",
    );
    page.once("dialog", (d) => d.accept());
    await page.locator('[data-close="entry-dialog"]').click();
    await page.locator('.tabs [data-tab="dues"]').click();
    await page.locator("#member-new").click();
    assert.equal(
      await page
        .locator('#member-form input[name="name"]')
        .getAttribute("type"),
      "hidden",
    );
    await page.locator("#source-member-search").fill("sin coincidencias");
    await page.locator("#source-options .picker-empty").waitFor();
    await page.locator("#source-member-search").fill("perez");
    await page.locator("#source-member-search").press("ArrowDown");
    await page.locator("#source-member-search").press("Enter");
    assert.equal(
      await page.locator('#member-form [name="name"]').inputValue(),
      "Ana Pérez QA",
    );
    assert.equal(
      await page
        .locator('#member-form [name="source_anniversary_id"]')
        .inputValue(),
      "source-1",
    );
    await page.screenshot({
      path: path.join(out, "member-mobile.png"),
      fullPage: true,
    });
    await page.locator('#member-form button[type="submit"]').click();
    await page.locator("#member-dialog").waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(
        () =>
          window.__fixture.members.filter(
            (m) => m.source_anniversary_id === "source-1",
          ).length,
      ),
      1,
    );
    await page.locator('[data-payment="member-1"]').click();
    await page.locator('[name="entry_date"]').fill("2026-09-15");
    await page.locator('[name="amount"]').fill("6");
    await page.locator("#post-entry").click();
    await page.locator("#entry-dialog").waitFor({ state: "hidden" });
    await page
      .locator(".due-card .badge")
      .filter({ hasText: "Parcial" })
      .waitFor();
    assert.equal(await page.evaluate(() => window.__fixture.entries.length), 2);
    await page.locator('.tabs [data-tab="reports"]').click();
    await page.locator("#include-dues").check();
    for (const view of ["movements", "dues", "reports"]) {
      await page.locator('.tabs [data-tab="' + view + '"]').click();
      await page.screenshot({
        path: path.join(out, view + "-mobile.png"),
        fullPage: true,
      });
    }
    await page.locator("#include-receipts").check();
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#download-pdf").click();
    const download = await downloadPromise;
    await download.saveAs(path.join(out, "report-qa.pdf"));
    assert(fs.statSync(path.join(out, "report-qa.pdf")).size > 3000);
    await page.locator('.tabs [data-tab="movements"]').click();
    await page.locator("#movement-list [data-entry]").last().click();
    page.once("dialog", (d) => d.accept("Registro de prueba duplicado"));
    await page.locator("#void-entry").click();
    await page.locator("#entry-dialog").waitFor({ state: "hidden" });
    assert(
      await page.evaluate(() =>
        window.__fixture.entries.some((e) => e.status === "void"),
      ),
    );
    await page.locator('.tabs [data-tab="guide"]').click();
    await page.evaluate(() => {
      document.querySelector("#print-area").innerHTML =
        document.querySelector("#guide-content").innerHTML;
    });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: path.join(out, "guide-qa.pdf"),
      format: "A4",
      printBackground: true,
    });
    await page.emulateMedia({ media: "screen" });
    for (const password of [
      "QA-password-first-2026",
      "QA-password-second-2026",
    ]) {
      await page.locator("#password-open").click();
      await page.locator('[name="new_password"]').fill(password);
      await page.locator('[name="confirm_password"]').fill(password);
      await page.locator('#password-form button[type="submit"]').click();
      await page.locator("#password-dialog").waitFor({ state: "hidden" });
    }
    await page.addInitScript(() => (window.__qaRole = "auditor"));
    await page.reload();
    await page.locator("#welcome").filter({ hasText: "Consulta" }).waitFor();
    assert(await page.locator("#quick-photo").isHidden());
    await page.locator('.tabs [data-tab="reports"]').click();
    assert(await page.locator("#close-form").isHidden());
    assert(await page.locator("#download-pdf").isVisible());
    await page.addInitScript(() => {
      window.__qaRole = "treasurer";
      window.__qaEmpty = true;
    });
    await page.reload();
    await page.locator("#setup").waitFor({ state: "visible" });
    assert(await page.locator("#edit-initial").isHidden());
    await page.screenshot({
      path: path.join(out, "first-start-mobile.png"),
      fullPage: true,
    });
    await page.locator('#setup-form [name="start_month"]').fill("2026-08");
    await page.locator('#setup-form [name="opening_general"]').fill("70");
    await page.locator('#setup-form [name="opening_rent"]').fill("30");
    await page
      .locator('#setup-form [name="note"]')
      .fill("Conteo inicial de ambos fondos");
    page.once("dialog", (d) => d.accept());
    await page.locator('#setup-form button[type="submit"]').click();
    await page.locator("#setup").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#month").inputValue(), "2026-08");
    assert.match(await page.locator("#balance").textContent(), /100/);
    assert(await page.locator("#edit-initial").isVisible());
    await page.locator("#edit-initial").click();
    await page.locator('#setup-form [name="opening_general"]').fill("80");
    await page
      .locator('#setup-form [name="reason"]')
      .fill("Corrección tras revisar el conteo");
    page.once("dialog", (d) => d.accept());
    await page.locator('#setup-form button[type="submit"]').click();
    await page.locator("#setup").waitFor({ state: "hidden" });
    assert.match(await page.locator("#balance").textContent(), /110/);
    await page.evaluate(() =>
      window.__fixture.entries.push({
        id: "month-test",
        entry_date: "2026-08-15",
        status: "posted",
        kind: "income",
        fund: "general",
        category: "seventh",
        amount_cents: 1000,
        description: "Séptima de agosto",
        version: 1,
      }),
    );
    await page.locator("#refresh").click();
    await page.locator("#income").filter({ hasText: "10,00" }).waitFor();
    await page.locator("#month").fill("2026-09");
    await page.locator("#month").dispatchEvent("change");
    await page
      .locator("#month-title")
      .filter({ hasText: "septiembre" })
      .waitFor();
    await page.locator("#income").filter({ hasText: "0,00" }).waitFor();
    assert.match(await page.locator("#opening").textContent(), /120/);
    await page.locator("#month").fill("2026-07");
    await page.locator("#month").dispatchEvent("change");
    await page
      .locator("#period-status")
      .filter({ hasText: "Anterior al inicio" })
      .waitFor();
    assert.equal(await page.locator("#month").inputValue(), "2026-07");
    assert.equal(await page.locator("#balance").textContent(), "—");
    assert(await page.locator("#download-pdf").isDisabled());
    await page.locator("#month").fill("2026-08");
    await page.locator("#month").dispatchEvent("change");
    await page.locator("#income").filter({ hasText: "10,00" }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: mobile 320/360/390 + desktop, photo draft, retry, cents, confirm, partial dues, annulment, PDF, read-only controls; no JS errors.",
    );
    await browser.close();
  } catch (e) {
    await browser.close();
    throw e;
  }
})();
