import Link from "next/link";
import VoteButtons from "@/components/VoteButtons";
import { sortCaptions, type Post } from "@/lib/feed";

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type Props = {
  post: Post;
  myVotes: Record<number, 1 | -1>;
  signedIn: boolean;
  isMine?: boolean;
  limit?: number;
};

export default function PostCard({ post, myVotes, signedIn, isMine, limit }: Props) {
  const captions = sortCaptions(post.captions);
  const shown = limit ? captions.slice(0, limit) : captions;

  return (
    <article className="overflow-hidden rounded-2xl border border-black/[.08] bg-white dark:border-white/[.145] dark:bg-zinc-900">
      <Link href={`/p/${post.id}`} className="block bg-zinc-100 dark:bg-zinc-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.image_url}
          alt={captions[0]?.text ?? "Posted photo"}
          className="max-h-[480px] w-full object-contain"
          loading="lazy"
        />
      </Link>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 text-xs text-zinc-500">
        <span className="rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300">
          {post.theme}
        </span>
        <span>
          {isMine ? "Your post · " : ""}
          {timeAgo(post.created_at)}
        </span>
      </div>
      <ol className="flex flex-col gap-1 p-2">
        {shown.map((caption, index) => (
          <li
            key={caption.id}
            className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-black/[.02] dark:hover:bg-white/[.03]"
          >
            <VoteButtons
              captionId={caption.id}
              score={caption.score}
              myVote={myVotes[caption.id] ?? 0}
              signedIn={signedIn}
            />
            <div className="min-w-0">
              <p className={`text-black dark:text-zinc-50 ${index === 0 ? "font-semibold" : ""}`}>
                {caption.text}
              </p>
              <p className="text-xs text-zinc-500">{caption.style}</p>
            </div>
          </li>
        ))}
      </ol>
      {limit && captions.length > limit && (
        <Link
          href={`/p/${post.id}`}
          className="block border-t border-black/[.06] px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-black/[.02] dark:border-white/[.08] dark:text-zinc-400"
        >
          See all {captions.length} captions →
        </Link>
      )}
    </article>
  );
}
