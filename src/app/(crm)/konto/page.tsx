import { PERMISSIONS, can, requireStaff } from '@/lib/auth';
import { changePassword } from './actions';

export default async function KontoPage({ searchParams }: { searchParams: Promise<{ ok?: string; fehler?: string }> }) {
  const { staff, user } = await requireStaff();
  const { ok, fehler } = await searchParams;
  return (
    <>
      <header className="page-head"><div><h1>Mein Konto</h1><span className="sub">{user.email}</span></div></header>
      <div className="cols">
        <section className="card card-pad col-main" aria-labelledby="pw-h" style={{ maxWidth: 520 }}>
          <h2 id="pw-h" style={{ marginBottom: 12 }}>Passwort ändern</h2>
          {ok && <p className="notice" role="status" style={{ background: 'var(--green-bg)', color: 'var(--green-fg)' }}>Passwort geändert.</p>}
          {fehler && <p className="notice" role="alert" style={{ background: 'var(--red-bg)', color: 'var(--red-fg)' }}>{fehler === 'ungleich' ? 'Die Passwörter stimmen nicht überein.' : fehler === 'kurz' ? 'Mindestens 10 Zeichen.' : 'Ändern fehlgeschlagen.'}</p>}
          <form action={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field"><label htmlFor="pw1">Neues Passwort</label><input id="pw1" name="password" type="password" autoComplete="new-password" minLength={10} required /></div>
            <div className="field"><label htmlFor="pw2">Wiederholen</label><input id="pw2" name="password2" type="password" autoComplete="new-password" minLength={10} required /></div>
            <button className="btn btn-primary" type="submit">Speichern</button>
          </form>
        </section>
        <section className="card card-pad col-side" aria-labelledby="perm-h">
          <h2 id="perm-h" style={{ marginBottom: 12 }}>Meine Rechte</h2>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
            {PERMISSIONS.map((p) => <li key={p.key}>{p.label}: <strong>{can(staff, p.key) ? 'ja' : 'nein'}</strong></li>)}
          </ul>
        </section>
      </div>
    </>
  );
}
