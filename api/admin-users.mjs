import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }
});

const clients = () => {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SECRET_KEY) {
    throw new Error('Faltan variables de entorno de Supabase en Vercel.');
  }

  const publicClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  return { publicClient, serviceClient };
};

const requireAdmin = async (request, publicClient, serviceClient) => {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) throw Object.assign(new Error('No autorizado.'), { status: 401 });

  const { data: userData, error: userError } = await publicClient.auth.getUser(token);
  if (userError || !userData?.user) {
    throw Object.assign(new Error('La sesión no es válida.'), { status: 401 });
  }

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id,display_name,role,active')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || !profile.active || profile.role !== 'admin') {
    throw Object.assign(new Error('Se requiere un usuario administrador.'), { status: 403 });
  }

  return { user: userData.user, profile };
};

const listUsers = async (serviceClient) => {
  const { data: authData, error: authError } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (authError) throw authError;

  const { data: profiles, error: profilesError } = await serviceClient
    .from('profiles')
    .select('id,display_name,role,active,created_at,updated_at');
  if (profilesError) throw profilesError;

  const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));

  return (authData?.users || []).map(user => ({
    id: user.id,
    email: user.email,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at,
    profile: profileMap.get(user.id) || null
  }));
};

export default async function handler(request) {
  try {
    const { publicClient, serviceClient } = clients();
    const requester = await requireAdmin(request, publicClient, serviceClient);

    if (request.method === 'GET') {
      return json({ ok: true, users: await listUsers(serviceClient) });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, message: 'Método no permitido.' }, 405);
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '');

    if (action === 'invite') {
      const email = String(body.email || '').trim().toLowerCase();
      const displayName = String(body.displayName || '').trim();
      const role = body.role === 'admin' ? 'admin' : 'editor';
      const redirectTo = String(body.redirectTo || '').trim();

      if (!email || !displayName) {
        return json({ ok: false, message: 'Nombre y correo son obligatorios.' }, 422);
      }

      const options = {
        data: { display_name: displayName },
        ...(redirectTo ? { redirectTo } : {})
      };

      const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, options);
      if (inviteError) throw inviteError;

      const invitedUser = inviteData?.user;
      if (!invitedUser?.id) throw new Error('Supabase no devolvió el identificador del usuario invitado.');

      const { error: profileError } = await serviceClient.from('profiles').upsert({
        id: invitedUser.id,
        display_name: displayName,
        role,
        active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (profileError) throw profileError;

      return json({ ok: true, message: `Invitación enviada a ${email}.`, users: await listUsers(serviceClient) });
    }

    if (action === 'update') {
      const userId = String(body.userId || '').trim();
      if (!userId) return json({ ok: false, message: 'Falta el usuario.' }, 422);
      if (userId === requester.user.id && (body.active === false || (body.role && body.role !== 'admin'))) {
        return json({ ok: false, message: 'No puedes quitarte a ti mismo el acceso de administrador.' }, 422);
      }

      const changes = { updated_at: new Date().toISOString() };
      if (body.role !== undefined) changes.role = body.role === 'admin' ? 'admin' : 'editor';
      if (body.active !== undefined) changes.active = Boolean(body.active);
      if (body.displayName !== undefined && String(body.displayName).trim()) changes.display_name = String(body.displayName).trim();

      const { error } = await serviceClient.from('profiles').update(changes).eq('id', userId);
      if (error) throw error;

      return json({ ok: true, message: 'Acceso actualizado.', users: await listUsers(serviceClient) });
    }

    return json({ ok: false, message: 'Acción desconocida.' }, 400);
  } catch (error) {
    console.error(error);
    return json({ ok: false, message: error?.message || 'Error interno.' }, Number(error?.status) || 500);
  }
}
