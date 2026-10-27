import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Lädt das angemeldete Team-Mitglied oder leitet zum Login um. */
export async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: staff } = await supabase
    .from('staff')
    .select('id, full_name, initials, role, active')
    .eq('id', user.id)
    .maybeSingle();
  if (!staff || !staff.active) redirect('/login?fehler=kein-team');
  return { supabase, user, staff };
}

/** Liest einen Wert aus der Tabelle settings (Regeln & Rechenwerte). */
export async function getSetting<T>(supabase: Awaited<ReturnType<typeof createClient>>, key: string, fallback: T): Promise<T> {
  const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  return (data?.value as T) ?? fallback;
}
