// app/layout.js  – root server layout
import './globals.css'

import { Geist, Geist_Mono } from 'next/font/google'
import { getServerSession }  from 'next-auth/next'
import { authOptions }       from '../lib/authOptions'
import { Toaster } from 'react-hot-toast'

import ClientProviders from './ClientProviders'
import SupabaseBridge  from '../components/SupabaseBridge'
import Layout          from '../components/Layout'   // your site chrome
import AuthListener    from '@/components/AuthListener'  // <— already imported

/* fonts */
const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export default async function RootLayout({ children }) {
  const session = await getServerSession(authOptions)   // runs on the server

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>

        <ClientProviders session={session}>
          <SupabaseBridge />   {/* copies Next-Auth token → Supabase */}
          <AuthListener />     {/* 👈 reloads page on sign-in / sign-out */}
          <Layout>{children}</Layout>
          <Toaster position="bottom-center" />
        </ClientProviders>

      </body>
    </html>
  )
}
