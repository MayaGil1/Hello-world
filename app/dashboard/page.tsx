import Link from "next/link";
import Avatar from "@/components/Avatar";
import { requireCompleteProfile } from "@/lib/auth";

export default async function DashboardPage() {
  const { supabase, profile } = await requireCompleteProfile();
  const fullName = `${profile.first_name} ${profile.last_name}`;

  const { count: bookCount } = await supabase
    .from("books")
    .select("*", { count: "exact", head: true });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <div className="flex items-center gap-4">
        <Avatar url={profile.avatar_url} name={fullName} size={64} />
        <div>
          <p className="text-sm text-zinc-500">Members only</p>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Hi, {profile.first_name}!
          </h1>
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/books"
          className="rounded-xl border border-black/[.08] bg-white p-5 transition-colors hover:border-black/[.2] dark:border-white/[.145] dark:bg-zinc-900 dark:hover:border-white/[.3]"
        >
          <p className="text-sm text-zinc-500">Library</p>
          <p className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
            {bookCount ?? 0} books
          </p>
        </Link>
        <Link
          href="/profile"
          className="rounded-xl border border-black/[.08] bg-white p-5 transition-colors hover:border-black/[.2] dark:border-white/[.145] dark:bg-zinc-900 dark:hover:border-white/[.3]"
        >
          <p className="text-sm text-zinc-500">Your profile</p>
          <p className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
            {profile.avatar_url ? "Edit profile" : "Add a photo"}
          </p>
        </Link>
      </div>
    </main>
  );
}
