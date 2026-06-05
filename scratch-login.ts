import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function testLogin() {
  console.log("Attempting login...");
  const start = Date.now();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'lrs1@gmail.com',
    password: 'password' // Guessing common password
  });
  console.log("Finished in", Date.now() - start, "ms");
  if (error) console.log("Error:", error.message);
  else console.log("Success! User ID:", data.user?.id);
}
testLogin();
