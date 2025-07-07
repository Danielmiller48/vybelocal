// app/host/layout.jsx
import HostSidebar from '@/components/host/HostSidebar';

export const dynamic = 'force-dynamic'; // keeps ISR happy

export default async function HostLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      {/* sidebar */}
      <HostSidebar />

      {/* page content */}
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
