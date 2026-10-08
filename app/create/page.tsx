import { requireCompleteProfile } from "@/lib/auth";
import { themeForDate } from "@/lib/themes";
import CreateForm from "./CreateForm";

export default async function CreatePage() {
  const { user } = await requireCompleteProfile();
  const theme = themeForDate();

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <p className="text-sm font-medium text-orange-600">Today&apos;s theme: {theme}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Post a photo
      </h1>
      <p className="mt-2 mb-8 text-zinc-600 dark:text-zinc-400">
        AI writes five captions in different styles. Everyone votes on which one hits.
      </p>
      <CreateForm userId={user.id} theme={theme} />
    </main>
  );
}
