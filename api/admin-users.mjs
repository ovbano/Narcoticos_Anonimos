// The privileged operation lives in Supabase, where project secrets are managed server-side.
// This same-origin relay forwards the caller's JWT, never a service credential.
export function makeProxy(request = fetch) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (!["GET", "POST"].includes(req.method))
      return res
        .status(405)
        .json({ ok: false, message: "Método no permitido." });
    if (!req.headers?.authorization)
      return res
        .status(401)
        .json({
          ok: false,
          message: "Inicia sesión para administrar usuarios.",
        });
    try {
      const upstream = await request(
        "https://llgssqkdwhfrdlrdsfnh.supabase.co/functions/v1/admin-users",
        {
          method: req.method,
          headers: {
            Authorization: req.headers.authorization,
            "Content-Type": "application/json",
          },
          ...(req.method === "POST"
            ? {
                body:
                  typeof req.body === "string"
                    ? req.body
                    : JSON.stringify(req.body),
              }
            : {}),
          signal: AbortSignal.timeout(22000),
        },
      );
      const body = await upstream.json();
      return res.status(upstream.status).json(body);
    } catch {
      return res
        .status(502)
        .json({
          ok: false,
          message:
            "No se pudo conectar con el servicio de cuentas. Actualiza la lista antes de repetir una creación.",
        });
    }
  };
}
export default makeProxy();
