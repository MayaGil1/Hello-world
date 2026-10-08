import Link from "next/link";
import { notFound } from "next/navigation";
import PostCard from "@/components/PostCard";
import { getSession } from "@/lib/auth";
import { getMyVotes, POST_SELECT, type Post } from "@/lib/feed";

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const { supabase, user } = await getSession();

  const { data: post } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", Number(id))
    .maybeSingle<Post>();
  if (!post) notFound();

  const myVotes = await getMyVotes(supabase, user?.id, post.captions.map((c) => c.id));

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Feed
      </Link>
      {isNew && (
        <p className="mt-4 rounded-xl bg-orange-50 p-4 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200">
          Your captions are live! Vote for your favorite, then share the link so friends can vote too.
        </p>
      )}
      <div className="mt-4">
        <PostCard post={post} myVotes={myVotes} signedIn={!!user} isMine={user?.id === post.user_id} />
      </div>
      {!user && (
        <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/login" className="font-medium underline">
            Sign in
          </Link>{" "}
          to vote on these captions.
        </p>
      )}
    </main>
  );
}
