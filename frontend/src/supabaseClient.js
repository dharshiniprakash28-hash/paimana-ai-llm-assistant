import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://sneibvwhpualxdzlrlln.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZWlidndocHVhbHhkemxybGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMzU2MjQsImV4cCI6MjEwNTcxMTYyNH0.A10TZ0uVjuhNikjZZ5USeRAM0N6sWoiFCsplfo_rYyw';

// Singleton pattern to prevent "Multiple GoTrueClient instances detected" warning during Vite HMR
export const supabase =
  globalThis.__supabaseInstance ||
  (globalThis.__supabaseInstance = createClient(supabaseUrl, supabaseAnonKey));
