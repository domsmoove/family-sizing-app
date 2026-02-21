import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AcceptInvitePageProps = {
  searchParams?: Promise<{
    token?: string;
    error?: string;
  }>;
};

async function acceptInviteAction(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "").trim();
  if (!token) {
    redirect("/accept-invite?error=Invite%20token%20is%20required.");
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login`);
  }

  await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id" });

  const { error } = await supabase.rpc("accept_family_invite", {
    invite_token: token
  });

  if (error) {
    redirect(`/accept-invite?token=${encodeURIComponent(token)}&error=${encodeURIComponent(error.message)}`);
  }

  redirect("/group");
}

export default async function AcceptInvitePage({ searchParams }: AcceptInvitePageProps) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const token = params?.token?.trim() ?? "";
  const error = params?.error;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-5 py-8 sm:max-w-lg">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Accept Family Invite</h1>
        <p className="mt-1 text-sm text-slate-600">{user.email}</p>
      </header>

      <nav className="mt-4">
        <Link
          href="/group"
          className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          Back to Group
        </Link>
      </nav>

      {!token ? (
        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-rose-700">No invite token was provided.</p>
        </section>
      ) : (
        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-700">Token: {token}</p>
          {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}

          <form action={acceptInviteAction} className="mt-4">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              Accept Invite
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
