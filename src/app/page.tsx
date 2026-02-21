import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10 sm:max-w-lg">
      <section className="rounded-3xl bg-white/80 p-6 shadow-lg backdrop-blur sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
          Family Size Vault
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
          Keep your family planning info in one secure place.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-700 sm:text-base">
          Mobile-first by design. Install this app to your home screen and use it
          like a native app.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          Sign in
        </Link>
      </section>
    </main>
  );
}
