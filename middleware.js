import { updateSession } from './utils/supabase/middleware';

export default function middleware(request) {
  return updateSession(request);
}

export const config = {
  matcher: [ '/((?!_next|favicon.ico).*)' ],
};
