import { createClient } from '@supabase/supabase-js';

// Uses environment variables — set in .env or OnSpace Cloud secrets
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are injected at build time by Vite
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Gateway] Missing Supabase env vars — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
