import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://bflwacmrohgykyrxtdgn.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_paC-Hz_bsBfd7XCuLOl6_A_K6E5Ec9S';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
