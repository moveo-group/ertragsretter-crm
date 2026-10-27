'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { parseGermanNumber } from '@/lib/rules';

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').trim();
  return v === '' ? null : v;
};
const numOrNull = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v == null) return null;
  const n = parseGermanNumber(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (fd: FormData, k: string) => fd.get(k) === 'on';

export async function createCustomer(fd: FormData) {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name: str(fd, 'name'),
      kind: str(fd, 'kind') ?? 'privat',
      street: str(fd, 'street'),
      zip: str(fd, 'zip'),
      city: str(fd, 'city'),
      email: str(fd, 'email'),
      phone: str(fd, 'phone'),
      lead_source: str(fd, 'lead_source'),
    })
    .select('id')
    .single();
  if (error || !data) throw new Error('Kunde konnte nicht angelegt werden: ' + error?.message);
  await supabase.from('events').insert({ customer_id: data.id, kind: 'anfrage', title: 'Kunde angelegt', body: str(fd, 'lead_source') });
  redirect(`/kunden/${data.id}`);
}

export async function addContact(fd: FormData) {
  const { supabase } = await requireStaff();
  const customer_id = String(fd.get('customer_id'));
  await supabase.from('contacts').insert({
    customer_id,
    name: str(fd, 'name'),
    role: str(fd, 'role'),
    phone: str(fd, 'phone'),
    email: str(fd, 'email'),
    is_decision_maker: bool(fd, 'is_decision_maker'),
    is_invoice_recipient: bool(fd, 'is_invoice_recipient'),
    is_onsite_contact: bool(fd, 'is_onsite_contact'),
  });
  revalidatePath(`/kunden/${customer_id}`);
}

export async function addPlant(fd: FormData) {
  const { supabase } = await requireStaff();
  const customer_id = String(fd.get('customer_id'));
  const { data } = await supabase
    .from('plants')
    .insert({
      customer_id,
      name: str(fd, 'name') ?? 'Anlage',
      kwp: numOrNull(fd, 'kwp'),
      area_m2: numOrNull(fd, 'area_m2'),
      module_count: numOrNull(fd, 'module_count'),
      roof: str(fd, 'roof') ?? 'schraegdach',
      tilt_deg: numOrNull(fd, 'tilt_deg'),
      build_year: numOrNull(fd, 'build_year'),
      inverter: str(fd, 'inverter'),
      last_cleaned_on: str(fd, 'last_cleaned_on'),
      last_cleaning: str(fd, 'last_cleaning'),
      heavily_soiled: bool(fd, 'heavily_soiled'),
      freely_accessible: !bool(fd, 'not_accessible'),
    })
    .select('id')
    .single();
  if (data) await supabase.from('site_assessments').insert({ plant_id: data.id });
  revalidatePath(`/kunden/${customer_id}`);
}

export async function saveAssessment(fd: FormData) {
  const { supabase, staff } = await requireStaff();
  const customer_id = String(fd.get('customer_id'));
  const plant_id = String(fd.get('plant_id'));
  const row: Record<string, unknown> = { plant_id, assessed_by: staff.id, assessed_on: new Date().toISOString().slice(0, 10) };
  for (const k of ['lift', 'drone_hose', 'robot', 'water', 'access_road']) {
    row[k] = str(fd, k) ?? 'pruefen';
    row[`${k}_note`] = str(fd, `${k}_note`);
  }
  await supabase.from('site_assessments').upsert(row);
  revalidatePath(`/kunden/${customer_id}`);
}

export async function uploadPhotos(fd: FormData) {
  const { supabase, user } = await requireStaff();
  const customer_id = String(fd.get('customer_id'));
  const plant_id = str(fd, 'plant_id');
  const category = str(fd, 'category') ?? 'dach_anlage';
  const source = str(fd, 'source') ?? 'handy';
  const caption = str(fd, 'caption');
  const files = fd.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);

  for (const file of files) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${customer_id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('photos').upload(path, file, { contentType: file.type || 'image/jpeg' });
    if (error) throw new Error('Upload fehlgeschlagen: ' + error.message);
    await supabase.from('photos').insert({
      customer_id, plant_id, category, source, caption, storage_path: path,
      taken_on: new Date().toISOString().slice(0, 10), uploaded_by: user.id,
    });
  }
  revalidatePath(`/kunden/${customer_id}`);
}

export async function createOrder(fd: FormData) {
  const { supabase } = await requireStaff();
  const customer_id = String(fd.get('customer_id'));
  const plant_id = str(fd, 'plant_id');
  let area_m2: number | null = null;
  if (plant_id) {
    const { data } = await supabase.from('plants').select('area_m2').eq('id', plant_id).single();
    area_m2 = data?.area_m2 ?? null;
  }
  await supabase.from('orders').insert({
    customer_id,
    plant_id,
    service_id: str(fd, 'service_id') ?? 'reinigung',
    with_thermography: bool(fd, 'with_thermography'),
    source: str(fd, 'source') ?? 'telefon',
    wish_date: str(fd, 'wish_date'),
    wish_slot: str(fd, 'wish_slot'),
    customer_note: str(fd, 'customer_note'),
    area_m2,
  });
  revalidatePath(`/kunden/${customer_id}`);
  revalidatePath('/');
}

export async function addDocument(fd: FormData) {
  const { supabase } = await requireStaff();
  const customer_id = String(fd.get('customer_id'));
  await supabase.from('documents').insert({
    customer_id,
    type: str(fd, 'type') ?? 'rechnung',
    number: str(fd, 'number'),
    description: str(fd, 'description'),
    issued_on: str(fd, 'issued_on'),
    due_on: str(fd, 'due_on'),
    net_amount: numOrNull(fd, 'net_amount'),
    status: str(fd, 'status') ?? 'entwurf',
    sent_on: str(fd, 'sent_on'),
    paid_on: str(fd, 'paid_on'),
  });
  revalidatePath(`/kunden/${customer_id}`);
}

export async function setDocumentStatus(fd: FormData) {
  const { supabase } = await requireStaff();
  const customer_id = String(fd.get('customer_id'));
  const status = String(fd.get('status'));
  const today = new Date().toISOString().slice(0, 10);
  const patch: Record<string, unknown> = { status };
  if (status === 'versendet') patch.sent_on = today;
  if (status === 'bezahlt') patch.paid_on = today;
  if (status === 'ueberfaellig') patch.reminder_on = today;
  await supabase.from('documents').update(patch).eq('id', String(fd.get('document_id')));
  revalidatePath(`/kunden/${customer_id}`);
}

export async function addNote(fd: FormData) {
  const { supabase } = await requireStaff();
  const customer_id = String(fd.get('customer_id'));
  const title = str(fd, 'title');
  if (!title) return;
  await supabase.from('events').insert({ customer_id, kind: 'notiz', title, body: str(fd, 'body') });
  revalidatePath(`/kunden/${customer_id}`);
}
