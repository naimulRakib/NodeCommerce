import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  // If we only have anon key, we can't list users. But let's check.
  console.log("Checking user...");
  // We can just try to login with lrs1@gmail.com and password '123456' or 'password'
  const res1 = await supabase.auth.signInWithPassword({ email: 'lrs1@gmail.com', password: 'password' });
  if (res1.data.user) console.log("Login 'password' Success! ID:", res1.data.user.id);
  else {
    const res2 = await supabase.auth.signInWithPassword({ email: 'lrs1@gmail.com', password: '12345678' });
    if (res2.data.user) console.log("Login '12345678' Success! ID:", res2.data.user.id);
    else console.log("Login failed for both.");
  }
}
test();
