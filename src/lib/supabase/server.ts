import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Supabase-Client für Server Components, Server Actions und Route Handler (mit Login des Nutzers). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // In Server Components dürfen keine Cookies gesetzt werden – die Middleware erneuert die Sitzung.
          }
        },
      },
    },
  );
}
