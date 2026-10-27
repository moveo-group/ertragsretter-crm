import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Perm = 'customers' | 'dispatch' | 'finance' | 'team' | 'settings';

export const PERMISSIONS: { key: Perm; column: string; label: string; hint: string }[] = [
  { key: 'customers', column: 'perm_customers', label: 'Kundendaten', hint: 'Kunden, Ansprechpartner, Anlagen, Fotos, Zugang, Aufträge sehen und bearbeiten' },
  { key: 'dispatch', column: 'perm_dispatch', label: 'Disposition', hint: 'Termine und Einsätze planen; sieht dafür Kunden und Aufträge' },
  { key: 'finance', column: 'perm_finance', label: 'Finanzen', hint: 'Angebote, Rechnungen, Zahlungseingänge, offene Forderungen, Umsätze' },
  { key: 'team', column: 'perm_team', label: 'Mitarbeiter verwalten', hint: 'Mitarbeiter anlegen, deaktivieren und Rechte vergeben' },
  { key: 'settings', column: 'perm_settings', label: 'Preise & Regeln', hint: 'Leistungen, Preise und Planungsregeln ändern' },
];

export const PRESETS: Record<string, { label: string; perms: Perm[] }> = {
  inhaber: { label: 'Inhaber', perms: ['customers', 'dispatch', 'finance', 'team', 'settings'] },
  buero: { label: 'Büro', perms: ['customers', 'dispatch', 'finance'] },
  aussendienst: { label: 'Außendienst', perms: ['customers', 'dispatch'] },
};

export type StaffMember = {
  id: string; full_name: string; initials: string; role: string; active: boolean;
  perm_customers: boolean; perm_dispatch: boolean; perm_finance: boolean; perm_team: boolean; perm_settings: boolean;
};

export function can(staff: StaffMember, perm: Perm): boolean {
  return Boolean(staff[`perm_${perm}` as keyof StaffMember]);
}

/** Lädt das angemeldete Team-Mitglied oder leitet zum Login um. */
export async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data } = await supabase
    .from('staff')
    .select('id, full_name, initials, role, active, perm_customers, perm_dispatch, perm_finance, perm_team, perm_settings')
    .eq('id', user.id)
    .maybeSingle();
  const staff = data as StaffMember | null;
  if (!staff || !staff.active) redirect('/login?fehler=kein-team');
  return { supabase, user, staff };
}

/** Wie requireStaff, verlangt aber zusätzlich ein Recht (sonst zurück zur Übersicht). */
export async function requirePerm(perm: Perm) {
  const ctx = await requireStaff();
  if (!can(ctx.staff, perm)) redirect('/?fehler=keine-berechtigung');
  return ctx;
}

/** Liest einen Wert aus der Tabelle settings (Regeln & Rechenwerte). */
export async function getSetting<T>(supabase: Awaited<ReturnType<typeof createClient>>, key: string, fallback: T): Promise<T> {
  const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  return (data?.value as T) ?? fallback;
}
