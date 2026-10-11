"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generatePost } from "./actions";

const MAX_SIDE = 1600;

// Shown one after another while Gemini works, so a 5-25s wait doesn't feel frozen.
const PROGRESS_MESSAGES = [
  "Looking at your photo…",
  "Writing the chronically online caption…",
  "Asking a Midwest transplant what they think…",
  "Consulting the Low Steps…",
  "Making it deadpan…",
  "Adding something wholesome…",
  "Almost there…",
];

// Shrinks big phone photos and converts them to JPEG so every browser can show them.
async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject()), "image/jpeg", 0.85),
  );
}

export default function CreateForm({ userId, theme }: { userId: string; theme: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (status !== "generating") return;
    setStep(0);
    const timer = setInterval(
      () => setStep((s) => Math.min(s + 1, PROGRESS_MESSAGES.length - 1)),
      3000,
    );
    return () => clearInterval(timer);
  }, [status]);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      setError("Please choose an image.");
      return;
    }
    setError(null);
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setError(null);
    setStatus("uploading");

    let jpeg: Blob;
    try {
      jpeg = await toJpeg(file);
    } catch {
      setError("That image format isn't supported here. Try a JPG or PNG.");
      setStatus("idle");
      return;
    }

    const path = `${userId}/${Date.now()}.jpg`;
    const { error: uploadError } = await createClient()
      .storage.from("posts")
      .upload(path, jpeg, { contentType: "image/jpeg" });
    if (uploadError) {
      setError(uploadError.message);
      setStatus("idle");
      return;
    }

    setStatus("generating");
    // On success the action redirects to the new post, so this only returns on failure.
    const result = await generatePost(path, note);
    if (result?.error) {
      setError(result.error);
      setStatus("idle");
    }
  }

  const busy = status !== "idle";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <label className="flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-black/[.15] bg-white text-zinc-500 hover:border-black/[.3] dark:border-white/[.2] dark:bg-zinc-900">
        {preview ? (
          <span className="relative h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Selected photo" className="h-full w-full object-contain" />
            {busy && (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 px-6 text-center text-white">
                <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
                <span className="font-medium" aria-live="polite">
                  {status === "uploading" ? "Uploading your photo…" : PROGRESS_MESSAGES[step]}
                </span>
                {status === "generating" && (
                  <span className="text-xs text-white/70">This usually takes 5–20 seconds</span>
                )}
              </span>
            )}
          </span>
        ) : (
          <span className="px-6 text-center">
            Tap to choose a photo
            <br />
            <span className="text-sm">Something that fits today: {theme}</span>
          </span>
        )}
        <input type="file" accept="image/*" onChange={onPick} disabled={busy} className="sr-only" />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Give the AI some context (optional)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          disabled={busy}
          placeholder="e.g. the 1 train at 8:58 for a 9am"
          className="rounded-lg border border-black/[.12] bg-white px-3 py-2 font-normal text-black outline-none focus:border-black dark:border-white/[.2] dark:bg-zinc-900 dark:text-zinc-50"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!file || busy}
        className="h-12 rounded-full bg-foreground px-6 font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {status === "uploading"
          ? "Uploading…"
          : status === "generating"
            ? "Writing captions…"
            : "Generate captions"}
      </button>
    </form>
  );
}
