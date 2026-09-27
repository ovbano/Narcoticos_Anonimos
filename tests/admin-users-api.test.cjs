const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const source = fs
  .readFileSync(
    require("node:path").join(
      __dirname,
      "../supabase/functions/admin-users/handler.mjs",
    ),
    "utf8",
  )
  .replace(
    /import\s*\{\s*createClient\s*\}\s*from\s*["']@supabase\/supabase-js["'];/,
    "const createClient=()=>{throw Error('Use injected client');};",
  );
const modulePromise = import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
function response() {
  return {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(n) {
      this.code = n;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
function factory(role = "admin", active = true) {
  const calls = [];
  const fake = {
    auth: {
      getUser: async () => ({ data: { user: { id: "admin" } } }),
      admin: {
        createUser: async (data) => {
          calls.push(["create", data]);
          return { data: { user: { id: "new-user" } } };
        },
      },
    },
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({ data: { id: "admin", role, active } }),
        upsert: async () => ({}),
      };
    },
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: name === "admin_list_users" ? [] : null };
    },
  };
  return { client: () => fake, calls };
}
test("Node handler answers unauthenticated request without hanging", async () => {
  const { makeHandler } = await modulePromise,
    res = response();
  await makeHandler()({ method: "GET", headers: {} }, res);
  assert.equal(res.code, 401);
  assert.equal(res.headers["Cache-Control"], "no-store");
});
test("GET uses authorized list and returns a Node JSON response", async () => {
  process.env.SUPABASE_URL = "https://example.invalid";
  process.env.SUPABASE_PUBLISHABLE_KEY = "test";
  const f = factory(),
    res = response();
  await (await modulePromise).makeHandler(f.client, process.env)(
    { method: "GET", headers: { authorization: "Bearer test" } },
    res,
  );
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.users, []);
  assert.equal(f.calls[0][0], "admin_list_users");
});
test("treasurer and inactive admin cannot provision accounts", async () => {
  for (const [role, active] of [
    ["treasurer", true],
    ["admin", false],
  ]) {
    const f = factory(role, active),
      res = response();
    await (await modulePromise).makeHandler(f.client, process.env)(
      {
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: { action: "create" },
      },
      res,
    );
    assert.equal(res.code, 403);
    assert.equal(f.calls.length, 0);
  }
});
test("create delivers password only to Auth, not response/audit", async () => {
  process.env.SUPABASE_SECRET_KEY = "test-secret";
  const f = factory(),
    res = response();
  const body = {
    action: "create",
    email: "server@example.invalid",
    displayName: "Servidor QA",
    role: "treasurer",
    password: "Long-QA-Password-123",
  };
  await (await modulePromise).makeHandler(f.client, process.env)(
    { method: "POST", headers: { authorization: "Bearer test" }, body },
    res,
  );
  assert.equal(res.code, 200);
  assert.equal(f.calls[0][1].password, body.password);
  assert.equal(f.calls[1][0], "admin_enroll_user");
  assert(!JSON.stringify(f.calls[1]).includes(body.password));
  assert(!JSON.stringify(res.body).includes(body.password));
});
test("invalid request and missing provisioning secret respond with clear error", async () => {
  delete process.env.SUPABASE_SECRET_KEY;
  const f = factory(),
    res = response();
  await (await modulePromise).makeHandler(f.client, process.env)(
    {
      method: "POST",
      headers: { authorization: "Bearer test" },
      body: {
        action: "create",
        email: "server@example.invalid",
        displayName: "Servidor QA",
        role: "treasurer",
        password: "Long-QA-Password-123",
      },
    },
    res,
  );
  assert.equal(res.code, 503);
});
