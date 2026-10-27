import { SunLogo } from '@/components/SunLogo';
import { signIn } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await searchParams;
  return (
    <main className="login-wrap">
      <form action={signIn} className="login-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SunLogo size={30} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>Ertragsretter CRM</span>
        </div>
        <h1 style={{ fontSize: 24 }}>Anmelden</h1>
        {fehler && (
          <p className="notice" role="alert">
            {fehler === 'kein-team' ? 'Dieses Konto ist nicht für das CRM freigeschaltet.' : 'E-Mail oder Passwort stimmt nicht.'}
          </p>
        )}
        <div className="field">
          <label htmlFor="email">E-Mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Passwort</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button type="submit" className="btn btn-primary">Anmelden</button>
      </form>
    </main>
  );
}
