import { Sidebar } from '@/components/Sidebar';
import { requireStaff } from '@/lib/auth';
import { signOut } from '../login/actions';

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const { staff } = await requireStaff();
  return (
    <div className="shell">
      <Sidebar name={staff.full_name} signOut={signOut} />
      <main className="main">{children}</main>
    </div>
  );
}
