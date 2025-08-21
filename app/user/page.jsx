// app/user/page.jsx  (Server Component shell)
import DiscoverClient from '@/components/DiscoverClient';
import { getServerSession }   from 'next-auth/next';    // +++
import { authOptions }        from '@/lib/authOptions'; // +++
import { redirect }           from 'next/navigation';   // +++

export default async function UserPage() {
  const session = await getServerSession(authOptions);  // +++
  if (!session) {                                       // +++
    redirect('/login');                                 // +++
  }                                                     // +++

  return <DiscoverClient />;
}
