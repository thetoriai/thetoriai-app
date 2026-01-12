import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Vite-compatible env access
const url = import.meta.env.VITE_SUPABASE_URL || "";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Detect real Supabase availability
export const isConfigured =
  !!url && url.startsWith("https://") && !!key && key.length > 20;

/**
 * VirtualSupabase – local auth simulator
 * Used ONLY when Supabase env vars are missing
 */
class VirtualSupabase {
  auth = {
    signUp: async ({ email }: any) => ({
      data: { user: { email } },
      error: null
    }),
    signInWithPassword: async ({ email }: any) => ({
      data: { session: { user: { email } } },
      error: null
    }),
    signInWithOAuth: async ({ provider }: any) => ({
      data: { provider },
      error: null
    }),
    signOut: async () => ({ error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe() {} } }
    })
  };
}

// IMPORTANT: the switch
const realSupabase = isConfigured
  ? createClient(url, key)
  : new VirtualSupabase();

export const supabase = realSupabase as SupabaseClient;
