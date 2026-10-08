import type { SupabaseClient } from "@supabase/supabase-js";

export type Caption = {
  id: number;
  text: string;
  style: string;
  upvotes: number;
  downvotes: number;
  score: number;
};

export type Post = {
  id: number;
  user_id: string;
  image_url: string;
  theme: string;
  note: string | null;
  score: number;
  created_at: string;
  captions: Caption[];
};

export const POST_SELECT =
  "id, user_id, image_url, theme, note, score, created_at, captions(id, text, style, upvotes, downvotes, score)";

export function sortCaptions(captions: Caption[]) {
  return [...captions].sort((a, b) => b.score - a.score || a.id - b.id);
}

// Returns { captionId: 1 | -1 } for the signed-in user's votes. RLS only returns their own rows.
export async function getMyVotes(
  supabase: SupabaseClient,
  userId: string | undefined,
  captionIds: number[],
) {
  if (!userId || captionIds.length === 0) return {};
  const { data } = await supabase
    .from("votes")
    .select("caption_id, value")
    .eq("user_id", userId)
    .in("caption_id", captionIds);
  return Object.fromEntries((data ?? []).map((v) => [v.caption_id, v.value])) as Record<
    number,
    1 | -1
  >;
}
