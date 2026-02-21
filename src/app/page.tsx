import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("family_id").eq("id", user.id).maybeSingle()
    : { data: null };

  const hasFamilyGroup = Boolean(profile?.family_id);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10 sm:max-w-lg">
      <section className="rounded-3xl bg-white/80 p-6 shadow-lg backdrop-blur sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
          Family Size Vault
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
          Keep your family planning info in one secure place.
        </h1>

        {!user ? (
          <>
            <p className="mt-4 text-sm leading-relaxed text-slate-700 sm:text-base">
              Sign in to manage your profile, children, and family group.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              Go to Login
            </Link>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm text-slate-700">{user.email}</p>

            <div className="mt-6 grid grid-cols-1 gap-3">
              <Link
                href="/me"
                className="inline-flex w-full items-center justify-center rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                My Profile
              </Link>
              <Link
                href="/group"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                Family Group
              </Link>

              {!hasFamilyGroup ? (
                <>
                  <Link
                    href="/group?mode=create"
                    className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    Create a Family Group
                  </Link>
                  <Link
                    href="/group?mode=join"
                    className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    Join a Family Group
                  </Link>
                </>
              ) : null}
            </div>

            <div className="mt-4">
              <SignOutButton />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
