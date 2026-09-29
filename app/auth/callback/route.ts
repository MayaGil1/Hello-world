import { NextResponse } from "next/server";
import { hasName, type Profile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, bio, avatar_url")
    .eq("id", data.user.id)
    .single<Profile>();

  const destination = hasName(profile) ? "/dashboard" : "/onboarding";
  return NextResponse.redirect(`${origin}${destination}`);
}
