'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SunLogo } from './SunLogo';

type NavItem = { href?: string; label: string; soon?: boolean };

export function Sidebar({ name, items, signOut }: { name: string; items: NavItem[]; signOut: () => Promise<void> }) {
  const pathname = usePathname();
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <aside className="sidebar">
      <div className="brand"><SunLogo /> Ertragsretter CRM</div>
      <nav className="nav" aria-label="CRM-Navigation">
        {items.map((n) =>
          n.href && !n.soon ? (
            <Link key={n.label} href={n.href} aria-current={active(n.href) ? 'page' : undefined}>{n.label}</Link>
          ) : (
            <span key={n.label}>{n.label} <small>bald</small></span>
          ),
        )}
      </nav>
      <div className="sidebar-foot">
        <span>Angemeldet als {name}</span>
        <Link href="/konto" style={{ color: '#fff', fontSize: 13 }}>Mein Konto</Link>
        <form action={signOut}><button type="submit" style={{ width: '100%' }}>Abmelden</button></form>
      </div>
    </aside>
  );
}
