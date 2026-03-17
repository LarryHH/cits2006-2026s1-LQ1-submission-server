"use client";

import { FormEvent, useState } from "react";

export default function HomePage() {
  const [studentId, setStudentId] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [signature, setSignature] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<
    "success" | "error" | "warning" | null
  >(null);
  const [loading, setLoading] = useState(false);

  const [showConfirmBox, setShowConfirmBox] = useState(false);
  const [previousSubmittedAt, setPreviousSubmittedAt] = useState<string | null>(
    null,
  );

  async function submit(confirmResubmission: boolean) {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        publicKey,
        privateKey,
        signature,
        confirmResubmission,
      }),
    });

    const data = await res.json();
    return data;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setMessageType(null);
    setShowConfirmBox(false);
    setPreviousSubmittedAt(null);

    if (!/^[0-9]{8}$/.test(studentId)) {
      setMessage("Student ID must be exactly 8 digits.");
      setMessageType("error");
      setLoading(false);
      return;
    }

    if (!publicKey.trim()) {
      setMessage("Public key is required.");
      setMessageType("error");
      setLoading(false);
      return;
    }

    if (!privateKey.trim()) {
      setMessage("Private key is required.");
      setMessageType("error");
      setLoading(false);
      return;
    }

    if (!signature.trim()) {
      setMessage("Signature is required.");
      setMessageType("error");
      setLoading(false);
      return;
    }

    try {
      const data = await submit(false);

      if (!data.ok) {
        setMessage(data.error ?? "Submission failed.");
        setMessageType("error");
        return;
      }

      if (data.needsConfirmation) {
        setPreviousSubmittedAt(data.previousSubmittedAt ?? null);
        setShowConfirmBox(true);
        setMessage("A previous submission already exists for this student ID.");
        setMessageType("warning");
        return;
      }

      setMessage("Submission received.");
      setMessageType("success");
      setStudentId("");
      setSignature("");
      setPublicKey("");
      setPrivateKey("");
    } catch {
      setMessage("Network or server error.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmResubmission() {
    setLoading(true);
    setMessage(null);
    setMessageType(null);

    try {
      const data = await submit(true);

      if (!data.ok) {
        setMessage(data.error ?? "Submission failed.");
        setMessageType("error");
        return;
      }

      setShowConfirmBox(false);
      setPreviousSubmittedAt(null);
      setMessage(
        "Submission received at " + formatTimestamp(new Date().toISOString()),
      );
      setMessageType("success");
      setStudentId("");
      setSignature("");
    } catch {
      setMessage("Network or server error.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  function formatTimestamp(ts: string | null) {
    if (!ts) return "";
    return new Date(ts).toLocaleString();
  }

  return (
    <main className="min-h-screen bg-[#0b0b0c] text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="flex flex-col justify-center">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                CITS2006 Lab Quiz 1, S1 2026
              </div>

              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Lab Quiz 1 Submission
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
                Enter your student ID and the computed signature for your quiz
                task. Your submission will be recorded after validation.
              </p>

              <p className="mt-2 text-sm leading-6 text-white">
                <b>Note:</b> The latest submission before the deadline counts.
              </p>

              <div className="mt-8 grid max-w-xl gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="text-sm font-medium text-zinc-200">
                    Student ID
                  </div>
                  <div className="mt-1 text-sm leading-6 text-zinc-400">
                    Must be exactly 8 digits.
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="text-sm font-medium text-zinc-200">
                    Keys and Signature
                  </div>
                  <div className="mt-1 text-sm leading-6 text-zinc-400">
                    Submit both keys and the signature you computed for your
                    student ID.
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section>
            <div className="w-full rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-2xl shadow-black/30 sm:p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-white">Submit</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Fill in all fields exactly as required.
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="studentId"
                    className="mb-2 block text-sm font-medium text-zinc-200"
                  >
                    Student ID
                  </label>
                  <input
                    id="studentId"
                    type="text"
                    value={studentId}
                    onChange={(e) =>
                      setStudentId(
                        e.target.value.replace(/\D/g, "").slice(0, 8),
                      )
                    }
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="12345678"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="publicKey"
                      className="mb-2 block text-sm font-medium text-zinc-200"
                    >
                      Public Key
                    </label>
                    <input
                      id="publicKey"
                      type="text"
                      value={publicKey}
                      onChange={(e) => setPublicKey(e.target.value)}
                      placeholder="Enter public key"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="privateKey"
                      className="mb-2 block text-sm font-medium text-zinc-200"
                    >
                      Private Key
                    </label>
                    <input
                      id="privateKey"
                      type="text"
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      placeholder="Enter private key"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signature"
                    className="mb-2 block text-sm font-medium text-zinc-200"
                  >
                    Signature
                  </label>
                  <input
                    id="signature"
                    type="text"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    required
                    placeholder="Enter computed signature"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-white px-4 py-3 text-base font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Submitting..." : "Submit"}
                </button>
              </form>

              {message && (
                <div
                  className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-6 ${
                    messageType === "success"
                      ? "border-emerald-900 bg-emerald-950/50 text-emerald-300"
                      : messageType === "warning"
                        ? "border-amber-900 bg-amber-950/40 text-amber-300"
                        : "border-red-900 bg-red-950/50 text-red-300"
                  }`}
                >
                  {message}
                </div>
              )}

              {showConfirmBox && (
                <div className="mt-4 rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200">
                  <p className="leading-6">
                    A previous submission already exists for{" "}
                    <span className="font-semibold">{studentId}</span>
                    {previousSubmittedAt ? (
                      <>
                        {" "}
                        at{" "}
                        <span className="font-semibold">
                          {formatTimestamp(previousSubmittedAt)}
                        </span>
                      </>
                    ) : null}
                    .
                  </p>

                  <p className="mt-2 leading-6 text-amber-300">
                    The latest submission before the deadline counts. Do you
                    want to submit another response?
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleConfirmResubmission}
                      disabled={loading}
                      className="rounded-xl bg-amber-300 px-4 py-2 font-medium text-black transition hover:bg-amber-200 disabled:opacity-60"
                    >
                      {loading ? "Submitting..." : "Yes, submit again"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowConfirmBox(false);
                        setPreviousSubmittedAt(null);
                        setMessage(null);
                        setMessageType(null);
                      }}
                      disabled={loading}
                      className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
