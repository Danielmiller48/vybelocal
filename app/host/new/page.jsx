import HostNewForm from '@/components/HostNewForm';

export const dynamic = 'force-dynamic'; // reads cookies for NextAuth

export default function HostNewPage() {
  return <HostNewForm />;
}