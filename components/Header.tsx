import Link from "next/link";
import Avatar from "@/components/Avatar";
import { getSession } from "@/lib/auth";

export default async function Header() {
  const { user, profile } = await getSession();
  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user?.email ||
    "";

  return (
    <header
      className="sticky z-20 border-b border-black/[.08] bg-white/90 backdrop-blur dark:border-white/[.145] dark:bg-black/80"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 text-sm sm:px-6">
        <Link href="/" className="flex items-center gap-1.5 text-base font-bold tracking-tight text-black dark:text-zinc-50">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 text-xs text-white">
            Cc
          </span>
          CapCity
        </Link>

        {user ? (
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/create"
              className="rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-3.5 py-1.5 font-semibold text-white shadow-sm hover:opacity-90"
            >
              + Post
            </Link>
            <Link href="/dashboard" className="px-1 text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
              My stuff
            </Link>
            <Link
              href="/profile"
              title="Your profile"
              className="flex items-center gap-2 text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white"
            >
              <Avatar url={profile?.avatar_url ?? null} name={name} size={30} />
              <span className="hidden md:inline">{profile?.first_name ?? name}</span>
            </Link>
            <form action="/auth/signout" method="post" className="hidden sm:block">
              <button className="rounded-full border border-black/[.12] px-3 py-1 text-zinc-700 hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-300 dark:hover:bg-white/[.06]">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link href="/login" className="rounded-full bg-foreground px-4 py-1.5 font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
