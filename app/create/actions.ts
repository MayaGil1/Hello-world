"use server";

import { redirect } from "next/navigation";
import { buildPrompt, generateCaptions } from "@/lib/gemini";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { themeForDate } from "@/lib/themes";

const DAILY_LIMIT = 10;

export type GenerateState = { error?: string };

export async function generatePost(
  imagePath: string,
  rawNote: string,
): Promise<GenerateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The browser uploaded the photo into the user's own folder; never accept someone else's file.
  if (!imagePath.startsWith(`${user.id}/`)) return { error: "Invalid upload." };

  const admin = createAdminClient();

  // Keep the free AI quota from being drained by one person.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return { error: `You can post ${DAILY_LIMIT} photos a day. Come back tomorrow!` };
  }

  const { data: file, error: downloadError } = await admin.storage
    .from("posts")
    .download(imagePath);
  if (downloadError || !file) return { error: "Could not read the uploaded photo." };

  const note = rawNote.trim().slice(0, 200) || null;
  const theme = themeForDate();
  const prompt = buildPrompt(theme, note);

  let result;
  try {
    result = await generateCaptions(
      { data: await file.arrayBuffer(), mimeType: file.type || "image/jpeg" },
      prompt,
    );
  } catch (error) {
    console.error(error);
    return { error: "The AI couldn't caption that photo. Try a different one." };
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("posts").getPublicUrl(imagePath);

  const { data: post, error: postError } = await admin
    .from("posts")
    .insert({ user_id: user.id, image_path: imagePath, image_url: publicUrl, theme, note })
    .select("id")
    .single();
  if (postError || !post) return { error: "Could not save your post." };

  const { error: captionError } = await admin.from("captions").insert(
    result.captions.map((caption) => ({
      post_id: post.id,
      text: caption.text,
      style: caption.style,
      prompt,
      model: result.model,
    })),
  );
  if (captionError) {
    await admin.from("posts").delete().eq("id", post.id);
    return { error: "Could not save the captions." };
  }

  redirect(`/p/${post.id}?new=1`);
}
