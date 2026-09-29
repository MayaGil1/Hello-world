import Link from "next/link";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const { user, profile } = await getSession();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
        {user && profile?.first_name ? `Welcome back, ${profile.first_name}.` : "Hello, World."}
      </h1>
      <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        {user
          ? "You're signed in. Head to your dashboard or update your profile."
          : "A Next.js app backed by Supabase. Sign in with Google to unlock your dashboard and profile."}
      </p>
      <div className="flex flex-col gap-3 text-base font-medium sm:flex-row">
        {user ? (
          <Link href="/dashboard" className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]">
            Go to dashboard
          </Link>
        ) : (
          <Link href="/login" className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]">
            Sign in with Google
          </Link>
        )}
        <Link href="/books" className="flex h-12 items-center justify-center rounded-full border border-black/[.08] px-6 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]">
          View Books
        </Link>
      </div>
    </main>
  );
}
