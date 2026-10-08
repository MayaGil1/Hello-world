import "server-only";
import { createClient } from "@supabase/supabase-js";

// Bypasses RLS. Only used on the server, after checking who the user is,
// to write AI-generated posts and captions that users must not be able to forge.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing SUPABASE_SECRET_KEY environment variable");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
