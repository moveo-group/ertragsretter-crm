'use server';

import { revalidatePath } from 'next/cache';
import { PERMISSIONS, requirePerm } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type CreateStaffState = { ok?: boolean; error?: string; email?: string; password?: string };

function tempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function permsFrom(fd: FormData) {
  return Object.fromEntries(PERMISSIONS.map((p) => [p.column, fd.get(p.column) === 'on']));
}

/** Neuen Mitarbeiter mit Startpasswort anlegen. */
export async function createStaff(_prev: CreateStaffState, fd: FormData): Promise<CreateStaffState> {
  await requirePerm('team');
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const full_name = String(fd.get('full_name') ?? '').trim();
  if (!email || !full_name) return { error: 'Name und E-Mail sind Pflicht.' };

  const initials = full_name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const password = tempPassword();

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
  if (error || !data.user) return { error: error?.message.includes('already') ? 'Diese E-Mail ist schon registriert.' : `Konto konnte nicht angelegt werden: ${error?.message}` };

  // Der Eintrag in staff läuft über die normale Sitzung → Datenbank prüft das Recht „Mitarbeiter verwalten“ selbst
  const supabase = await createClient();
  const { error: staffError } = await supabase.from('staff').insert({
    id: data.user.id,
    full_name,
    initials,
    email,
    role: String(fd.get('role') ?? 'field'),
    can_work_alone: fd.get('can_work_alone') === 'on',
    is_drone_pilot: fd.get('is_drone_pilot') === 'on',
    ...permsFrom(fd),
  });
  if (staffError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: `Rechte konnten nicht gespeichert werden: ${staffError.message}` };
  }
  revalidatePath('/team');
  return { ok: true, email, password };
}

/** Rechte, Fähigkeiten und Aktiv-Status eines Mitarbeiters speichern. */
export async function updateStaff(fd: FormData) {
  const { supabase } = await requirePerm('team');
  const id = String(fd.get('id'));
  const { error } = await supabase.from('staff').update({
    role: String(fd.get('role') ?? 'field'),
    active: fd.get('active') === 'on',
    can_work_alone: fd.get('can_work_alone') === 'on',
    is_drone_pilot: fd.get('is_drone_pilot') === 'on',
    ...permsFrom(fd),
  }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/team');
}
