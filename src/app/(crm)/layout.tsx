import { Sidebar } from '@/components/Sidebar';
import { can, requireStaff } from '@/lib/auth';
import { signOut } from '../login/actions';

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const { staff } = await requireStaff();
  const seesCustomers = can(staff, 'customers') || can(staff, 'dispatch');

  // Menü zeigt nur, was die Person sehen darf
  const items = [
    { href: '/', label: 'Übersicht' },
    ...(seesCustomers ? [{ href: '/kunden', label: 'Kunden' }] : []),
    ...(can(staff, 'dispatch') ? [{ label: 'Disposition', soon: true }] : []),
    ...(can(staff, 'finance') ? [{ label: 'Angebote & Rechnungen', soon: true }] : []),
    ...(can(staff, 'team') ? [{ href: '/team', label: 'Mitarbeiter & Rechte' }] : []),
  ];

  return (
    <div className="shell">
      <Sidebar name={staff.full_name} items={items} signOut={signOut} />
      <main className="main">{children}</main>
    </div>
  );
}
