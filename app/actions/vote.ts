"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// value: 1 = upvote, -1 = downvote, 0 = remove my vote.
export async function vote(captionId: number, value: -1 | 0 | 1) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to vote." };
  if (![-1, 0, 1].includes(value)) return { error: "Invalid vote." };

  // RLS limits every query below to this user's own votes.
  const { data: existing } = await supabase
    .from("votes")
    .select("id")
    .eq("caption_id", captionId)
    .eq("user_id", user.id)
    .maybeSingle();

  let error;
  if (value === 0) {
    if (existing) ({ error } = await supabase.from("votes").delete().eq("id", existing.id));
  } else if (existing) {
    ({ error } = await supabase
      .from("votes")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("id", existing.id));
  } else {
    ({ error } = await supabase
      .from("votes")
      .insert({ caption_id: captionId, user_id: user.id, value }));
  }

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}
