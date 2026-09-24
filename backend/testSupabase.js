const clientModule = require('./supabaseClient');
const supabase = clientModule.default || clientModule;

async function testConnection() {
  try {
    const { data, error } = await supabase.from('projects').select('*').limit(1);
    if (error) {
      console.log('⚠️ Supabase response:', error.message);
    } else {
      console.log('✅ Connection successful:', data);
    }
  } catch (err) {
    console.log('❌ Error connecting to Supabase:', err.message);
  }
}

testConnection();