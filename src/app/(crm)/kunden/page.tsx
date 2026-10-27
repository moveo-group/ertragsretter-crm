import Link from 'next/link';
import { redirect } from 'next/navigation';
import { can, requireStaff } from '@/lib/auth';
import { CUSTOMER_KIND } from '@/lib/labels';
import { createCustomer } from './actions';

type Row = { id: string; customer_no: string; name: string; kind: string; city: string | null; plants: { area_m2: number | null }[]; orders: { status: string }[] };

export default async function KundenPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase, staff } = await requireStaff();
  const edit = can(staff, 'customers');
  if (!edit && !can(staff, 'dispatch')) redirect('/?fehler=keine-berechtigung');
  const { q } = await searchParams;

  let query = supabase
    .from('customers')
    .select('id, customer_no, name, kind, city, plants(area_m2), orders(status)')
    .order('name')
    .limit(200);
  if (q) {
    const term = q.replace(/[%,()]/g, ' ').trim();
    query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%,customer_no.ilike.%${term}%`);
  }
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Kunden</h1>
          <span className="sub">{rows.length} {rows.length === 1 ? 'Kunde' : 'Kunden'}{q ? ` für „${q}“` : ''}</span>
        </div>
        <form style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label htmlFor="q" className="sr-only">Suche</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Name, Ort, Kundennummer …" style={{ height: 44, width: 280, maxWidth: '100%', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '0 14px' }} />
          <button className="btn" type="submit">Suchen</button>
        </form>
      </header>

      <div className="cols">
        <section className="card col-main" aria-label="Kundenliste">
          <div className="table-wrap">
            <table style={{ minWidth: 640 }}>
              <thead><tr><th>Nr.</th><th>Name</th><th>Art</th><th>Ort</th><th className="num">Anlagen</th><th className="num">Offene Aufträge</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="tiny">{r.customer_no}</td>
                    <td><Link href={`/kunden/${r.id}`} className="strong">{r.name}</Link></td>
                    <td>{CUSTOMER_KIND[r.kind]}</td>
                    <td>{r.city ?? '–'}</td>
                    <td className="num">{r.plants.length}</td>
                    <td className="num">{r.orders.filter((o) => ['neu', 'angenommen', 'eingeplant'].includes(o.status)).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="empty">Noch keine Kunden. Lege rechts den ersten an.</p>}
          </div>
        </section>

        {edit && <section className="card card-pad col-side" aria-labelledby="new-h">
          <h2 id="new-h">Neuer Kunde</h2>
          <form action={createCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field"><label htmlFor="name">Name / Firma</label><input id="name" name="name" required /></div>
            <div className="field">
              <label htmlFor="kind">Art</label>
              <select id="kind" name="kind">{Object.entries(CUSTOMER_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </div>
            <div className="field"><label htmlFor="street">Straße</label><input id="street" name="street" /></div>
            <div className="form-grid">
              <div className="field"><label htmlFor="zip">PLZ</label><input id="zip" name="zip" inputMode="numeric" /></div>
              <div className="field"><label htmlFor="city">Ort</label><input id="city" name="city" /></div>
            </div>
            <div className="form-grid">
              <div className="field"><label htmlFor="phone">Telefon</label><input id="phone" name="phone" type="tel" /></div>
              <div className="field"><label htmlFor="email">E-Mail</label><input id="email" name="email" type="email" /></div>
            </div>
            <div className="field"><label htmlFor="lead_source">Wie auf uns aufmerksam?</label><input id="lead_source" name="lead_source" placeholder="z. B. Google, Empfehlung, Messe" /></div>
            <button type="submit" className="btn btn-primary">Kunde anlegen</button>
          </form>
        </section>}
      </div>
    </>
  );
}
