import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      async authorize({ email, password }) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error || !data?.user) return null;
        return { id: data.user.id, email: data.user.email };
      },
    }),
  ],

  session: { strategy: "jwt" },

  /* ➜ NEW: keep id in the token, keep everything (incl. expires) in session */
  callbacks: {
    async jwt({ token, user }) {
      // First time the user logs in, add their Supabase id to the token
      if (user) token.id = user.id;
      return token;               // token.exp is set by Next-Auth automatically
    },

    async session({ session, token }) {
      // Make sure we DON’T lose the default fields (expires, user.email, …)
      return {
        ...session,               // keeps `expires`
        user: {
          ...session.user,        // keeps `email` / `name`
          id: token.id,           // custom field you added in jwt()
        },
      };
    },
  },
};