"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  firstName: string;
  lastName: string;
  bio?: string;
  showBio?: boolean;
  submitLabel: string;
};

const inputClass =
  "w-full rounded-lg border border-black/[.12] bg-white px-3 py-2 text-black outline-none focus:border-black dark:border-white/[.2] dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white";

export default function NameForm({
  action,
  firstName,
  lastName,
  bio = "",
  showBio = false,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          First name
          <input name="first_name" defaultValue={firstName} required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Last name
          <input name="last_name" defaultValue={lastName} required className={inputClass} />
        </label>
      </div>
      {showBio && (
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Bio (optional)
          <textarea name="bio" defaultValue={bio} rows={3} className={inputClass} />
        </label>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700 dark:text-green-400">{state.success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-11 self-start rounded-full bg-foreground px-6 font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
