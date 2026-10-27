import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { Badge } from '@/components/Badge';
import { ORDER_STATUS, SOURCE, ROOF, SLOT, dateShort, num, money, timeAgo } from '@/lib/labels';
import { acceptOrder } from './actions';

type InboxOrder = {
  id: string; order_no: string; status: string; source: string;
  wish_date: string | null; wish_slot: string | null; area_m2: number | null;
  estimated_price: number | null; crew_size: number | null; needs_robot: boolean;
  with_thermography: boolean; customer_note: string | null; created_at: string;
  customers: { id: string; name: string; city: string | null } | null;
  plants: { name: string; kwp: number | null; area_m2: number | null; module_count: number | null; roof: string; freely_accessible: boolean } | null;
  services: { name: string } | null;
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ auftrag?: string }> }) {
  const { supabase, staff } = await requireStaff();
  const { auftrag } = await searchParams;

  const now = new Date();
  const inAWeek = new Date(now.getTime() + 7 * 864e5);

  const [inboxRes, newCount, offers, invoices, appts] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_no, status, source, wish_date, wish_slot, area_m2, estimated_price, crew_size, needs_robot, with_thermography, customer_note, created_at, customers(id, name, city), plants(name, kwp, area_m2, module_count, roof, freely_accessible), services(name)')
      .in('status', ['neu', 'angenommen'])
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'neu'),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('type', 'angebot').in('status', ['entwurf', 'versendet']),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('type', 'rechnung').in('status', ['versendet', 'ueberfaellig']),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('starts_at', now.toISOString()).lt('starts_at', inAWeek.toISOString()),
  ]);

  const inbox = (inboxRes.data ?? []) as unknown as InboxOrder[];
  const sel = inbox.find((o) => o.id === auftrag) ?? inbox[0];
  const hour = now.getHours();
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{greet}, {staff.full_name}</h1>
          <span className="sub">{now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
        <Link href="/kunden" className="btn btn-primary">+ Kunde / Auftrag</Link>
      </header>

      <section className="kpis" aria-label="Kennzahlen">
        <div className="kpi"><span className="label">Neue Buchungen</span><span className="value">{newCount.count ?? 0}</span><span className="hint">warten auf Annahme</span></div>
        <div className="kpi"><span className="label">Termine nächste 7 Tage</span><span className="value">{appts.count ?? 0}</span><span className="hint">Marcel, Thomas, Marie</span></div>
        <div className="kpi"><span className="label">Offene Angebote</span><span className="value">{offers.count ?? 0}</span><span className="hint">Entwurf oder versendet</span></div>
        <div className="kpi dark"><span className="label">Offene Rechnungen</span><span className="value">{invoices.count ?? 0}</span><span className="hint">versendet oder überfällig</span></div>
      </section>

      <div className="cols">
        <section className="card col-main" aria-labelledby="inbox-h" style={{ gap: 0 }}>
          <div className="card-head">
            <h2 id="inbox-h">Buchungseingang</h2>
            <span className="small">Aus App, Website und Telefon</span>
          </div>
          {inbox.length === 0 && <p className="empty">Keine offenen Buchungen. Neue Buchungen aus App und Website erscheinen hier automatisch.</p>}
          {inbox.map((o) => {
            const st = ORDER_STATUS[o.status];
            const area = o.area_m2 ?? o.plants?.area_m2;
            return (
              <Link key={o.id} href={`/?auftrag=${o.id}`} className="list-row" aria-current={sel?.id === o.id ? 'true' : undefined} scroll={false}>
                <span className="grow">
                  <span className="strong">{o.customers?.name ?? '–'}</span>
                  <span className="small">{o.order_no} · {o.services?.name}{o.with_thermography ? ' + Thermografie' : ''}{area ? ` · ${num(area)} m²` : ''}</span>
                </span>
                <span style={{ flex: '0 1 150px', display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
                  <span className="strong">{dateShort(o.wish_date)}{o.wish_slot ? ` · ${SLOT[o.wish_slot]}` : ''}</span>
                  <span className="small">Wunschtermin</span>
                </span>
                <Badge tone="grey">{SOURCE[o.source]}</Badge>
                <Badge tone={st.tone}>{st.label}</Badge>
              </Link>
            );
          })}
        </section>

        {sel && (
          <section className="card card-pad col-side" aria-labelledby="detail-h" style={{ gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <span className="tiny strong" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sel.order_no}</span>
                <h2 id="detail-h" style={{ fontSize: 22 }}>{sel.customers?.name}</h2>
              </div>
              <Badge tone={ORDER_STATUS[sel.status].tone}>{ORDER_STATUS[sel.status].label}</Badge>
            </div>
            <dl className="facts">
              <div><dt>Leistung</dt><dd>{sel.services?.name}{sel.with_thermography ? ' + Thermografie' : ''}</dd></div>
              <div><dt>Wunschtermin</dt><dd>{dateShort(sel.wish_date)}{sel.wish_slot ? ` · ${SLOT[sel.wish_slot]}` : ''}</dd></div>
              <div><dt>Anlage</dt><dd>{sel.plants ? `${num(sel.plants.kwp, 1)} kWp · ${num(sel.area_m2 ?? sel.plants.area_m2)} m²` : '–'}</dd></div>
              <div><dt>Dach / Zugang</dt><dd>{sel.plants ? `${ROOF[sel.plants.roof]} · ${sel.plants.freely_accessible ? 'frei' : 'prüfen'}` : '–'}</dd></div>
              <div><dt>Besetzung</dt><dd>{sel.crew_size ? `${sel.crew_size} ${sel.crew_size === 1 ? 'Person' : 'Personen'}${sel.needs_robot ? ' + Roboter' : ''}` : 'wird bei Annahme berechnet'}</dd></div>
              <div><dt>Richtpreis (netto)</dt><dd>{sel.estimated_price != null ? money(sel.estimated_price) : 'wird bei Annahme berechnet'}</dd></div>
              <div><dt>Eingang</dt><dd>{timeAgo(sel.created_at)} · {SOURCE[sel.source]}</dd></div>
              <div><dt>Ort</dt><dd>{sel.customers?.city ?? '–'}</dd></div>
            </dl>
            {sel.customer_note && <div className="notice" style={{ background: 'var(--ground)', color: 'var(--text-2)' }}>Hinweis vom Kunden: {sel.customer_note}</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {sel.status === 'neu' ? (
                <form action={acceptOrder} style={{ flex: '1 1 180px', display: 'flex' }}>
                  <input type="hidden" name="order_id" value={sel.id} />
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Annehmen</button>
                </form>
              ) : (
                <span className="btn" style={{ flex: '1 1 180px', background: 'var(--green-bg)', borderColor: 'var(--green-bg)', color: 'var(--green-fg)' }}>Angenommen</span>
              )}
              {sel.customers && <Link href={`/kunden/${sel.customers.id}`} className="btn" style={{ flex: '1 1 140px' }}>Kundenakte</Link>}
            </div>
            <p className="tiny">Angebot in Lexware Office und Einplanung folgen in den nächsten Ausbaustufen.</p>
          </section>
        )}
      </div>
    </>
  );
}
