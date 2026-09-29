import { redirect } from "next/navigation";
import { getSession, hasName } from "@/lib/auth";
import { completeOnboarding } from "@/app/profile/actions";
import NameForm from "@/app/profile/NameForm";

export default async function OnboardingPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login");
  if (hasName(profile)) redirect("/dashboard");

  // Pre-fill from the Google account when available; the user can edit before saving.
  const meta = user.user_metadata ?? {};
  const [googleFirst = "", ...rest] = String(meta.full_name ?? meta.name ?? "").split(" ");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Welcome! What should we call you?
      </h1>
      <p className="mt-2 mb-8 text-zinc-600 dark:text-zinc-400">
        Add your first and last name to finish setting up your account.
      </p>
      <NameForm
        action={completeOnboarding}
        firstName={profile?.first_name ?? meta.given_name ?? googleFirst}
        lastName={profile?.last_name ?? meta.family_name ?? rest.join(" ")}
        submitLabel="Continue"
      />
    </main>
  );
}
