// /middleware.js  ← must live in the project root (same level as next.config.js)

import { updateSession } from './utils/supabase/middleware.js';   // relative path keeps it simple

export default function middleware(request) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico).*)'],   // run on every request except static assets
};