/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ORGANISER_NAME?: string;
  readonly VITE_EVENT_DATE?: string;
  readonly VITE_EVENT_VENUE?: string;
  readonly VITE_EVENT_CONTACT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
