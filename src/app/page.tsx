"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

type MessageType = "success" | "error" | "warning" | null;
type TaskNumber = "1" | "2";

type FileState = {
  studentPublicKeyFile: File | null;
  studentPrivateKeyFile: File | null;
  signatureFile: File | null;
  caPublicKeyFile: File | null;
  caPrivateKeyFile: File | null;
  certificateSignatureFile: File | null;
};

const initialFiles: FileState = {
  studentPublicKeyFile: null,
  studentPrivateKeyFile: null,
  signatureFile: null,
  caPublicKeyFile: null,
  caPrivateKeyFile: null,
  certificateSignatureFile: null,
};

export default function HomePage() {
  const [studentId, setStudentId] = useState("");
  const [taskNumber, setTaskNumber] = useState<TaskNumber>("1");
  const [files, setFiles] = useState<FileState>(initialFiles);

  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<MessageType>(null);
  const [loading, setLoading] = useState(false);

  const [showConfirmBox, setShowConfirmBox] = useState(false);
  const [previousSubmittedAt, setPreviousSubmittedAt] = useState<string | null>(
    null,
  );
  const [previousTaskNumber, setPreviousTaskNumber] =
    useState<TaskNumber | null>(null);

  const formRef = useRef<HTMLFormElement | null>(null);

  const taskLabel = useMemo(
    () => (taskNumber === "1" ? "Task 1" : "Task 2"),
    [taskNumber],
  );

  function setFile<K extends keyof FileState>(key: K, file: File | null) {
    setFiles((prev) => ({
      ...prev,
      [key]: file,
    }));
  }

  function resetFiles() {
    setFiles(initialFiles);
    if (formRef.current) {
      formRef.current.reset();
    }
  }

  function resetAll() {
    setStudentId("");
    setTaskNumber("1");
    resetFiles();
  }

  function formatTimestamp(ts: string | null) {
    if (!ts) return "";
    return new Date(ts).toLocaleString();
  }

  function validateBeforeSubmit(): string | null {
    if (!/^[0-9]{8}$/.test(studentId)) {
      return "Student ID must be exactly 8 digits.";
    }

    if (taskNumber === "1") {
      if (!files.studentPublicKeyFile) {
        return "Student public key file is required.";
      }
      if (!files.studentPrivateKeyFile) {
        return "Student private key file is required.";
      }
      if (!files.signatureFile) {
        return "Signature file is required.";
      }
    }

    if (taskNumber === "2") {
      if (!files.caPublicKeyFile) {
        return "CA public key file is required.";
      }
      if (!files.caPrivateKeyFile) {
        return "CA private key file is required.";
      }
      if (!files.certificateSignatureFile) {
        return "Certificate signature file is required.";
      }
    }

    return null;
  }

  async function submit(confirmResubmission: boolean) {
    const formData = new FormData();
    formData.append("studentId", studentId);
    formData.append("taskNumber", taskNumber);
    formData.append(
      "confirmResubmission",
      confirmResubmission ? "true" : "false",
    );

    if (taskNumber === "1") {
      if (files.studentPublicKeyFile) {
        formData.append("studentPublicKeyFile", files.studentPublicKeyFile);
      }
      if (files.studentPrivateKeyFile) {
        formData.append("studentPrivateKeyFile", files.studentPrivateKeyFile);
      }
      if (files.signatureFile) {
        formData.append("signatureFile", files.signatureFile);
      }
    }

    if (taskNumber === "2") {
      if (files.caPublicKeyFile) {
        formData.append("caPublicKeyFile", files.caPublicKeyFile);
      }
      if (files.caPrivateKeyFile) {
        formData.append("caPrivateKeyFile", files.caPrivateKeyFile);
      }
      if (files.certificateSignatureFile) {
        formData.append(
          "certificateSignatureFile",
          files.certificateSignatureFile,
        );
      }
    }

    const res = await fetch("/api/submit", {
      method: "POST",
      body: formData,
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
    setPreviousTaskNumber(null);

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setMessage(validationError);
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
        setPreviousTaskNumber(data.previousTaskNumber === 2 ? "2" : "1");
        setShowConfirmBox(true);
        setMessage(
          `A previous submission already exists for ${taskLabel.toLowerCase()}.`,
        );
        setMessageType("warning");
        return;
      }

      setMessage(
        "Submission received at " + formatTimestamp(new Date().toISOString()),
      );
      setMessageType("success");
      resetAll();
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
        // setMessage(data.error ?? "Submission failed.");
        setMessage(
          data.detail
            ? `${data.error ?? "Submission failed."} (${data.detail})`
            : (data.error ?? "Submission failed."),
        );
        setMessageType("error");
        return;
      }

      setShowConfirmBox(false);
      setPreviousSubmittedAt(null);
      setPreviousTaskNumber(null);
      setMessage(
        "Submission received at " + formatTimestamp(new Date().toISOString()),
      );
      setMessageType("success");
      resetAll();
    } catch {
      setMessage("Network or server error.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0b0c] text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
        <div className="grid w-full gap-10 lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.05fr_0.95fr]">
          <section className="flex flex-col justify-center">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                CITS2006 Lab Quiz 1, S1 2026
              </div>

              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Lab Quiz 1 Submission
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
                Select the task you are submitting for, then upload the files
                generated by your program.
              </p>

              <div className="mt-4 max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm leading-6 text-zinc-300">
                <p>
                  <span className="font-semibold text-white">
                    Before you submit:
                  </span>
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-400">
                  <li>Enter your student ID as exactly 8 digits.</li>
                  <li>Upload the files produced for your own student ID.</li>
                  <li>
                    PEM key files should be uploaded as generated by your code.
                  </li>
                  <li>
                    You may resubmit. The latest submission before the close
                    time counts for each task.
                  </li>
                </ul>
              </div>

              <div className="mt-4 max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm leading-6 text-zinc-300">
                <p>
                  <span className="font-semibold text-white">
                    Expected file formats:
                  </span>
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-400">
                  <li>RSA Key Files: PEM format (.pem)</li>
                  <li>Message Signature File: Binary file (.bin)</li>
                  <li>Certificate Signature File: Signature file (.sig)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <div className="w-full rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-2xl shadow-black/30 sm:p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-white">Submit</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Upload exactly one file for each required field. Drag and drop
                  is supported, or you can choose files manually.
                </p>
              </div>

              <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
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

                <div>
                  <label
                    htmlFor="taskNumber"
                    className="mb-2 block text-sm font-medium text-zinc-200"
                  >
                    Task
                  </label>
                  <p className="mb-2 text-xs text-zinc-500">
                    Select the task you are submitting for.
                  </p>
                  <select
                    id="taskNumber"
                    value={taskNumber}
                    onChange={(e) => {
                      const nextTask = e.target.value === "2" ? "2" : "1";
                      setTaskNumber(nextTask);
                      setShowConfirmBox(false);
                      setPreviousSubmittedAt(null);
                      setPreviousTaskNumber(null);
                      setMessage(null);
                      setMessageType(null);
                      resetFiles();
                    }}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-white outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/40"
                  >
                    <option value="1">Task 1</option>
                    <option value="2">Task 2</option>
                  </select>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  {taskNumber === "1" ? (
                    <>
                      <h3 className="text-sm font-semibold text-white">
                        Task 1 instructions
                      </h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-400">
                        <li>
                          Upload your student public key file and matching
                          student private key file.
                        </li>
                        <li>
                          Upload the signature file generated for the required
                          Task 1 message.
                        </li>
                        <li>
                          The public and private key must belong to the same RSA
                          keypair.
                        </li>
                      </ul>
                    </>
                  ) : (
                    <>
                      <h3 className="text-sm font-semibold text-white">
                        Task 2 instructions
                      </h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-400">
                        <li>
                          Upload the CA public key and matching CA private key.
                        </li>
                        <li>
                          Upload the certificate signature file produced using
                          the CA private key.
                        </li>
                        <li>
                          <b>NOTE:</b> Task 2 uses the keys from your <b><i>latest Task 1 submission</i></b> to verify the certificate signature.
                        </li>
                      </ul>
                    </>
                  )}
                </div>

                {taskNumber === "1" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FileInput
                      id="studentPublicKeyFile"
                      label="Student Public Key File"
                      description="PEM-encoded RSA public key generated for your student keypair."
                      accept=".pem,.txt"
                      file={files.studentPublicKeyFile}
                      onChange={(file) => setFile("studentPublicKeyFile", file)}
                    />

                    <FileInput
                      id="studentPrivateKeyFile"
                      label="Student Private Key File"
                      description="PEM-encoded RSA private key matching the uploaded student public key."
                      accept=".pem,.txt"
                      file={files.studentPrivateKeyFile}
                      onChange={(file) =>
                        setFile("studentPrivateKeyFile", file)
                      }
                    />

                    <div className="sm:col-span-2">
                      <FileInput
                        id="signatureFile"
                        label="Signature File"
                        description="Signature produced for the required Task 1 message."
                        accept=".sig,.txt,.bin"
                        file={files.signatureFile}
                        onChange={(file) => setFile("signatureFile", file)}
                      />
                    </div>
                  </div>
                )}

                {taskNumber === "2" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FileInput
                      id="caPublicKeyFile"
                      label="CA Public Key File"
                      description="PEM-encoded RSA public key for the certificate authority."
                      accept=".pem,.txt"
                      file={files.caPublicKeyFile}
                      onChange={(file) => setFile("caPublicKeyFile", file)}
                    />

                    <FileInput
                      id="caPrivateKeyFile"
                      label="CA Private Key File"
                      description="PEM-encoded RSA private key matching the uploaded CA public key."
                      accept=".pem,.txt"
                      file={files.caPrivateKeyFile}
                      onChange={(file) => setFile("caPrivateKeyFile", file)}
                    />

                    <div className="sm:col-span-2">
                      <FileInput
                        id="certificateSignatureFile"
                        label="Certificate Signature File"
                        description="Signature over the expected Task 2 certificate, produced using the CA private key."
                        accept=".sig,.txt,.bin"
                        file={files.certificateSignatureFile}
                        onChange={(file) =>
                          setFile("certificateSignatureFile", file)
                        }
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-white px-4 py-3 text-base font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Submitting..." : `Submit ${taskLabel}`}
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
                    <span className="font-semibold">
                      {previousTaskNumber === "2" ? "Task 2" : "Task 1"}
                    </span>{" "}
                    for student ID{" "}
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
                    The latest submission before the deadline counts for this
                    task. Do you want to submit another response?
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
                        setPreviousTaskNumber(null);
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

function FileInput({
  id,
  label,
  accept,
  file,
  onChange,
  description,
}: {
  id: string;
  label: string;
  accept?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  description?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);

  function pickFirstFile(fileList: FileList | null): File | null {
    return fileList && fileList.length > 0 ? fileList[0] : null;
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();

    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    onChange(pickFirstFile(e.dataTransfer.files));
  }

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-zinc-200"
      >
        {label}
      </label>
      {description && (
        <p className="mb-2 text-xs leading-5 text-zinc-500">{description}</p>
      )}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex min-h-[52px] items-center gap-3 rounded-xl border px-4 py-2.5 transition ${
          isDragging
            ? "border-zinc-400 bg-zinc-800/90 ring-2 ring-zinc-500/30"
            : "border-zinc-700 bg-zinc-900"
        }`}
      >
        <label
          htmlFor={id}
          className="inline-flex shrink-0 cursor-pointer rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black transition hover:bg-zinc-200"
        >
          Choose file
        </label>

        <div className="min-w-0 flex-1 text-sm text-zinc-300">
          {file ? (
            <span className="block truncate" title={file.name}>
              {file.name}
            </span>
          ) : (
            <span className="text-zinc-500">
              {isDragging ? "Drop file here" : "No file chosen"}
            </span>
          )}
        </div>

        {file && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 text-xs text-zinc-400 transition hover:text-white"
          >
            Clear
          </button>
        )}

        <input
          id={id}
          type="file"
          accept={accept}
          onChange={(e) => onChange(pickFirstFile(e.target.files))}
          className="sr-only"
        />
      </div>
    </div>
  );
}
