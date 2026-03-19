import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  buildExpectedMessage,
  isValidStudentId,
  verifyTask1Submission,
  verifyTask2Submission,
} from "@/lib/signature";

export const runtime = "nodejs";

// ADDED: file size limits
const MAX_KEY_FILE_BYTES = 64 * 1024;
const MAX_SIGNATURE_FILE_BYTES = 64 * 1024;
const MAX_CERTIFICATE_FILE_BYTES = 128 * 1024;

// ADDED: short cooldown to reduce rapid spam/hammering without heavily limiting genuine resubmits.
// Note: this is best-effort only in a serverless environment like Vercel.
const SUBMISSION_COOLDOWN_MS = 30000;
const recentSubmissionAttempts = new Map<string, number>();

type ActiveLabSetting = {
  id: number;
  label: string;
  task_1_message_prefix: string;
  task_2_message_prefix: string;
  opens_at: string | null;
  closes_at: string | null;
  is_active: boolean;
};

function parseBoolean(value: FormDataEntryValue | null): boolean {
  if (typeof value !== "string") return false;
  return value === "true";
}

function parseTaskNumber(value: FormDataEntryValue | null): 1 | 2 | null {
  if (typeof value !== "string") return null;
  if (value === "1") return 1;
  if (value === "2") return 2;
  return null;
}

function getFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  if (!(value instanceof File)) return null;
  if (value.size <= 0) return null;
  return value;
}

// ADDED: friendly file size validator
function ensureMaxFileSize(file: File, maxBytes: number, label: string) {
  if (file.size > maxBytes) {
    throw new Error(
      `${label} must be at most ${Math.floor(maxBytes / 1024)} KB.`,
    );
  }
}

function isWithinWindow(
  now: Date,
  opensAt: string | null,
  closesAt: string | null,
): boolean {
  if (opensAt && now < new Date(opensAt)) return false;
  if (closesAt && now > new Date(closesAt)) return false;
  return true;
}

// ADDED: small helper for consistent JSON errors
function badRequest(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

// ADDED: derive a simple request identity for cooldown checks
function getRequestIdentity(req: NextRequest, studentId: string): string {
  const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || "unknown";
  return `${ip}::${studentId}`;
}

// ADDED: best-effort short cooldown guard
function checkCooldown(identity: string, nowMs: number): number | null {
  const lastAttempt = recentSubmissionAttempts.get(identity);

  if (typeof lastAttempt === "number") {
    const elapsed = nowMs - lastAttempt;
    if (elapsed < SUBMISSION_COOLDOWN_MS) {
      return SUBMISSION_COOLDOWN_MS - elapsed;
    }
  }

  return null;
}

// ADDED: record latest attempt and clean up stale entries
function recordAttempt(identity: string, nowMs: number) {
  recentSubmissionAttempts.set(identity, nowMs);

  for (const [key, ts] of recentSubmissionAttempts.entries()) {
    if (nowMs - ts > SUBMISSION_COOLDOWN_MS * 10) {
      recentSubmissionAttempts.delete(key);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const studentId = String(formData.get("studentId") ?? "").trim();
    const taskNumber = parseTaskNumber(formData.get("taskNumber"));
    const confirmResubmission = parseBoolean(
      formData.get("confirmResubmission"),
    );

    if (!isValidStudentId(studentId)) {
      return badRequest("Student ID must be exactly 8 digits.");
    }

    if (!taskNumber) {
      return badRequest("Task number must be 1 or 2.");
    }

    // ADDED: short cooldown check, applied after student ID/task parse
    const nowMs = Date.now();
    const requestIdentity = getRequestIdentity(req, studentId);
    const remainingCooldownMs = checkCooldown(requestIdentity, nowMs);

    if (remainingCooldownMs !== null) {
      return badRequest(
        `Please wait ${Math.ceil(
          remainingCooldownMs / 1000,
        )} second(s) before submitting again.`,
        429,
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: activeLab, error: activeLabError } = await supabase
      .from("lab_settings")
      .select(
        "id, label, task_1_message_prefix, task_2_message_prefix, opens_at, closes_at, is_active",
      )
      .eq("is_active", true)
      .maybeSingle<ActiveLabSetting>();

    if (activeLabError) {
      return NextResponse.json(
        { ok: false, error: "Failed to load active lab settings." },
        { status: 500 },
      );
    }

    if (!activeLab) {
      return NextResponse.json(
        { ok: false, error: "No active lab is configured." },
        { status: 500 },
      );
    }

    const now = new Date();

    if (!isWithinWindow(now, activeLab.opens_at, activeLab.closes_at)) {
      return badRequest(
        "Submissions are not currently open for the active lab.",
        403,
      );
    }

    const { data: existingRows, error: lookupError } = await supabase
      .from("submissions")
      .select("submitted_at")
      .eq("student_id", studentId)
      .eq("task_number", taskNumber)
      .order("submitted_at", { ascending: false })
      .limit(1);

    if (lookupError) {
      return NextResponse.json(
        { ok: false, error: "Failed to check previous submissions." },
        { status: 500 },
      );
    }

    const existing =
      existingRows && existingRows.length > 0 ? existingRows[0] : null;

    if (existing && !confirmResubmission) {
      return NextResponse.json({
        ok: true,
        needsConfirmation: true,
        previousSubmittedAt: existing.submitted_at,
        previousTaskNumber: taskNumber,
      });
    }

    if (!isWithinWindow(now, activeLab.opens_at, activeLab.closes_at)) {
      return badRequest(
        "Submissions are not currently open for the active lab.",
        403,
      );
    }

    const messagePrefix =
      taskNumber === 1
        ? activeLab.task_1_message_prefix
        : activeLab.task_2_message_prefix;

    const messageUsed = buildExpectedMessage(messagePrefix, studentId).toString(
      "utf-8",
    );

    let verificationResult:
      | Awaited<ReturnType<typeof verifyTask1Submission>>
      | Awaited<ReturnType<typeof verifyTask2Submission>>;

    if (taskNumber === 1) {
      const studentPublicKeyFile = getFile(formData, "studentPublicKeyFile");
      const studentPrivateKeyFile = getFile(formData, "studentPrivateKeyFile");
      const signatureFile = getFile(formData, "signatureFile");

      if (!studentPublicKeyFile) {
        return badRequest("Student public key file is required.");
      }

      if (!studentPrivateKeyFile) {
        return badRequest("Student private key file is required.");
      }

      if (!signatureFile) {
        return badRequest("Signature file is required.");
      }

      // ADDED: file size checks for Task 1 uploads
      try {
        ensureMaxFileSize(
          studentPublicKeyFile,
          MAX_KEY_FILE_BYTES,
          "Student public key file",
        );
        ensureMaxFileSize(
          studentPrivateKeyFile,
          MAX_KEY_FILE_BYTES,
          "Student private key file",
        );
        ensureMaxFileSize(
          signatureFile,
          MAX_SIGNATURE_FILE_BYTES,
          "Signature file",
        );
      } catch (error) {
        return badRequest(
          error instanceof Error ? error.message : "Invalid file upload.",
        );
      }

      verificationResult = await verifyTask1Submission({
        studentId,
        messagePrefix,
        studentPublicKeyFile,
        studentPrivateKeyFile,
        signatureFile,
      });
    } else {
      const caPublicKeyFile = getFile(formData, "caPublicKeyFile");
      const caPrivateKeyFile = getFile(formData, "caPrivateKeyFile");
      const certificateDataFile = getFile(formData, "certificateDataFile");
      const certificateSignatureFile = getFile(
        formData,
        "certificateSignatureFile",
      );
      const messageSignatureFile = getFile(formData, "messageSignatureFile");

      if (!caPublicKeyFile) {
        return badRequest("CA public key file is required.");
      }

      if (!caPrivateKeyFile) {
        return badRequest("CA private key file is required.");
      }

      if (!certificateDataFile) {
        return badRequest("Certificate data file is required.");
      }

      if (!certificateSignatureFile) {
        return badRequest("Certificate signature file is required.");
      }

      if (!messageSignatureFile) {
        return badRequest("Message signature file is required.");
      }

      // ADDED: file size checks for Task 2 uploads
      try {
        ensureMaxFileSize(
          caPublicKeyFile,
          MAX_KEY_FILE_BYTES,
          "CA public key file",
        );
        ensureMaxFileSize(
          caPrivateKeyFile,
          MAX_KEY_FILE_BYTES,
          "CA private key file",
        );
        ensureMaxFileSize(
          certificateDataFile,
          MAX_CERTIFICATE_FILE_BYTES,
          "Certificate data file",
        );
        ensureMaxFileSize(
          certificateSignatureFile,
          MAX_SIGNATURE_FILE_BYTES,
          "Certificate signature file",
        );
        ensureMaxFileSize(
          messageSignatureFile,
          MAX_SIGNATURE_FILE_BYTES,
          "Message signature file",
        );
      } catch (error) {
        return badRequest(
          error instanceof Error ? error.message : "Invalid file upload.",
        );
      }

      verificationResult = await verifyTask2Submission({
        studentId,
        messagePrefix,
        caPublicKeyFile,
        caPrivateKeyFile,
        certificateDataFile,
        certificateSignatureFile,
        messageSignatureFile,
      });
    }

    const insertPayload = {
      student_id: studentId,
      task_number: taskNumber,
      lab_label: activeLab.label,
      message_prefix_used: messagePrefix,
      message_used: messageUsed,
      is_valid: verificationResult.isValid,
      verification_stage: verificationResult.verificationStage,
      verification_message: verificationResult.verificationMessage,
      raw_error: verificationResult.rawError ?? null,
      student_public_key_pem: verificationResult.studentPublicKeyPem ?? null,
      student_private_key_pem: verificationResult.studentPrivateKeyPem ?? null,
      ca_public_key_pem: verificationResult.caPublicKeyPem ?? null,
      ca_private_key_pem: verificationResult.caPrivateKeyPem ?? null,
      certificate_data_text: verificationResult.certificateDataText ?? null,
      submitted_signature_text:
        verificationResult.submittedSignatureText ?? null,
      certificate_signature_text:
        verificationResult.certificateSignatureText ?? null,
      certificate_encoding_used:
        verificationResult.certificateEncodingUsed ?? null,
      expected_task1_signature_text:
        verificationResult.expectedTask1SignatureText ?? null,
      expected_task2_certificate_signature_text:
        verificationResult.expectedTask2CertificateSignatureText ?? null,
    };

    const { error: insertError } = await supabase
      .from("submissions")
      .insert(insertPayload);

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: "Failed to save submission." },
        { status: 500 },
      );
    }

    // ADDED: only record cooldown after a real submission attempt reaches persistence
    recordAttempt(requestIdentity, nowMs);

    return NextResponse.json({
      ok: true,
      submitted: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Server error.",
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 500 },
    );
  }
}
