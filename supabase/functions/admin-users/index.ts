import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { makeHandler } from "./handler.mjs";
const env = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_PUBLISHABLE_KEY:
    Deno.env.get("SUPABASE_ANON_KEY") ||
    JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default,
  SUPABASE_SECRET_KEY:
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default,
};
// Authentication is enforced in handler with Auth.getUser(jwt), followed by a live admin/active profile check.
// This supports both current asymmetric and legacy user JWTs.
const handler = makeHandler(createClient, env);
Deno.serve(async (req: Request) => {
  let status = 200;
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  let response: Response | undefined;
  const res = {
    setHeader(k: string, v: string) {
      headers.set(k, v);
    },
    status(code: number) {
      status = code;
      return this;
    },
    json(body: unknown) {
      response = new Response(JSON.stringify(body), { status, headers });
      return response;
    },
  };
  let body;
  try {
    if (req.method === "POST") body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, message: "Solicitud inválida." }),
      { status: 400, headers },
    );
  }
  await handler(
    {
      method: req.method,
      headers: {
        authorization: req.headers.get("authorization"),
        host: "narcoticos-anonimos-azure.vercel.app",
        "x-forwarded-proto": "https",
      },
      body,
    },
    res,
  );
  return response || new Response(null, { status: 500 });
});
