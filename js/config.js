// 1) Create a Supabase project
// 2) Run sql/supabase_schema.sql in Supabase SQL Editor
// 3) Replace these values from Project Settings > API
const SUPABASE_URL = 'https://ighczfhwawxbzticmijz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnaGN6Zmh3YXd4Ynp0aWNtaWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNDE0MDgsImV4cCI6MjA5NTkxNzQwOH0.EdlkjfEAvbRdGraVDD7i_HL7FjmXxmyCebMGi-6qJew';

// AI Analyze is disabled for now to save API tokens.
// Keep Claude/Worker separate; the app now uses Copy Prompt only.

const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_ANON_KEY.length > 30 &&
  !SUPABASE_URL.includes('PASTE_') &&
  !SUPABASE_ANON_KEY.includes('PASTE_');

const supabaseClient = isSupabaseConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;


// Public Cloudflare Worker endpoint for PDF Summary Reader V3.1
window.PDF_WORKER_URL = "https://ascredits.gogogo-thong.workers.dev/";
