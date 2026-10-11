"use client";

import { useState } from "react";

export default function ShareButton({ path, text }: { path: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    // Phones get the native share sheet (iMessage, Instagram, etc.); desktops copy the link.
    if (navigator.share) {
      try {
        await navigator.share({ title: "CapCity", text, url });
        return;
      } catch {
        // User closed the share sheet; fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = url;
    }
  }

  return (
    <button
      onClick={share}
      className="rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-black/[.05] dark:text-zinc-400 dark:hover:bg-white/[.08]"
    >
      {copied ? "Link copied ✓" : "Share ↗"}
    </button>
  );
}
