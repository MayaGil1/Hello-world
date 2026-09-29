import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Book = {
  id: number;
  title: string;
  author: string;
  year: number | null;
  genre: string | null;
};

export default async function BooksPage() {
  const supabase = await createClient();
  const { data: books, error } = await supabase
    .from("books")
    .select("id, title, author, year, genre")
    .order("id");

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-3xl py-16 px-6 sm:px-16">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← Home
        </Link>
        <h1 className="mt-4 mb-8 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Books
        </h1>

        {error ? (
          <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
            Failed to load books: {error.message}
          </p>
        ) : !books || books.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">No books found.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {(books as Book[]).map((book) => (
              <li
                key={book.id}
                className="rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-900"
              >
                <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
                  {book.title}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400">{book.author}</p>
                <p className="mt-2 text-sm text-zinc-500">
                  {[book.genre, book.year].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
