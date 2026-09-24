import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://sneibvwhpualxdzlrlln.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZWlidndocHVhbHhkemxybGxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDEzNTYyNCwiZXhwIjoyMTA1NzExNjI0fQ.SF0GkF05eBGDRw20I8ZkORNRBTFGW6YA3x_AcahLf9Y';

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;