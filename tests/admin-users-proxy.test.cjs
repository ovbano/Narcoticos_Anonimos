const { test } = require("node:test"),
  assert = require("node:assert/strict");
const modulePromise = import("../api/admin-users.mjs");
const response = () => ({
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  status(v) {
    this.code = v;
    return this;
  },
  json(v) {
    this.body = v;
    return this;
  },
});
test("relay works without Vercel Supabase environment variables and passes caller authorization", async () => {
  const { makeProxy } = await modulePromise;
  const res = response();
  let seen;
  await makeProxy(async (url, options) => {
    seen = { url, options };
    return { status: 200, json: async () => ({ ok: true }) };
  })(
    {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: {
        action: "create",
        email: "qa@example.invalid",
        password: "qa-test-password",
      },
    },
    res,
  );
  assert.equal(res.code, 200);
  assert.equal(seen.options.headers.Authorization, "Bearer user-token");
  assert.equal(seen.options.headers.apikey, undefined);
  assert.equal(JSON.parse(seen.options.body).action, "create");
  assert.equal(res.headers["Cache-Control"], "no-store");
});
test("relay preserves authorization failure and handles unavailable service", async () => {
  const { makeProxy } = await modulePromise;
  let res = response();
  await makeProxy(() => {
    throw Error("must not run");
  })({ method: "POST", headers: {} }, res);
  assert.equal(res.code, 401);
  res = response();
  await makeProxy(async () => ({
    status: 403,
    json: async () => ({ ok: false, message: "Sin permiso" }),
  }))(
    { method: "POST", headers: { authorization: "Bearer t" }, body: {} },
    res,
  );
  assert.equal(res.code, 403);
  res = response();
  await makeProxy(async () => {
    throw Error("offline");
  })({ method: "POST", headers: { authorization: "Bearer t" }, body: {} }, res);
  assert.equal(res.code, 502);
  assert.match(res.body.message, /Actualiza/);
});
