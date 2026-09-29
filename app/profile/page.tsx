import { requireCompleteProfile } from "@/lib/auth";
import { updateProfile } from "./actions";
import AvatarUpload from "./AvatarUpload";
import NameForm from "./NameForm";

export default async function ProfilePage() {
  const { user, profile } = await requireCompleteProfile();
  const fullName = `${profile.first_name} ${profile.last_name}`;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Profile
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">{user.email}</p>

      <section className="mt-10 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-black dark:text-zinc-50">Photo</h2>
        <AvatarUpload userId={user.id} avatarUrl={profile.avatar_url} name={fullName} />
      </section>

      <section className="mt-6 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-black dark:text-zinc-50">Details</h2>
        <NameForm
          action={updateProfile}
          firstName={profile.first_name ?? ""}
          lastName={profile.last_name ?? ""}
          bio={profile.bio ?? ""}
          showBio
          submitLabel="Save changes"
        />
      </section>
    </main>
  );
}
