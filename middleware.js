export { updateSession as default } from '@/utils/supabase/middleware';

export const config = {
  matcher: [ '/((?!_next|favicon.ico).*)' ],
};
