import { createSupabaseServer } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export default async function TestProfiles() {
  const sb = await createSupabaseServer({ admin: true });
  const { data, error } = await sb.from('profiles').select('id, email, phone');
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Test: All Profiles (Service Role)</h1>
      {error && <div className="text-red-600">Error: {error.message}</div>}
      <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
} 