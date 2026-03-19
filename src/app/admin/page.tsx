import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import AdminDashboard from "./AdminDashboard";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

export type SubmissionRow = {
  id: number;
  submitted_at: string;
  student_id: string;
  task_number: 1 | 2;
  lab_label: string | null;
  message_prefix_used: string;
  message_used: string;
  is_valid: boolean;
  verification_stage: string | null;
  verification_message: string | null;
  raw_error: string | null;
  student_public_key_pem: string | null;
  ca_public_key_pem: string | null;
  student_private_key_pem: string | null;
  ca_private_key_pem: string | null;
  expected_task1_signature_text: string | null;
  expected_task2_certificate_signature_text: string | null;
  certificate_data_text: string | null;
  submitted_signature_text: string | null;
  certificate_signature_text: string | null;
  certificate_encoding_used: string | null;
};

async function getData(): Promise<SubmissionRow[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("submissions")
    .select(
      `
        id,
        submitted_at,
        student_id,
        task_number,
        lab_label,
        message_prefix_used,
        message_used,
        is_valid,
        verification_stage,
        verification_message,
        raw_error,
        student_public_key_pem,
        ca_public_key_pem,
        student_private_key_pem,
        ca_private_key_pem,
        expected_task1_signature_text,
        expected_task2_certificate_signature_text,
        certificate_data_text,
        submitted_signature_text,
        certificate_signature_text,
        certificate_encoding_used
      `,
    )
    .order("submitted_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SubmissionRow[];
}

export default async function AdminPage() {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("Missing ADMIN_PASSWORD");
  }

  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_auth")?.value;

  if (adminCookie !== expected) {
    redirect("/admin/login");
  }

  const rows = await getData();

  return (
    <main className="min-h-screen bg-[#0b0b0c] text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
              Facilitator Dashboard
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Lab Quiz Submissions
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              Review all recorded submissions. The latest submission for each
              student and task is the one that currently counts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/admin/settings"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
            >
              Lab Settings
            </a>

            <form action="/admin/logout" method="post">
              <button
                type="submit"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                Logout
              </button>
            </form>
          </div>
        </div>

        <AdminDashboard rows={rows} />
      </div>
    </main>
  );
}
