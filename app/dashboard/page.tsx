import Link from "next/link";
import Avatar from "@/components/Avatar";
import { requireCompleteProfile } from "@/lib/auth";

export default async function DashboardPage() {
  const { supabase, user, profile } = await requireCompleteProfile();
  const fullName = `${profile.first_name} ${profile.last_name}`;

  const [{ data: posts }, { count: votesCast }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, image_url, score, theme, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("votes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const points = (posts ?? []).reduce((sum, post) => sum + post.score, 0);
  const stats = [
    { label: "Photos posted", value: posts?.length ?? 0 },
    { label: "Points earned", value: points },
    { label: "Votes cast", value: votesCast ?? 0 },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center gap-4">
        <Avatar url={profile.avatar_url} name={fullName} size={64} />
        <div>
          <p className="text-sm text-zinc-500">Members only</p>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Hi, {profile.first_name}!
          </h1>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900"
          >
            <p className="text-2xl font-semibold text-black tabular-nums dark:text-zinc-50">{stat.value}</p>
            <p className="text-xs text-zinc-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Your posts</h2>
        <Link href="/create" className="text-sm font-medium text-orange-600 hover:underline">
          + Post a photo
        </Link>
      </div>
      {posts && posts.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {posts.map((post) => (
            <li key={post.id}>
              <Link href={`/p/${post.id}`} className="group relative block overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.image_url} alt="" className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
                <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                  {post.score} pts
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          You haven&apos;t posted yet.{" "}
          <Link href="/create" className="font-medium underline">
            Post your first photo
          </Link>
          .
        </p>
      )}

      <p className="mt-10 text-sm text-zinc-500">
        <Link href="/profile" className="hover:underline">Edit profile</Link> ·{" "}
        <Link href="/books" className="hover:underline">Books</Link>
      </p>
    </main>
  );
}
