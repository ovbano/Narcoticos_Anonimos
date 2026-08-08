/**
 * Grupo Amigos Verdaderos - Supabase
 * Esta clave es PUBLICABLE y puede usarse en el navegador.
 * NUNCA coloques aquí la Secret key de Supabase.
 */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://llgssqkdwhfrdlrdsfnh.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_HsbdDT7xgTuPJdsIZ38LnQ_sMO0JOjf';

  if (!window.supabase?.createClient) {
    console.error('No se cargó @supabase/supabase-js.');
    return;
  }

  window.amigosSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  window.AMIGOS_SUPABASE_CONFIG = {
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY
  };
})();
