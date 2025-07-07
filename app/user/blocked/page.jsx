import BlocksList from '@/components/user/BlocksList';

export default function BlockedProfilesPage() {
  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Blocked Profiles</h1>
      <BlocksList />
    </div>
  );
} 