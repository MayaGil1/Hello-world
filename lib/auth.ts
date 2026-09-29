import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export function hasName(profile: Profile | null) {
  return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim());
}

// Returns the signed-in user and their profile, or nulls when logged out.
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, bio, avatar_url")
    .eq("id", user.id)
    .single<Profile>();

  return { supabase, user, profile };
}

// For gated pages: sends logged-out users to /login and users without a name to /onboarding.
export async function requireCompleteProfile() {
  const session = await getSession();
  if (!session.user) redirect("/login");
  if (!hasName(session.profile)) redirect("/onboarding");
  return { ...session, user: session.user, profile: session.profile! };
}
