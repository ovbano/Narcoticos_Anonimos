import { createClient } from "@supabase/supabase-js";

const ROLES = ["admin", "editor", "treasurer", "auditor"];
export function makeHandler(clientFactory = createClient) {
  // Vercel's /api/*.mjs uses the Node request/response contract.
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    const send = (status, body) => res.status(status).json(body);
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), 18000);
    try {
      if (!["GET", "POST"].includes(req.method)) {
        res.setHeader("Allow", "GET, POST");
        return send(405, { ok: false, message: "Método no permitido." });
      }
      const token = String(req.headers?.authorization || "").replace(
        /^Bearer\s+/i,
        "",
      );
      if (!token)
        return send(401, {
          ok: false,
          message: "Inicia sesión para administrar usuarios.",
        });
      const url = process.env.SUPABASE_URL,
        key = process.env.SUPABASE_PUBLISHABLE_KEY,
        secret = process.env.SUPABASE_SECRET_KEY;
      if (!url || !key)
        return send(503, {
          ok: false,
          message: "El acceso de usuarios no está configurado en el servidor.",
        });
      const opts = {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: { Authorization: `Bearer ${token}` },
          fetch: (url, init = {}) =>
            fetch(url, { ...init, signal: deadline.signal }),
        },
      };
      const client = clientFactory(url, key, opts);
      const { data: auth, error: authError } = await client.auth.getUser(token);
      if (authError || !auth?.user)
        return send(401, {
          ok: false,
          message: "La sesión venció. Vuelve a iniciar sesión.",
        });
      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("id,role,active")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.active || profile.role !== "admin")
        return send(403, {
          ok: false,
          message: "Solo el administrador puede gestionar usuarios.",
        });
      if (req.method === "GET") {
        const { data, error } = await client.rpc("admin_list_users");
        if (error) throw error;
        return send(200, { ok: true, users: data });
      }
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          return send(400, { ok: false, message: "Solicitud inválida." });
        }
      }
      body = body || {};
      if (body.action === "update") {
        const { error } = await client.rpc("admin_set_user_access", {
          p_user_id: body.userId,
          p_role: body.role ?? null,
          p_active: body.active ?? null,
        });
        if (error) throw error;
        return send(200, { ok: true, message: "Acceso actualizado." });
      }
      if (!["create", "invite"].includes(body.action))
        return send(400, { ok: false, message: "Acción desconocida." });
      const email = String(body.email || "")
          .trim()
          .toLowerCase(),
        name = String(body.displayName || "").trim(),
        role = String(body.role || "treasurer");
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 ||
        name.length < 2 ||
        name.length > 100 ||
        !ROLES.includes(role)
      )
        return send(422, {
          ok: false,
          message: "Revisa el nombre, correo y nivel de acceso.",
        });
      if (
        body.action === "create" &&
        (typeof body.password !== "string" ||
          body.password.length < 12 ||
          body.password.length > 128)
      )
        return send(422, {
          ok: false,
          message:
            "La contraseña inicial debe tener entre 12 y 128 caracteres.",
        });
      if (!secret)
        return send(503, {
          ok: false,
          message:
            "Falta configurar SUPABASE_SECRET_KEY en Vercel para crear cuentas. Puedes consultar y gestionar las cuentas existentes.",
        });
      const service = clientFactory(url, secret, {
        auth: opts.auth,
        global: { fetch: opts.global.fetch },
      });
      let created;
      if (body.action === "create")
        created = await service.auth.admin.createUser({
          email,
          password: body.password,
          email_confirm: true,
          user_metadata: { display_name: name },
        });
      else {
        // Use the authenticated request's own origin. Never accept arbitrary email redirects.
        const host = String(req.headers.host || "");
        const origin =
          String(req.headers["x-forwarded-proto"] || "https") === "https"
            ? "https://"
            : "http://";
        created = await service.auth.admin.inviteUserByEmail(email, {
          data: { display_name: name },
          redirectTo: origin + host + "/admin/",
        });
      }
      if (created.error) throw created.error;
      const id = created.data?.user?.id;
      if (!id) throw Error("No se recibió el identificador de la cuenta.");
      const { error } = await client.rpc("admin_enroll_user", {
        p_user_id: id,
        p_name: name,
        p_role: role,
      });
      if (error) {
        // Keep incomplete provisioning inactive, rather than granting access without a profile/audit.
        await service
          .from("profiles")
          .upsert({ id, display_name: name, role, active: false });
        return send(409, {
          ok: false,
          message:
            "La cuenta se creó, pero quedó inactiva porque no se completó su autorización. Actualiza la lista y actívala después de revisar sus datos.",
        });
      }
      return send(200, {
        ok: true,
        message:
          body.action === "create"
            ? "Usuario creado. Entrega el correo y la contraseña inicial de forma privada."
            : "Invitación enviada.",
      });
    } catch (error) {
      const timeout = deadline.signal.aborted;
      return send(timeout ? 504 : 400, {
        ok: false,
        message: timeout
          ? "El servidor tardó demasiado. Actualiza la lista antes de repetir una creación."
          : String(
              error?.message || "No se pudo completar la operación.",
            ).slice(0, 400),
      });
    } finally {
      clearTimeout(timer);
    }
  };
}
export default makeHandler();
