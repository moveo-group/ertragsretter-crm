'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SunLogo } from './SunLogo';

const NAV = [
  { href: '/', label: 'Übersicht' },
  { href: '/kunden', label: 'Kunden' },
];
const SOON = ['Disposition', 'Angebote & Rechnungen', 'Wartungsverträge'];

export function Sidebar({ name, signOut }: { name: string; signOut: () => Promise<void> }) {
  const pathname = usePathname();
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <aside className="sidebar">
      <div className="brand"><SunLogo /> Ertragsretter CRM</div>
      <nav className="nav" aria-label="CRM-Navigation">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? 'page' : undefined}>{n.label}</Link>
        ))}
        {SOON.map((s) => (
          <span key={s}>{s} <small>bald</small></span>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span>Angemeldet als {name}</span>
        <form action={signOut}><button type="submit" style={{ width: '100%' }}>Abmelden</button></form>
      </div>
    </aside>
  );
}
