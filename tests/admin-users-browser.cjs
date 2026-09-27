const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");
function fixture() {
  const admin = {
      id: "admin",
      email: "admin@example.invalid",
      profile: {
        id: "admin",
        display_name: "Administrador QA",
        role: "admin",
        active: true,
      },
    },
    server = {
      id: "server",
      email: "server@example.invalid",
      profile: {
        id: "server",
        display_name: "Tesorero QA",
        role: "treasurer",
        active: true,
      },
    };
  const S = (window.__adminFixture = { users: [admin, server], fail: true });
  window.amigosSupabase = {
    auth: {
      getUser: async () => ({ data: { user: admin } }),
      getSession: async () => ({ data: { session: { access_token: "qa" } } }),
      onAuthStateChange() {},
      updateUser: async () => ({ data: {} }),
    },
    from(table) {
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        maybeSingle: async () => ({ data: admin.profile }),
        then(resolve) {
          resolve({ data: [] });
        },
      };
      return q;
    },
    rpc(name, args) {
      const call = {
        abortSignal() {
          return call;
        },
        then(resolve) {
          if (name === "admin_list_users")
            return resolve(
              S.fail
                ? { error: { message: "Sin conexión de prueba" } }
                : { data: structuredClone(S.users) },
            );
          if (name === "admin_set_user_access") {
            const u = S.users.find((x) => x.id === args.p_user_id);
            if (args.p_active !== null) u.profile.active = args.p_active;
            if (args.p_role !== null) u.profile.role = args.p_role;
            return resolve({ data: null });
          }
          return resolve({ data: null });
        },
      };
      return call;
    },
  };
}
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("http://localhost:8765/**", async (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p.endsWith("/supabase-config.js"))
        return route.fulfill({
          contentType: "application/javascript",
          body: "(" + fixture.toString() + ")();",
        });
      if (p === "/api/admin-users") {
        const body = route.request().postDataJSON();
        assert.equal(body.action, "create");
        assert(body.password.length >= 12);
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ ok: true, message: "Usuario QA creado" }),
        });
      }
      const file = path.join(root, p.endsWith("/") ? p + "index.html" : p);
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({
        contentType:
          {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".png": "image/png",
          }[path.extname(file)] || "text/plain",
        body: fs.readFileSync(file),
      });
    });
    await page.goto("http://localhost:8765/admin/");
    await page.locator('[data-tab="users"]').click();
    await page.locator("#retry-users").waitFor();
    assert(
      (await page.locator("#users-count").innerText()).includes("No se pudo"),
    );
    await page.evaluate(() => (window.__adminFixture.fail = false));
    await page.locator("#retry-users").click();
    await page.locator(".user-row").nth(1).waitFor();
    assert.equal(await page.locator(".user-row").count(), 2);
    page.once("dialog", (d) => d.accept());
    await page.locator('.user-toggle[data-user-id="server"]').click();
    await page
      .locator(".user-row")
      .filter({ hasText: "Tesorero QA" })
      .locator(".inactive")
      .first()
      .waitFor();
    assert.equal(
      await page.evaluate(() => window.__adminFixture.users[1].profile.active),
      false,
    );
    page.once("dialog", (d) => d.accept());
    await page.locator('.user-toggle[data-user-id="server"]').click();
    await page
      .locator('.user-toggle[data-user-id="server"]')
      .filter({ hasText: "Dar de baja" })
      .waitFor();
    assert.equal(
      await page.evaluate(() => window.__adminFixture.users[1].profile.active),
      true,
    );
    await page.screenshot({
      path: path.resolve(root, "../tmp/treasury-v2/admin-mobile.png"),
      fullPage: true,
    });
    await page.locator("#btn-show-invite").click();
    await page.locator("#invite-name").fill("Nuevo QA");
    await page.locator("#invite-email").fill("qa-new@example.invalid");
    await page.locator("#invite-role").selectOption("treasurer");
    await page.locator("#generate-password").click();
    await page.locator('#invite-form button[type="submit"]').click();
    await page.locator("#credential-result").waitFor();
    assert(
      (await page.locator("#credential-password").innerText()).length >= 12,
    );
    await page.locator("#hide-credentials").click();
    assert.equal(await page.locator("#credential-password").innerText(), "");
    assert.deepEqual(errors, []);
    console.log(
      "PASS admin mobile: error terminates loading, retry, active/inactive, reactivation, credential creation and clearing.",
    );
  } finally {
    await browser.close();
  }
})();
