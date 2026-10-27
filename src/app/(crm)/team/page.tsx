import { PERMISSIONS, PRESETS, requirePerm, type StaffMember } from '@/lib/auth';
import { Badge } from '@/components/Badge';
import { updateStaff } from './actions';
import { NewStaffForm } from './NewStaffForm';

const ROLE: Record<string, string> = { admin: 'Inhaber / Leitung', office: 'Büro', field: 'Außendienst' };

type Row = StaffMember & { email: string | null; can_work_alone: boolean; is_drone_pilot: boolean };

export default async function TeamPage() {
  const { supabase, staff: me } = await requirePerm('team');
  const { data } = await supabase
    .from('staff')
    .select('id, full_name, initials, role, active, email, can_work_alone, is_drone_pilot, perm_customers, perm_dispatch, perm_finance, perm_team, perm_settings')
    .order('active', { ascending: false })
    .order('full_name');
  const team = (data ?? []) as Row[];

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Mitarbeiter &amp; Rechte</h1>
          <span className="sub">{team.filter((t) => t.active).length} aktiv · Rechte werden direkt in der Datenbank durchgesetzt</span>
        </div>
      </header>

      <div className="cols">
        <div className="col-main">
          {team.map((t) => {
            const self = t.id === me.id;
            return (
              <section key={t.id} className="card card-pad" aria-labelledby={`st-${t.id}`} style={{ opacity: t.active ? 1 : 0.65 }}>
                <form action={updateStaff} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <input type="hidden" name="id" value={t.id} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{t.initials}</span>
                      <div>
                        <h2 id={`st-${t.id}`}>{t.full_name}{self ? ' (du)' : ''}</h2>
                        <span className="tiny">{t.email ?? ''}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {!t.active && <Badge tone="grey">deaktiviert</Badge>}
                      <label htmlFor={`role-${t.id}`} className="sr-only">Funktion</label>
                      <select id={`role-${t.id}`} name="role" defaultValue={t.role} style={{ height: 36, borderRadius: 10, border: '1px solid var(--border-strong)', padding: '0 8px' }}>
                        {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                    {PERMISSIONS.map((p) => {
                      const locked = self && p.key === 'team';
                      return (
                        <label key={p.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, border: '1px solid var(--border)', borderRadius: 12, padding: 10 }}>
                          <input type="checkbox" name={p.column} defaultChecked={Boolean(t[p.column as keyof Row])} disabled={locked} style={{ marginTop: 3 }} />
                          {locked && <input type="hidden" name={p.column} value="on" />}
                          <span><span className="strong">{p.label}</span><br /><span className="tiny">{locked ? 'Eigenes Verwaltungsrecht kann nicht entzogen werden' : p.hint}</span></span>
                        </label>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                    <label style={{ display: 'flex', gap: 8, fontSize: 14 }}><input type="checkbox" name="can_work_alone" defaultChecked={t.can_work_alone} /> fährt kleinere Anlagen allein</label>
                    <label style={{ display: 'flex', gap: 8, fontSize: 14 }}><input type="checkbox" name="is_drone_pilot" defaultChecked={t.is_drone_pilot} /> Drohnenpilot</label>
                    <label style={{ display: 'flex', gap: 8, fontSize: 14 }}>
                      <input type="checkbox" name="active" defaultChecked={t.active} disabled={self} /> aktiv (darf sich anmelden)
                      {self && <input type="hidden" name="active" value="on" />}
                    </label>
                    <button type="submit" className="btn btn-sm btn-dark" style={{ marginLeft: 'auto' }}>Speichern</button>
                  </div>
                </form>
              </section>
            );
          })}
        </div>

        <section className="card card-pad col-side" aria-labelledby="new-staff-h">
          <h2 id="new-staff-h" style={{ marginBottom: 12 }}>Neuer Mitarbeiter</h2>
          <NewStaffForm permissions={PERMISSIONS} presets={PRESETS} />
        </section>
      </div>
    </>
  );
}
