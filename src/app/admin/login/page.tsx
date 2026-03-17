import { loginAdmin } from './actions';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = params.error === '1';

  return (
    <main className="min-h-screen bg-[#0b0b0c] text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="flex flex-col justify-center">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                Facilitator Access
              </div>

              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Admin Login
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
                Sign in with the shared facilitator password to view lab quiz
                submissions and progress.
              </p>
            </div>
          </section>

          <section>
            <div className="w-full rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 shadow-2xl shadow-black/30 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white">Login</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Enter the facilitator password to continue.
                </p>
              </div>

              <form action={loginAdmin} className="space-y-5">
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-zinc-200"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-white px-4 py-3 text-base font-medium text-black transition hover:bg-zinc-200"
                >
                  Login
                </button>
              </form>

              {hasError && (
                <div className="mt-5 rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm leading-6 text-red-300">
                  Incorrect password.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}