import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';

async function getData() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('submissions')
    .select('id, submitted_at, student_id, submitted_signature, is_correct')
    .order('submitted_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export default async function AdminPage() {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error('Missing ADMIN_PASSWORD');
  }

  const cookieStore = await cookies();
  const adminCookie = cookieStore.get('admin_auth')?.value;

  if (adminCookie !== expected) {
    redirect('/admin/login');
  }

  const rows = await getData();
  const total = rows.length;
  const correct = rows.filter((r) => r.is_correct).length;
  const incorrect = total - correct;

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl rounded-xl bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">Facilitator Dashboard</h1>
          <form action="/admin/logout" method="post">
            <button
              type="submit"
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium"
            >
              Logout
            </button>
          </form>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <div className="rounded-lg bg-gray-100 px-4 py-3 font-medium">
            Total: {total}
          </div>
          <div className="rounded-lg bg-gray-100 px-4 py-3 font-medium">
            Correct: {correct}
          </div>
          <div className="rounded-lg bg-gray-100 px-4 py-3 font-medium">
            Incorrect: {incorrect}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Student ID</th>
                <th className="px-3 py-2 text-left">Signature</th>
                <th className="px-3 py-2 text-left">Correct</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b align-top">
                  <td className="px-3 py-2">
                    {new Date(row.submitted_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{row.student_id}</td>
                  <td className="px-3 py-2">{row.submitted_signature}</td>
                  <td className="px-3 py-2">{row.is_correct ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
