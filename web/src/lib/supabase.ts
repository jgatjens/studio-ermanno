import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
// Only the public anon key belongs in the browser. No business data access here.
export const supabase = url && key ? createClient(url, key) : null
