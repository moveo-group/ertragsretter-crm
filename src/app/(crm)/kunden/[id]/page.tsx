import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { Badge } from '@/components/Badge';
import {
  ASSESSMENT_ITEMS, CLEANING, CUSTOMER_KIND, DOCUMENT_STATUS, ORDER_STATUS, PHOTO_CATEGORY, PHOTO_SOURCE,
  ROOF, SLOT, SOURCE, date, dateShort, money, num,
} from '@/lib/labels';
import { bucketFromDate, estimateYearlyLoss, showsLossWarning, type CleaningBucket } from '@/lib/rules';
import {
  addContact, addDocument, addNote, addPlant, createOrder, saveAssessment, setDocumentStatus, uploadPhotos,
} from '../actions';

type Plant = {
  id: string; name: string; kwp: number | null; area_m2: number | null; module_count: number | null; roof: string;
  tilt_deg: number | null; build_year: number | null; inverter: string | null; freely_accessible: boolean;
  last_cleaned_on: string | null; last_cleaning: CleaningBucket | null; heavily_soiled: boolean; notes: string | null;
  site_assessments: Record<string, string | null> | null;
};

export default async function Kundenakte({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fotos?: string }>;
}) {
  const { supabase } = await requireStaff();
  const { id } = await params;
  const { fotos: photoFilter } = await searchParams;

  const { data: customer } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (!customer) notFound();

  const [contactsRes, plantsRes, photosRes, docsRes, ordersRes, eventsRes, servicesRes] = await Promise.all([
    supabase.from('contacts').select('*').eq('customer_id', id).order('created_at'),
    supabase.from('plants').select('*, site_assessments(*)').eq('customer_id', id).order('created_at'),
    supabase.from('photos').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
    supabase.from('documents').select('*').eq('customer_id', id).order('issued_on', { ascending: false, nullsFirst: true }),
    supabase.from('orders').select('id, order_no, status, source, wish_date, wish_slot, estimated_price, services(name), appointments(starts_at)').eq('customer_id', id).order('created_at', { ascending: false }),
    supabase.from('events').select('*').eq('customer_id', id).order('occurred_at', { ascending: false }).limit(100),
    supabase.from('services').select('id, name').eq('active', true).order('sort'),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Row = Record<string, any>;
  const contacts = (contactsRes.data ?? []) as Row[];
  const plants = (plantsRes.data ?? []) as unknown as Plant[];
  const allPhotos = (photosRes.data ?? []) as Row[];
  const docs = (docsRes.data ?? []) as Row[];
  const orders = (ordersRes.data ?? []) as unknown as {
    id: string; order_no: string; status: string; source: string; wish_date: string | null; wish_slot: string | null;
    estimated_price: number | null; services: { name: string } | null; appointments: { starts_at: string }[];
  }[];
  const events = (eventsRes.data ?? []) as Row[];
  const services = (servicesRes.data ?? []) as Row[];

  // Fotos: signierte Links (1 Stunde gültig)
  const photos = photoFilter ? allPhotos.filter((p) => p.category === photoFilter) : allPhotos;
  const signed = photos.length
    ? ((await supabase.storage.from('photos').createSignedUrls(photos.map((p) => p.storage_path), 3600)).data ?? []) as { path: string | null; signedUrl: string }[]
    : [];
  const urlFor = (path: string) => signed.find((s) => s.path === path)?.signedUrl ?? null;

  // Kennzahlen
  const invoices = docs.filter((d) => d.type === 'rechnung');
  const revenue = invoices.filter((d) => d.status !== 'storniert').reduce((s, d) => s + Number(d.net_amount ?? 0), 0);
  const open = invoices.filter((d) => d.status === 'versendet' || d.status === 'ueberfaellig');
  const lastCleaned = plants.map((p) => p.last_cleaned_on).filter(Boolean).sort().pop() ?? null;
  const nextAppt = orders.flatMap((o) => o.appointments.map((a) => ({ at: a.starts_at, o })))
    .filter((x) => new Date(x.at) > new Date()).sort((a, b) => a.at.localeCompare(b.at))[0];
  const openOrder = orders.find((o) => ['neu', 'angenommen', 'eingeplant'].includes(o.status));

  const initials = customer.name.split(/\s+/).filter((w: string) => /^[A-ZÄÖÜ]/.test(w)).slice(0, 2).map((w: string) => w[0]).join('');

  return (
    <>
      <header className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Link href="/kunden" className="btn btn-sm" aria-label="Zurück zur Kundenliste">←</Link>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>{initials || '?'}</div>
          <div>
            <h1>{customer.name}</h1>
            <span className="sub">
              {customer.customer_no} · {CUSTOMER_KIND[customer.kind]} · Kunde seit {new Date(customer.created_at).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
              {customer.city ? ` · ${customer.zip ?? ''} ${customer.city}` : ''}
            </span>
          </div>
        </div>
        <a href="#neuer-auftrag" className="btn btn-primary">+ Neuer Auftrag</a>
      </header>

      <section className="kpis" aria-label="Kennzahlen">
        <div className="kpi"><span className="label">Umsatz gesamt (netto)</span><span className="value">{money(revenue)}</span><span className="hint">{invoices.length} Rechnungen</span></div>
        <div className="kpi" style={open.length ? { background: 'var(--amber-bg)', borderColor: '#F2D27A' } : undefined}>
          <span className="label">Offene Posten</span>
          <span className="value">{open.length ? money(open.reduce((s, d) => s + Number(d.net_amount ?? 0), 0)) : 'keine'}</span>
          <span className="hint">{open.map((d) => `${d.number ?? 'ohne Nr.'} fällig ${date(d.due_on)}`).join(' · ') || 'alles bezahlt'}</span>
        </div>
        <div className="kpi"><span className="label">Letzte Reinigung</span><span className="value">{date(lastCleaned)}</span><span className="hint">{plants.length} {plants.length === 1 ? 'Anlage' : 'Anlagen'}</span></div>
        <div className="kpi dark">
          <span className="label">Nächster Termin</span>
          <span className="value">{nextAppt ? dateShort(nextAppt.at) : openOrder ? 'offen' : '–'}</span>
          <span className="hint">{nextAppt ? `${nextAppt.o.services?.name} · ${nextAppt.o.order_no}` : openOrder ? `${openOrder.order_no} noch nicht eingeplant` : 'kein Auftrag offen'}</span>
        </div>
      </section>

      <div className="cols">
        <div className="col-main">
          {/* Fotos */}
          <section className="card card-pad" aria-labelledby="photos-h" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="photos-h">Fotos: Dach, Anlage &amp; Umgebung</h2>
              <nav aria-label="Fotofilter" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <Link href={`/kunden/${id}`} className={`btn btn-sm${!photoFilter ? ' btn-dark' : ''}`} scroll={false}>Alle ({allPhotos.length})</Link>
                {Object.entries(PHOTO_CATEGORY).map(([k, v]) => (
                  <Link key={k} href={`/kunden/${id}?fotos=${k}`} className={`btn btn-sm${photoFilter === k ? ' btn-dark' : ''}`} scroll={false}>
                    {v} ({allPhotos.filter((p) => p.category === k).length})
                  </Link>
                ))}
              </nav>
            </div>
            <div className="photo-grid">
              {photos.map((p) => {
                const url = urlFor(p.storage_path);
                return (
                  <figure key={p.id} className="photo">
                    <div className="img">
                      {url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={p.caption ?? PHOTO_CATEGORY[p.category]} /></a> : null}
                      <span className="tag">{PHOTO_CATEGORY[p.category]} · {PHOTO_SOURCE[p.source]}</span>
                    </div>
                    <figcaption><span className="strong">{p.caption ?? 'ohne Beschreibung'}</span><span className="tiny">{date(p.taken_on)}</span></figcaption>
                  </figure>
                );
              })}
            </div>
            {photos.length === 0 && <p className="small">Noch keine Fotos{photoFilter ? ' in dieser Kategorie' : ''}.</p>}
            <details className="add">
              <summary>Fotos hinzufügen</summary>
              <form action={uploadPhotos}>
                <input type="hidden" name="customer_id" value={id} />
                <div className="field"><label htmlFor="files">Dateien</label><input id="files" name="files" type="file" accept="image/*" multiple required style={{ height: 'auto', padding: 10 }} /></div>
                <div className="form-grid">
                  <div className="field"><label htmlFor="category">Kategorie</label>
                    <select id="category" name="category">{Object.entries(PHOTO_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </div>
                  <div className="field"><label htmlFor="source">Quelle</label>
                    <select id="source" name="source"><option value="handy">Handy</option><option value="drohne">Drohne</option></select>
                  </div>
                  <div className="field"><label htmlFor="photo_plant">Anlage</label>
                    <select id="photo_plant" name="plant_id"><option value="">– keine –</option>{plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                  </div>
                </div>
                <div className="field"><label htmlFor="caption">Beschreibung</label><input id="caption" name="caption" placeholder="z. B. Baumreihe Westseite, 8 m Abstand" /></div>
                <button type="submit" className="btn btn-dark">Hochladen</button>
              </form>
            </details>
          </section>

          {/* Zugang & Arbeitsmittel je Anlage */}
          {plants.map((p) => {
            const a: Record<string, string | null> = p.site_assessments ?? {};
            return (
              <section key={p.id} className="card card-pad" aria-labelledby={`acc-${p.id}`}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <h2 id={`acc-${p.id}`}>Zugang &amp; Arbeitsmittel · {p.name}</h2>
                  <span className="small">{a.assessed_on ? `Bewertet am ${date(a.assessed_on)}` : 'Noch nicht bewertet'}</span>
                </div>
                <form action={saveAssessment}>
                  <input type="hidden" name="customer_id" value={id} />
                  <input type="hidden" name="plant_id" value={p.id} />
                  {ASSESSMENT_ITEMS.map((item) => (
                    <div key={item.key} className="assess-row">
                      <div className="grow field">
                        <label htmlFor={`${p.id}-${item.key}-note`}>{item.label}</label>
                        <input id={`${p.id}-${item.key}-note`} name={`${item.key}_note`} defaultValue={a[`${item.key}_note`] ?? ''} placeholder="Notiz" />
                      </div>
                      <div className="field">
                        <label htmlFor={`${p.id}-${item.key}`} className="sr-only">{item.label}: Bewertung</label>
                        <select id={`${p.id}-${item.key}`} name={item.key} defaultValue={a[item.key] ?? 'pruefen'}>
                          <option value="ja">Ja</option><option value="nein">Nein</option><option value="pruefen">Prüfen</option>
                        </select>
                      </div>
                    </div>
                  ))}
                  <button type="submit" className="btn btn-sm" style={{ marginTop: 8 }}>Bewertung speichern</button>
                </form>
              </section>
            );
          })}

          {/* Aufträge */}
          <section className="card" aria-labelledby="orders-h">
            <div className="card-head"><h2 id="orders-h">Aufträge</h2></div>
            <div className="table-wrap">
              <table style={{ minWidth: 600 }}>
                <thead><tr><th>Nr.</th><th>Leistung</th><th>Wunschtermin</th><th>Quelle</th><th className="num">Richtpreis</th><th>Status</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="strong"><Link href={`/?auftrag=${o.id}`}>{o.order_no}</Link></td>
                      <td>{o.services?.name}</td>
                      <td>{dateShort(o.wish_date)}{o.wish_slot ? ` · ${SLOT[o.wish_slot]}` : ''}</td>
                      <td>{SOURCE[o.source]}</td>
                      <td className="num">{money(o.estimated_price)}</td>
                      <td><Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.length === 0 && <p className="empty">Noch keine Aufträge.</p>}
            </div>
            <div className="card-pad" id="neuer-auftrag">
              <details className="add" open={orders.length === 0}>
                <summary>Neuer Auftrag (z. B. telefonische Buchung)</summary>
                <form action={createOrder}>
                  <input type="hidden" name="customer_id" value={id} />
                  <div className="form-grid">
                    <div className="field"><label htmlFor="service_id">Leistung</label>
                      <select id="service_id" name="service_id">{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                    </div>
                    <div className="field"><label htmlFor="order_plant">Anlage</label>
                      <select id="order_plant" name="plant_id"><option value="">– noch keine –</option>{plants.map((p) => <option key={p.id} value={p.id}>{p.name} · {num(p.area_m2)} m²</option>)}</select>
                    </div>
                    <div className="field"><label htmlFor="order_source">Quelle</label>
                      <select id="order_source" name="source" defaultValue="telefon">{Object.entries(SOURCE).filter(([k]) => k !== 'app').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    </div>
                    <div className="field"><label htmlFor="wish_date">Wunschtermin</label><input id="wish_date" name="wish_date" type="date" /></div>
                    <div className="field"><label htmlFor="wish_slot">Zeitfenster</label>
                      <select id="wish_slot" name="wish_slot"><option value="">–</option>{Object.entries(SLOT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    </div>
                  </div>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" name="with_thermography" /> mit Thermografieflug</label>
                  <div className="field"><label htmlFor="customer_note">Hinweis</label><textarea id="customer_note" name="customer_note" /></div>
                  <button type="submit" className="btn btn-primary">Auftrag anlegen</button>
                </form>
              </details>
            </div>
          </section>

          {/* Rechnungen & Zahlungen */}
          <section className="card" aria-labelledby="inv-h">
            <div className="card-head"><h2 id="inv-h">Rechnungen &amp; Zahlungen</h2><span className="small">Lexware-Abgleich folgt in Ausbaustufe 4</span></div>
            <div className="table-wrap">
              <table style={{ minWidth: 760 }}>
                <thead><tr><th>Beleg</th><th>Datum</th><th>Leistung</th><th className="num">Netto</th><th>Status</th><th><span className="sr-only">Aktion</span></th></tr></thead>
                <tbody>
                  {docs.map((d) => {
                    const st = DOCUMENT_STATUS[d.status];
                    const detail = d.status === 'bezahlt' ? `am ${date(d.paid_on)}${d.reminder_on ? ` · nach Erinnerung vom ${date(d.reminder_on)}` : ''}`
                      : d.status === 'versendet' ? `am ${date(d.sent_on)} · fällig ${date(d.due_on)}`
                      : d.status === 'ueberfaellig' ? `fällig war ${date(d.due_on)}${d.reminder_on ? ` · Erinnerung ${date(d.reminder_on)}` : ''}` : '';
                    const next = d.status === 'entwurf' ? 'versendet' : d.status === 'versendet' || d.status === 'ueberfaellig' ? 'bezahlt' : null;
                    return (
                      <tr key={d.id}>
                        <td className="strong" style={{ whiteSpace: 'nowrap' }}>{d.type === 'angebot' ? 'Angebot ' : ''}{d.number ?? '–'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{date(d.issued_on)}</td>
                        <td>{d.description ?? '–'}</td>
                        <td className="num strong">{money(d.net_amount)}</td>
                        <td><Badge tone={st.tone}>{st.label}</Badge>{detail && <div className="tiny" style={{ marginTop: 4 }}>{detail}</div>}</td>
                        <td>
                          {next && (
                            <form action={setDocumentStatus} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <input type="hidden" name="customer_id" value={id} />
                              <input type="hidden" name="document_id" value={d.id} />
                              <button name="status" value={next} className="btn btn-sm">{next === 'versendet' ? 'als versendet' : 'als bezahlt'}</button>
                              {d.status === 'versendet' && d.type === 'rechnung' && <button name="status" value="ueberfaellig" className="btn btn-sm">Erinnerung</button>}
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {docs.length === 0 && <p className="empty">Noch keine Angebote oder Rechnungen.</p>}
            </div>
            <div className="card-pad">
              <details className="add">
                <summary>Beleg manuell erfassen</summary>
                <form action={addDocument}>
                  <input type="hidden" name="customer_id" value={id} />
                  <div className="form-grid">
                    <div className="field"><label htmlFor="doc_type">Art</label><select id="doc_type" name="type"><option value="rechnung">Rechnung</option><option value="angebot">Angebot</option></select></div>
                    <div className="field"><label htmlFor="doc_number">Nummer</label><input id="doc_number" name="number" placeholder="RE-2026-0001" /></div>
                    <div className="field"><label htmlFor="doc_amount">Netto (€)</label><input id="doc_amount" name="net_amount" inputMode="decimal" /></div>
                    <div className="field"><label htmlFor="doc_issued">Datum</label><input id="doc_issued" name="issued_on" type="date" /></div>
                    <div className="field"><label htmlFor="doc_due">Fällig am</label><input id="doc_due" name="due_on" type="date" /></div>
                    <div className="field"><label htmlFor="doc_status">Status</label>
                      <select id="doc_status" name="status">{Object.entries(DOCUMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                    </div>
                  </div>
                  <div className="field"><label htmlFor="doc_desc">Leistung</label><input id="doc_desc" name="description" placeholder="Reinigung Freifläche 1.250 m² × 1,56 €/m²" /></div>
                  <button type="submit" className="btn btn-dark">Beleg speichern</button>
                </form>
              </details>
            </div>
          </section>
        </div>

        <div className="col-side">
          {/* Ansprechpartner */}
          <section className="card card-pad" aria-labelledby="contacts-h" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 id="contacts-h">Ansprechpartner</h2>
            {contacts.map((c) => {
              const roles = [c.role, c.is_decision_maker && 'Entscheider', c.is_invoice_recipient && 'Rechnungsempfang', c.is_onsite_contact && 'vor Ort'].filter(Boolean).join(' · ');
              return (
                <div key={c.id} style={{ borderTop: '1px solid var(--row-line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="strong">{c.name}</span>
                  {roles && <span className="tiny">{roles}</span>}
                  <span style={{ fontSize: 13 }}>
                    {c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>}{c.phone && c.email ? ' · ' : ''}{c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                  </span>
                </div>
              );
            })}
            {contacts.length === 0 && <p className="small">Noch keine Ansprechpartner.</p>}
            <details className="add">
              <summary>Ansprechpartner hinzufügen</summary>
              <form action={addContact}>
                <input type="hidden" name="customer_id" value={id} />
                <div className="field"><label htmlFor="c_name">Name</label><input id="c_name" name="name" required /></div>
                <div className="field"><label htmlFor="c_role">Funktion</label><input id="c_role" name="role" placeholder="z. B. Inhaber, Buchhaltung" /></div>
                <div className="field"><label htmlFor="c_phone">Telefon</label><input id="c_phone" name="phone" type="tel" /></div>
                <div className="field"><label htmlFor="c_email">E-Mail</label><input id="c_email" name="email" type="email" /></div>
                <label style={{ display: 'flex', gap: 8, fontSize: 14 }}><input type="checkbox" name="is_decision_maker" /> entscheidet über Aufträge</label>
                <label style={{ display: 'flex', gap: 8, fontSize: 14 }}><input type="checkbox" name="is_invoice_recipient" /> erhält Rechnungen</label>
                <label style={{ display: 'flex', gap: 8, fontSize: 14 }}><input type="checkbox" name="is_onsite_contact" /> Ansprechpartner vor Ort</label>
                <button type="submit" className="btn btn-dark">Speichern</button>
              </form>
            </details>
          </section>

          {/* Anlagen */}
          <section className="card card-pad" aria-labelledby="plants-h" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 id="plants-h">Anlagen</h2>
            {plants.map((p) => {
              const bucket = p.last_cleaning ?? (p.last_cleaned_on ? bucketFromDate(new Date(p.last_cleaned_on)) : null);
              const loss = bucket && showsLossWarning(bucket) && p.kwp ? estimateYearlyLoss(Number(p.kwp), bucket) : null;
              return (
                <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span className="strong">{p.name}</span>
                    <Badge tone={p.roof === 'freiflaeche' ? 'amber' : 'blue'}>{ROOF[p.roof]}</Badge>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                    <span><span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{num(p.kwp, 1)}</span><br /><span className="tiny">kWp</span></span>
                    <span><span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{num(p.area_m2)}</span><br /><span className="tiny">m²</span></span>
                    <span><span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{num(p.module_count)}</span><br /><span className="tiny">Module</span></span>
                  </div>
                  <span className="tiny" style={{ color: 'var(--text-2)' }}>
                    {[p.build_year && `Baujahr ${p.build_year}`, p.tilt_deg && `Neigung ${num(p.tilt_deg)}°`, p.inverter,
                      p.last_cleaned_on ? `zuletzt gereinigt ${date(p.last_cleaned_on)}` : bucket ? `letzte Reinigung: ${CLEANING[bucket]}` : null,
                      p.heavily_soiled && 'stark verschmutzt'].filter(Boolean).join(' · ')}
                  </span>
                  {loss && <span className="badge tone-amber" style={{ whiteSpace: 'normal' }}>Möglicher Ertragsverlust {loss.pctMin}–{loss.pctMax} % ≈ {num(loss.kwhMin)}–{num(loss.kwhMax)} kWh/Jahr</span>}
                </div>
              );
            })}
            <details className="add" open={plants.length === 0}>
              <summary>Anlage hinzufügen</summary>
              <form action={addPlant}>
                <input type="hidden" name="customer_id" value={id} />
                <div className="field"><label htmlFor="p_name">Bezeichnung</label><input id="p_name" name="name" placeholder="z. B. Scheunendach" /></div>
                <div className="form-grid">
                  <div className="field"><label htmlFor="p_kwp">kWp</label><input id="p_kwp" name="kwp" inputMode="decimal" /></div>
                  <div className="field"><label htmlFor="p_area">Fläche m²</label><input id="p_area" name="area_m2" inputMode="decimal" /></div>
                  <div className="field"><label htmlFor="p_mods">Module</label><input id="p_mods" name="module_count" inputMode="numeric" /></div>
                  <div className="field"><label htmlFor="p_roof">Dachart</label><select id="p_roof" name="roof">{Object.entries(ROOF).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                  <div className="field"><label htmlFor="p_tilt">Neigung °</label><input id="p_tilt" name="tilt_deg" inputMode="decimal" /></div>
                  <div className="field"><label htmlFor="p_year">Baujahr</label><input id="p_year" name="build_year" inputMode="numeric" /></div>
                  <div className="field"><label htmlFor="p_last">Zuletzt gereinigt</label><input id="p_last" name="last_cleaned_on" type="date" /></div>
                  <div className="field"><label htmlFor="p_bucket">… oder ungefähr</label>
                    <select id="p_bucket" name="last_cleaning"><option value="">–</option>{Object.entries(CLEANING).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </div>
                </div>
                <div className="field"><label htmlFor="p_inv">Wechselrichter</label><input id="p_inv" name="inverter" /></div>
                <label style={{ display: 'flex', gap: 8, fontSize: 14 }}><input type="checkbox" name="heavily_soiled" /> stark verschmutzt (2,70 €/m²)</label>
                <label style={{ display: 'flex', gap: 8, fontSize: 14 }}><input type="checkbox" name="not_accessible" /> Dach nicht frei zugänglich</label>
                <button type="submit" className="btn btn-dark">Anlage speichern</button>
              </form>
            </details>
          </section>

          {/* Historie */}
          <section className="card card-pad" aria-labelledby="hist-h">
            <h2 id="hist-h" style={{ marginBottom: 12 }}>Historie</h2>
            <form action={addNote} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input type="hidden" name="customer_id" value={id} />
              <label htmlFor="note_title" className="sr-only">Notiz</label>
              <input id="note_title" name="title" placeholder="Notiz, z. B. Telefonat mit Herrn Lindner" style={{ flex: '1 1 200px', height: 40, border: '1px solid var(--border-strong)', borderRadius: 10, padding: '0 10px' }} />
              <button className="btn btn-sm" type="submit">Notieren</button>
            </form>
            <div className="timeline">
              {events.map((e) => (
                <div key={e.id} className="tl-item">
                  <span className="tl-dot" aria-hidden="true" />
                  <div className="tl-body">
                    <span className="tiny">{date(e.occurred_at)} · {e.kind}</span>
                    <span className="strong" style={{ fontSize: 14 }}>{e.title}</span>
                    {e.body && <span className="tiny" style={{ color: 'var(--text-2)' }}>{e.body}</span>}
                  </div>
                </div>
              ))}
              {events.length === 0 && <p className="small">Noch keine Einträge.</p>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
