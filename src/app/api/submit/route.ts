import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  buildExpectedMessage,
  isValidStudentId,
  verifyTask1Submission,
  verifyTask2Submission,
} from "@/lib/signature";

export const runtime = "nodejs";

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

function isWithinWindow(
  now: Date,
  opensAt: string | null,
  closesAt: string | null,
): boolean {
  if (opensAt && now < new Date(opensAt)) return false;
  if (closesAt && now > new Date(closesAt)) return false;
  return true;
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
      return NextResponse.json(
        { ok: false, error: "Student ID must be exactly 8 digits." },
        { status: 400 },
      );
    }

    if (!taskNumber) {
      return NextResponse.json(
        { ok: false, error: "Task number must be 1 or 2." },
        { status: 400 },
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
      return NextResponse.json(
        {
          ok: false,
          error: "Submissions are not currently open for the active lab.",
        },
        { status: 403 },
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
      return NextResponse.json(
        {
          ok: false,
          error: "Submissions are not currently open for the active lab.",
        },
        { status: 403 },
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
        return NextResponse.json(
          { ok: false, error: "Student public key file is required." },
          { status: 400 },
        );
      }

      if (!studentPrivateKeyFile) {
        return NextResponse.json(
          { ok: false, error: "Student private key file is required." },
          { status: 400 },
        );
      }

      if (!signatureFile) {
        return NextResponse.json(
          { ok: false, error: "Signature file is required." },
          { status: 400 },
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
        return NextResponse.json(
          { ok: false, error: "CA public key file is required." },
          { status: 400 },
        );
      }

      if (!caPrivateKeyFile) {
        return NextResponse.json(
          { ok: false, error: "CA private key file is required." },
          { status: 400 },
        );
      }

      if (!certificateDataFile) {
        return NextResponse.json(
          { ok: false, error: "Certificate data file is required." },
          { status: 400 },
        );
      }

      if (!certificateSignatureFile) {
        return NextResponse.json(
          { ok: false, error: "Certificate signature file is required." },
          { status: 400 },
        );
      }

      if (!messageSignatureFile) {
        return NextResponse.json(
          { ok: false, error: "Message signature file is required." },
          { status: 400 },
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
