"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; success?: string };

function readName(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const firstName = readName(formData, "first_name");
  const lastName = readName(formData, "last_name");
  if (!firstName || !lastName) {
    return { error: "Please enter both your first and last name." };
  }

  const update: Record<string, string | null> = {
    first_name: firstName,
    last_name: lastName,
    updated_at: new Date().toISOString(),
  };
  if (formData.has("bio")) update.bio = readName(formData, "bio") || null;

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  return error ? { error: error.message } : {};
}

export async function completeOnboarding(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await saveProfile(formData);
  if (result.error) return result;
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await saveProfile(formData);
  if (result.error) return result;
  revalidatePath("/", "layout");
  return { success: "Profile saved." };
}
