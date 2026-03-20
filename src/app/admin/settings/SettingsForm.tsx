"use client";

import { useEffect, useState } from "react";

type LabSettings = {
  id: number;
  label: string;
  task_1_message_prefix: string;
  task_2_message_prefix: string;
  opens_at: string | null;
  closes_at: string | null;
  is_active: boolean;
  created_at: string;
};

function toDatetimeLocalValue(value: string | null) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");

  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function localDatetimeToIso(value: string): string | null {
  if (!value.trim()) return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return null;
  }

  return d.toISOString();
}

async function parseApiResponse(res: Response) {
  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();

  if (!contentType.includes("application/json")) {
    throw new Error(
      `Lab settings API returned non-JSON response (${res.status}). Check /api/admin/lab-settings.`,
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Lab settings API returned invalid JSON.");
  }
}

export default function SettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [id, setId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [task1Prefix, setTask1Prefix] = useState("");
  const [task2Prefix, setTask2Prefix] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(
    null,
  );

  useEffect(() => {
    async function load() {
      try {
        setMessage(null);
        setMessageType(null);

        const res = await fetch("/api/admin/lab-settings", {
          method: "GET",
          cache: "no-store",
        });

        const data = await parseApiResponse(res);

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to load lab settings.");
        }

        const row: LabSettings | null = data.labSettings;

        if (row) {
          setId(row.id);
          setLabel(row.label ?? "");
          setTask1Prefix(row.task_1_message_prefix ?? "");
          setTask2Prefix(row.task_2_message_prefix ?? "");
          setOpensAt(toDatetimeLocalValue(row.opens_at));
          setClosesAt(toDatetimeLocalValue(row.closes_at));
          setIsActive(Boolean(row.is_active));
        }
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Failed to load lab settings.",
        );
        setMessageType("error");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setMessageType(null);

    try {
      const res = await fetch("/api/admin/lab-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          label,
          task_1_message_prefix: task1Prefix,
          task_2_message_prefix: task2Prefix,
          opens_at: localDatetimeToIso(opensAt),
          closes_at: localDatetimeToIso(closesAt),
          is_active: isActive,
        }),
      });

      const data = await parseApiResponse(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save lab settings.");
      }

      const row: LabSettings = data.labSettings;

      setId(row.id);
      setLabel(row.label ?? "");
      setTask1Prefix(row.task_1_message_prefix ?? "");
      setTask2Prefix(row.task_2_message_prefix ?? "");
      setOpensAt(toDatetimeLocalValue(row.opens_at));
      setClosesAt(toDatetimeLocalValue(row.closes_at));
      setIsActive(Boolean(row.is_active));

      setMessage("Lab settings saved.");
      setMessageType("success");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to save lab settings.",
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 text-zinc-400">
        Loading lab settings...
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 shadow-2xl shadow-black/30"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-zinc-200">
            Lab Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
            placeholder="e.g. Lab Quiz 1"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200">
            Task 1 Message Prefix
          </label>
          <input
            type="text"
            value={task1Prefix}
            onChange={(e) => setTask1Prefix(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200">
            Task 2 Message Prefix
          </label>
          <input
            type="text"
            value={task2Prefix}
            onChange={(e) => setTask2Prefix(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200">
            Opens At
          </label>
          <input
            type="datetime-local"
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200">
            Closes At
          </label>
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
          />
        </div>

        <div className="md:col-span-2">
          <label className="inline-flex items-center gap-3 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
            />
            Mark this lab configuration as active
          </label>
        </div>
      </div>

      {message && (
        <div
          className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
            messageType === "success"
              ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-200"
              : "border-red-900/60 bg-red-950/30 text-red-200"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-6 flex items-center justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl border border-zinc-700 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </form>
  );
}
