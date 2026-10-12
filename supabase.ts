import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

/**
 * True only when BOTH Supabase values are present in the environment.
 * The whole UI uses this flag so it never claims a feature is live when
 * the backend has not been configured.
 */
export const isBackendConfigured = url.length > 0 && anonKey.length > 0;

/**
 * The Supabase client, or null when the backend is not configured.
 * Only the public "anon" key is ever used in the browser.
 */
export const supabase: SupabaseClient | null = isBackendConfigured
  ? createClient(url, anonKey)
  : null;
