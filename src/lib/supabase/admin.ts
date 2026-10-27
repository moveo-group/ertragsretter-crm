import { createClient } from '@supabase/supabase-js';

/**
 * Supabase-Client mit Admin-Schlüssel – NUR auf dem Server verwenden (Server Actions).
 * Wird ausschließlich zum Anlegen von Mitarbeiter-Konten genutzt, nachdem geprüft wurde,
 * dass der angemeldete Nutzer das Recht „Mitarbeiter verwalten“ hat.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt (Vercel → Environment Variables).');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
