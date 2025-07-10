// app/user/page.jsx – Notifications center
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/utils/auth';
import { redirect } from 'next/navigation';
import NotificationsList from '@/components/user/NotificationsList';

export default async function UserNotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <NotificationsList userId={session.user.id} />;
} 