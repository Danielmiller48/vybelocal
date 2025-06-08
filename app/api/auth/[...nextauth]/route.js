// ── app/api/auth/[...nextauth]/route.js ──

export const runtime = "nodejs";

import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";

/* Public (anon) client for credential check */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/* Service client only for user creation (no second sign-in) */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize({ email, password }) {
        /* 1️⃣  Try to sign in with Supabase */
        let { data, error } = await supabase.auth.signInWithPassword({ email, password });

        /* 2️⃣  If user doesn’t exist, create them, then sign in */
        if (error && error.message.match(/Invalid login credentials/i)) {
          await supabaseAdmin.auth.admin
            .createUser({ email, password, email_confirm: true })
            .catch(() => {});               // ignore “already registered”
          ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
        }

        if (error || !data?.user || !data?.session) {
          throw new Error("Invalid email or password");
        }

        /* Pass tokens forward so we can bridge on the client */
        return {
          id: data.user.id,
          email: data.user.email,
          supabase: data.session           // { access_token, refresh_token, ... }
        };
      }
    })
  ],

  session: { strategy: "jwt" },

  callbacks: {
    /* copy tokens from user ⇒ JWT */
    async jwt({ token, user }) {
      if (user?.supabase) token.supabase = user.supabase;
      if (user?.id)       token.id       = user.id;
      return token;
    },

    /* expose tokens to the client session */
    async session({ session, token }) {
      session.supabase = token.supabase;
      session.user.id  = token.id;
      return session;
    }
  },

  pages: {
    signIn: "/login",
    newUser: "/register"
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug:  process.env.NODE_ENV === "development"
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
