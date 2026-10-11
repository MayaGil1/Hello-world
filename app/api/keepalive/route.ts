import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Called daily by a Vercel cron (vercel.json). Free Supabase projects pause
// after a week without database activity, which would take the site down.
export async function GET() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, posts: count });
}
