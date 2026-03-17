"use client";

import { useMemo, useState } from "react";

type SubmissionRow = {
  id: number;
  submitted_at: string;
  student_id: string;
  public_key: string;
  private_key: string;
  submitted_signature: string;
  expected_signature: string;
  is_correct: boolean;
};

type SortField = "submitted_at" | "student_id";
type SortDir = "asc" | "desc";

type PopoverState = {
  rowId: number;
  field: string;
  value: string;
  label: string;
  x: number;
  y: number;
} | null;

function truncateCell(value: string, head = 6) {
  if (!value) return "";
  if (value.length <= head) return value;
  return `${value.slice(0, head)}...`;
}

function getLatestByStudent(rows: SubmissionRow[]) {
  const latestMap = new Map<string, SubmissionRow>();

  const rowsByLatestTime = [...rows].sort((a, b) => {
    const tA = new Date(a.submitted_at).getTime();
    const tB = new Date(b.submitted_at).getTime();
    return tB - tA;
  });

  for (const row of rowsByLatestTime) {
    if (!latestMap.has(row.student_id)) {
      latestMap.set(row.student_id, row);
    }
  }

  return latestMap;
}

function sortIndicator(
  field: SortField,
  currentField: SortField,
  currentDir: SortDir,
) {
  if (field !== currentField) {
    return <span className="ml-2 text-zinc-500">↕</span>;
  }
  return (
    <span className="ml-2 text-zinc-200">
      {currentDir === "asc" ? "↑" : "↓"}
    </span>
  );
}

export default function AdminDashboard({ rows }: { rows: SubmissionRow[] }) {
  const [search, setSearch] = useState("");
  const [countFilter, setCountFilter] = useState<"all" | "counted" | "old">(
    "all",
  );
  const [correctnessFilter, setCorrectnessFilter] = useState<
    "all" | "correct" | "incorrect"
  >("all");
  const [sortField, setSortField] = useState<SortField>("submitted_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [popover, setPopover] = useState<PopoverState>(null);

  const latestByStudent = useMemo(() => getLatestByStudent(rows), [rows]);
  const latestRows = useMemo(
    () => Array.from(latestByStudent.values()),
    [latestByStudent],
  );

  const totalSubmissions = rows.length;
  const uniqueStudents = latestRows.length;
  const countedCorrect = latestRows.filter((r) => r.is_correct).length;
  const countedIncorrect = latestRows.filter((r) => !r.is_correct).length;
  const filteredRows = useMemo(() => {
    const q = search.trim();

    let out = rows;
    if (q) {
      out = rows.filter((row) => row.student_id.includes(q));
    }

    if (countFilter !== "all") {
      out = out.filter((row) => {
        const countedRow = latestByStudent.get(row.student_id);
        const isCounted = countedRow?.id === row.id;
        return countFilter === "counted" ? isCounted : !isCounted;
      });
    }

    if (correctnessFilter !== "all") {
      out = out.filter((row) =>
        correctnessFilter === "correct" ? row.is_correct : !row.is_correct,
      );
    }

    out = [...out].sort((a, b) => {
      if (sortField === "student_id") {
        const cmp = a.student_id.localeCompare(b.student_id);
        return sortDir === "asc" ? cmp : -cmp;
      }

      const tA = new Date(a.submitted_at).getTime();
      const tB = new Date(b.submitted_at).getTime();
      return sortDir === "asc" ? tA - tB : tB - tA;
    });

    return out;
  }, [
    rows,
    search,
    countFilter,
    correctnessFilter,
    sortField,
    sortDir,
    latestByStudent,
  ]);

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "student_id" ? "asc" : "desc");
    }
  }

  function openPopover(
    e: React.MouseEvent<HTMLButtonElement>,
    rowId: number,
    field: string,
    label: string,
    value: string,
  ) {
    const rect = e.currentTarget.getBoundingClientRect();

    setPopover({
      rowId,
      field,
      label,
      value,
      x: Math.min(rect.left, window.innerWidth - 420),
      y: rect.bottom + 8,
    });
  }

  function renderPopoverCell(
    eLabel: string,
    rowId: number,
    field: string,
    value: string,
  ) {
    return (
      <button
        type="button"
        onClick={(e) => openPopover(e, rowId, field, eLabel, value)}
        className="max-w-[120px] text-left font-mono text-zinc-300 transition hover:text-white"
        title="Click to view full value"
      >
        <span className="block max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
          {truncateCell(value)}
        </span>
      </button>
    );
  }

  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
          <div className="text-sm font-medium text-zinc-400">
            Total submissions
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {totalSubmissions}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
          <div className="text-sm font-medium text-zinc-400">
            Unique students
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {uniqueStudents}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/30 p-5">
          <div className="text-sm font-medium text-emerald-300">
            Counted correct
          </div>
          <div className="mt-2 text-3xl font-semibold text-emerald-200">
            {countedCorrect}
          </div>
        </div>

        <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-5">
          <div className="text-sm font-medium text-red-300">
            Counted incorrect
          </div>
          <div className="mt-2 text-3xl font-semibold text-red-200">
            {countedIncorrect}
          </div>
        </div>
      </div>

      <div className="mb-3 text-sm text-zinc-400">
        Rows marked <span className="font-medium text-zinc-200">Counted</span>{" "}
        are the latest submissions for each student and are the ones that
        currently count.
      </div>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) =>
            setSearch(e.target.value.replace(/\D/g, "").slice(0, 8))
          }
          placeholder="Search student ID..."
          className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
        />

        <div className="flex flex-wrap items-center gap-8">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCountFilter("all")}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                countFilter === "all"
                  ? "border-white bg-white text-black"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              All rows
            </button>

            <button
              type="button"
              onClick={() => setCountFilter("counted")}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                countFilter === "counted"
                  ? "border-blue-300 bg-blue-300 text-black"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              Counted only
            </button>

            <button
              type="button"
              onClick={() => setCountFilter("old")}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                countFilter === "old"
                  ? "border-zinc-300 bg-zinc-300 text-black"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              Old only
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCorrectnessFilter("all")}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                correctnessFilter === "all"
                  ? "border-white bg-white text-black"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              All results
            </button>

            <button
              type="button"
              onClick={() => setCorrectnessFilter("correct")}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                correctnessFilter === "correct"
                  ? "border-emerald-300 bg-emerald-300 text-black"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              Correct only
            </button>

            <button
              type="button"
              onClick={() => setCorrectnessFilter("incorrect")}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                correctnessFilter === "incorrect"
                  ? "border-red-300 bg-red-300 text-black"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              Incorrect only
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/90 shadow-2xl shadow-black/30">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-900/80">
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Counted
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  <button
                    type="button"
                    onClick={() => toggleSort("student_id")}
                    className="inline-flex items-center transition hover:text-white"
                  >
                    Student ID
                    {sortIndicator("student_id", sortField, sortDir)}
                  </button>
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  <button
                    type="button"
                    onClick={() => toggleSort("submitted_at")}
                    className="inline-flex items-center transition hover:text-white"
                  >
                    Submission Time
                    {sortIndicator("submitted_at", sortField, sortDir)}
                  </button>
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Public Key
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Private Key
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Submitted Signature
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Expected Signature
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Correct
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => {
                const countedRow = latestByStudent.get(row.student_id);
                const isCounted = countedRow?.id === row.id;

                return (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-900 align-top transition hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-3">
                      {isCounted ? (
                        <span className="inline-flex rounded-full bg-blue-950/70 px-2.5 py-1 text-xs font-medium text-blue-300 ring-1 ring-blue-900">
                          Counted
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-400 ring-1 ring-zinc-800">
                          Old
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-medium text-white">
                      {row.student_id}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-zinc-300">
                      {new Date(row.submitted_at).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      {renderPopoverCell(
                        "Public Key",
                        row.id,
                        "public_key",
                        row.public_key,
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {renderPopoverCell(
                        "Private Key",
                        row.id,
                        "private_key",
                        row.private_key,
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {renderPopoverCell(
                        "Submitted Signature",
                        row.id,
                        "submitted_signature",
                        row.submitted_signature,
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {renderPopoverCell(
                        "Expected Signature",
                        row.id,
                        "expected_signature",
                        row.expected_signature,
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          row.is_correct
                            ? "bg-emerald-950/70 text-emerald-300 ring-1 ring-emerald-900"
                            : "bg-red-950/70 text-red-300 ring-1 ring-red-900"
                        }`}
                      >
                        {row.is_correct ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-zinc-500"
                  >
                    No matching submissions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {popover && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setPopover(null)}
          />

          <div
            className="fixed z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-700 bg-zinc-950 p-4 shadow-2xl shadow-black/40"
            style={{
              left: popover.x,
              top: popover.y,
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="text-sm font-semibold text-white">
                {popover.label}
              </div>
              <button
                type="button"
                onClick={() => setPopover(null)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
              >
                Close
              </button>
            </div>

            <div className="custom-scrollbar max-h-[320px] overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 font-mono text-sm leading-6 text-zinc-200">
              <span className="break-all">{popover.value}</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
