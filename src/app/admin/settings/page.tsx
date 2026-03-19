import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import SettingsForm from "./SettingsForm";

export const metadata: Metadata = {
  title: "Lab Settings",
};

export default async function AdminSettingsPage() {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("Missing ADMIN_PASSWORD");
  }

  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_auth")?.value;

  if (adminCookie !== expected) {
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen bg-[#0b0b0c] text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
              Facilitator Dashboard
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Lab Settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Configure the active lab, task message prefixes, and submission window.
            </p>
          </div>

          <a
            href="/admin"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            Back to Dashboard
          </a>
        </div>

        <SettingsForm />
      </div>
    </main>
  );
}