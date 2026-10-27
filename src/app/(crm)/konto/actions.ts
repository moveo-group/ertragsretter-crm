'use server';

import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';

export async function changePassword(fd: FormData) {
  const { supabase } = await requireStaff();
  const pw = String(fd.get('password') ?? '');
  if (pw !== String(fd.get('password2') ?? '')) redirect('/konto?fehler=ungleich');
  if (pw.length < 10) redirect('/konto?fehler=kurz');
  const { error } = await supabase.auth.updateUser({ password: pw });
  redirect(error ? '/konto?fehler=1' : '/konto?ok=1');
}
