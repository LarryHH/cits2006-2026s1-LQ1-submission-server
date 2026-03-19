"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SubmissionRow } from "./page";

type SortField = "submitted_at" | "student_id" | "task_number";
type SortDir = "asc" | "desc";

type LabFilter = "all" | string;
type CountFilter = "all" | "counted" | "old";
type ValidityFilter = "all" | "valid" | "invalid";
type TaskFilter = "all" | "1" | "2";

type PopoverState = {
  rowId: number;
  field: string;
  value: string;
  label: string;
  anchorX: number;
  anchorTop: number;
  anchorBottom: number;
  x: number;
  y: number;
} | null;

function truncateCell(value: string, head = 16) {
  if (!value) return "";
  if (value.length <= head) return value;
  return `${value.slice(0, head)}...`;
}

function countedKey(row: SubmissionRow) {
  return `${row.student_id}::${row.task_number}`;
}

function getLatestByStudentAndTask(rows: SubmissionRow[]) {
  const latestMap = new Map<string, SubmissionRow>();

  const rowsByLatestTime = [...rows].sort((a, b) => {
    const tA = new Date(a.submitted_at).getTime();
    const tB = new Date(b.submitted_at).getTime();
    return tB - tA;
  });

  for (const row of rowsByLatestTime) {
    const key = countedKey(row);
    if (!latestMap.has(key)) {
      latestMap.set(key, row);
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

function taskLabel(taskNumber: 1 | 2) {
  return taskNumber === 1 ? "Task 1" : "Task 2";
}

function stageLabel(stage: string | null) {
  if (!stage) return "—";

  const map: Record<string, string> = {
    task1_signature: "Task 1 signature",
    task2_signature: "Task 2 signature",
    certificate_signature: "Certificate signature",
    certificate_student_id: "Certificate student ID",
    student_public_key_parse: "Student public key parse",
    student_private_key_parse: "Student private key parse",
    student_key_pair_match: "Student key pair match",
    ca_public_key_parse: "CA public key parse",
    ca_private_key_parse: "CA private key parse",
    ca_key_pair_match: "CA key pair match",
    task1_internal: "Task 1 internal",
    task2_internal: "Task 2 internal",
    student_id: "Student ID",
  };

  return map[stage] ?? stage;
}

function safeValue(value: string | null | undefined) {
  return value ?? "";
}

export default function AdminDashboard({ rows }: { rows: SubmissionRow[] }) {
  const [search, setSearch] = useState("");
  const [labFilter, setLabFilter] = useState<LabFilter>("all");
  const [countFilter, setCountFilter] = useState<CountFilter>("all");
  const [validityFilter, setValidityFilter] = useState<ValidityFilter>("all");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [sortField, setSortField] = useState<SortField>("submitted_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [popover, setPopover] = useState<PopoverState>(null);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const latestByStudentAndTask = useMemo(
    () => getLatestByStudentAndTask(rows),
    [rows],
  );

  const countedRows = useMemo(
    () => Array.from(latestByStudentAndTask.values()),
    [latestByStudentAndTask],
  );

  const labLabelOptions = useMemo(() => {
    const labels = Array.from(
      new Set(
        rows
          .map((row) => row.lab_label?.trim())
          .filter((label): label is string => Boolean(label)),
      ),
    );

    labels.sort((a, b) => a.localeCompare(b));
    return labels;
  }, [rows]);

  const totalSubmissions = rows.length;
  const countedTask1 = countedRows.filter((r) => r.task_number === 1).length;
  const countedTask2 = countedRows.filter((r) => r.task_number === 2).length;
  const countedValid = countedRows.filter((r) => r.is_valid).length;
  const countedInvalid = countedRows.filter((r) => !r.is_valid).length;

  const filteredRows = useMemo(() => {
    const q = search.trim();

    let out = rows;

    if (q) {
      out = out.filter((row) => row.student_id.includes(q));
    }

    if (labFilter !== "all") {
      out = out.filter((row) => row.lab_label === labFilter);
    }

    if (taskFilter !== "all") {
      const taskNum = Number(taskFilter);
      out = out.filter((row) => row.task_number === taskNum);
    }

    if (countFilter !== "all") {
      out = out.filter((row) => {
        const countedRow = latestByStudentAndTask.get(countedKey(row));
        const isCounted = countedRow?.id === row.id;
        return countFilter === "counted" ? isCounted : !isCounted;
      });
    }

    if (validityFilter !== "all") {
      out = out.filter((row) =>
        validityFilter === "valid" ? row.is_valid : !row.is_valid,
      );
    }

    out = [...out].sort((a, b) => {
      if (sortField === "student_id") {
        const cmp = a.student_id.localeCompare(b.student_id);
        return sortDir === "asc" ? cmp : -cmp;
      }

      if (sortField === "task_number") {
        const cmp = a.task_number - b.task_number;
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
    labFilter,
    countFilter,
    validityFilter,
    taskFilter,
    sortField,
    sortDir,
    latestByStudentAndTask,
  ]);

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(
        field === "student_id" || field === "task_number" ? "asc" : "desc",
      );
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
    const margin = 16;
    const popoverWidth = 380;

    const x = Math.max(
      margin,
      Math.min(rect.left, window.innerWidth - popoverWidth - margin),
    );

    setCopied(false);
    setPopover({
      rowId,
      field,
      label,
      value,
      anchorX: x,
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
      x,
      y: rect.bottom + 8,
    });
  }

  useLayoutEffect(() => {
    if (!popover || !popoverRef.current) return;

    const margin = 16;
    const node = popoverRef.current;
    const rect = node.getBoundingClientRect();

    let nextX = popover.anchorX;
    let nextY = popover.anchorBottom + 8;

    if (nextX + rect.width > window.innerWidth - margin) {
      nextX = window.innerWidth - rect.width - margin;
    }
    if (nextX < margin) {
      nextX = margin;
    }

    const spaceBelow = window.innerHeight - popover.anchorBottom;
    const spaceAbove = popover.anchorTop;

    if (spaceBelow < rect.height + 8 && spaceAbove > spaceBelow) {
      nextY = popover.anchorTop - rect.height - 8;
    }

    if (nextY + rect.height > window.innerHeight - margin) {
      nextY = window.innerHeight - rect.height - margin;
    }
    if (nextY < margin) {
      nextY = margin;
    }

    if (nextX !== popover.x || nextY !== popover.y) {
      setPopover((prev) =>
        prev
          ? {
              ...prev,
              x: nextX,
              y: nextY,
            }
          : prev,
      );
    }
  }, [popover]);

  function renderPopoverCell(
    label: string,
    rowId: number,
    field: string,
    value: string | null,
    maxWidth = "max-w-[160px]",
  ) {
    const safe = safeValue(value);

    if (!safe) {
      return <span className="text-zinc-500">—</span>;
    }

    return (
      <button
        type="button"
        onClick={(e) => openPopover(e, rowId, field, label, safe)}
        className={`${maxWidth} text-left font-mono text-zinc-300 transition hover:text-white`}
        title="Click to view full value"
      >
        <span
          className={`block ${maxWidth} overflow-hidden text-ellipsis whitespace-nowrap`}
        >
          {truncateCell(safe)}
        </span>
      </button>
    );
  }

  async function handleCopyPopoverValue() {
    if (!popover) return;

    try {
      await navigator.clipboard.writeText(popover.value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
            Counted Task 1
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {countedTask1}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
          <div className="text-sm font-medium text-zinc-400">
            Counted Task 2
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {countedTask2}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/30 p-5">
          <div className="text-sm font-medium text-emerald-300">
            Counted valid
          </div>
          <div className="mt-2 text-3xl font-semibold text-emerald-200">
            {countedValid}
          </div>
        </div>

        <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-5">
          <div className="text-sm font-medium text-red-300">
            Counted invalid
          </div>
          <div className="mt-2 text-3xl font-semibold text-red-200">
            {countedInvalid}
          </div>
        </div>
      </div>

      <div className="mb-3 text-sm text-zinc-400">
        Rows marked <span className="font-medium text-zinc-200">Counted</span>{" "}
        are the latest submissions for each student and task.
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

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={labFilter}
            onChange={(e) => setLabFilter(e.target.value)}
            className="min-w-[170px] rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
          >
            <option value="all">All labs</option>
            {labLabelOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={taskFilter}
            onChange={(e) => setTaskFilter(e.target.value as TaskFilter)}
            className="min-w-[150px] rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
          >
            <option value="all">All tasks</option>
            <option value="1">Task 1</option>
            <option value="2">Task 2</option>
          </select>

          <select
            value={countFilter}
            onChange={(e) => setCountFilter(e.target.value as CountFilter)}
            className="min-w-[150px] rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
          >
            <option value="all">All rows</option>
            <option value="counted">Counted only</option>
            <option value="old">Old only</option>
          </select>

          <select
            value={validityFilter}
            onChange={(e) =>
              setValidityFilter(e.target.value as ValidityFilter)
            }
            className="min-w-[150px] rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
          >
            <option value="all">All results</option>
            <option value="valid">Valid only</option>
            <option value="invalid">Invalid only</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/90 shadow-2xl shadow-black/30">
        <div className="custom-scrollbar overflow-x-auto">
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
                  Lab
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  <button
                    type="button"
                    onClick={() => toggleSort("task_number")}
                    className="inline-flex items-center transition hover:text-white"
                  >
                    Task
                    {sortIndicator("task_number", sortField, sortDir)}
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
                  Result
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Verification Stage
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Prefix Used
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Message Used
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Student Public Key
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Student Private Key
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  CA Public Key
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  CA Private Key
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Certificate Data
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Submitted Signature
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Task 1 Expected Signature
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Submitted Certificate Signature
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-300">
                  Task 2 Expected Certificate Signature
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => {
                const countedRow = latestByStudentAndTask.get(countedKey(row));
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

                    <td className="px-4 py-3">
                      {renderPopoverCell(
                        "Lab Label",
                        row.id,
                        "lab_label",
                        row.lab_label,
                        "max-w-[140px]",
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-zinc-300">
                      {taskLabel(row.task_number)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-zinc-300">
                      {new Date(row.submitted_at).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          row.is_valid
                            ? "bg-emerald-950/70 text-emerald-300 ring-1 ring-emerald-900"
                            : "bg-red-950/70 text-red-300 ring-1 ring-red-900"
                        }`}
                      >
                        {row.is_valid ? "Valid" : "Invalid"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-zinc-300">
                      {stageLabel(row.verification_stage)}
                    </td>

                    <td className="px-4 py-3">
                      {renderPopoverCell(
                        "Prefix Used",
                        row.id,
                        "message_prefix_used",
                        row.message_prefix_used,
                        "max-w-[130px]",
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {renderPopoverCell(
                        "Message Used",
                        row.id,
                        "message_used",
                        row.message_used,
                        "max-w-[160px]",
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {renderPopoverCell(
                        "Student Public Key",
                        row.id,
                        "student_public_key_pem",
                        row.student_public_key_pem,
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {renderPopoverCell(
                        "Student Private Key",
                        row.id,
                        "student_private_key_pem",
                        row.student_private_key_pem,
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {renderPopoverCell(
                        "CA Public Key",
                        row.id,
                        "ca_public_key_pem",
                        row.ca_public_key_pem,
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {renderPopoverCell(
                        "CA Private Key",
                        row.id,
                        "ca_private_key_pem",
                        row.ca_private_key_pem,
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {renderPopoverCell(
                        "Certificate Data",
                        row.id,
                        "certificate_data_text",
                        row.certificate_data_text,
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {renderPopoverCell(
                        row.task_number === 1
                          ? "Submitted Signature"
                          : "Message Signature",
                        row.id,
                        "submitted_signature_text",
                        row.submitted_signature_text,
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {row.task_number === 1 ? (
                        renderPopoverCell(
                          "Expected Task 1 Signature",
                          row.id,
                          "expected_task1_signature_text",
                          row.expected_task1_signature_text,
                        )
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {row.task_number === 2 ? (
                        renderPopoverCell(
                          "Certificate Signature",
                          row.id,
                          "certificate_signature_text",
                          row.certificate_signature_text,
                        )
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {row.task_number === 2 ? (
                        renderPopoverCell(
                          "Expected Task 2 Certificate Signature",
                          row.id,
                          "expected_task2_certificate_signature_text",
                          row.expected_task2_certificate_signature_text,
                        )
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={18}
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
            ref={popoverRef}
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

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPopoverValue}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
                >
                  {copied ? "Copied" : "Copy"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPopover(null);
                    setCopied(false);
                  }}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="custom-scrollbar max-h-[320px] overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 font-mono text-sm leading-6 text-zinc-200">
              <span className="break-all whitespace-pre-wrap">
                {popover.value}
              </span>
            </div>
          </div>
        </>
      )}
    </>
  );
}