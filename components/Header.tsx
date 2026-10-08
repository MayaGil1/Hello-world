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
    <header className="border-b border-black/[.08] bg-white dark:border-white/[.145] dark:bg-black">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-6 text-sm">
        <div className="flex items-center gap-5">
          <Link href="/" className="font-semibold text-black dark:text-zinc-50">
            CapCity
          </Link>
          {user && (
            <>
              <Link href="/create" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
                Post
              </Link>
              <Link href="/dashboard" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
                My stuff
              </Link>
            </>
          )}
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <Link href="/profile" className="flex items-center gap-2 text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white">
              <Avatar url={profile?.avatar_url ?? null} name={name} size={28} />
              <span className="hidden sm:inline">{name}</span>
            </Link>
            <form action="/auth/signout" method="post">
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
