import 'react-native-url-polyfill/auto'; 
import { createClient } from '@supabase/supabase-js';

// URL de tu proyecto Nano
const supabaseUrl = 'https://jhihywkdckfxlxiwxnpz.supabase.co';

// IMPORTANTE: Asegúrate de que esta llave NO tenga espacios al inicio ni al final
const supabaseAnonKey = 'sb_publishable_dDsuh0CYBxS7Cdb3dkTWlg_0QO9GDbz';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  // ESTO ES VITAL PARA NANO
  db: {
    schema: 'public',
  }
});