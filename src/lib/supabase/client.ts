// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'
import { createSessionGuardFetch } from './session-guard'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

// Import the supabase client like this:
// import { supabase } from "@/lib/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  // WATCHDOG (22/10): fetch interceptor — qualquer 401 do Supabase (query,
  // RPC, storage) valida a sessão contra o servidor; conta apagada = logout
  // limpo na hora. Detalhes em session-guard.ts.
  global: {
    fetch: createSessionGuardFetch(),
  },
})
