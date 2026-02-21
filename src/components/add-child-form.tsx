"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type AddChildFormProps = {
  userId: string;
  familyId: string | null;
};

export function AddChildForm({ userId, familyId }: AddChildFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName || !birthdate) {
      setError("Name and birthdate are required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("children").insert({
      user_id: userId,
      created_by: userId,
      family_id: familyId,
      name: trimmedName,
      birthdate
    });

    setIsSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName("");
    setBirthdate("");
    router.refresh();
  };

  return (
    <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-medium text-slate-800" htmlFor="child-name">
          Name
        </label>
        <input
          id="child-name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          placeholder="Enter child's name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-800" htmlFor="child-birthdate">
          Birthdate
        </label>
        <input
          id="child-birthdate"
          type="date"
          required
          value={birthdate}
          onChange={(event) => setBirthdate(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        />
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Saving..." : "Add Child"}
      </button>
    </form>
  );
}
