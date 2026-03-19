import {
  constants,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  KeyObject,
} from "node:crypto";

export function isValidStudentId(studentId: string): boolean {
  return /^[0-9]{8}$/.test(studentId);
}

export function getStudentIdSuffix(studentId: string): string {
  if (!isValidStudentId(studentId)) {
    throw new Error("Student ID must be exactly 8 digits.");
  }
  return studentId.slice(-4);
}

export function buildExpectedMessage(
  messagePrefix: string,
  studentId: string,
): Buffer {
  const suffix = getStudentIdSuffix(studentId);
  return Buffer.from(`${messagePrefix}-${suffix}`, "utf-8");
}

export type VerificationResult = {
  isValid: boolean;
  verificationStage: string;
  verificationMessage: string;
  rawError?: string | null;

  studentPublicKeyPem?: string | null;
  studentPrivateKeyPem?: string | null;
  caPublicKeyPem?: string | null;
  caPrivateKeyPem?: string | null;
  certificateDataText?: string | null;
  submittedSignatureText?: string | null;
  certificateSignatureText?: string | null;
  certificateEncodingUsed?: string | null;

  expectedTask1SignatureText?: string | null;
  expectedTask2CertificateSignatureText?: string | null;
};

type ParsedCert = {
  studentId: string;
  e: bigint;
  n: bigint;
};

type CertificateCandidate = {
  label: string;
  bytes: Buffer;
  parsedCert: ParsedCert;
};

export async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function fileToUtf8(file: File): Promise<string> {
  return (await file.text()).trim();
}

export function normalizePem(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

export function loadPrivateKeyFromPem(pem: string): KeyObject {
  return createPrivateKey({
    key: normalizePem(pem),
    format: "pem",
  });
}

export function loadPublicKeyFromPem(pem: string): KeyObject {
  return createPublicKey({
    key: normalizePem(pem),
    format: "pem",
  });
}

export function publicPemFromPrivateKeyPem(privateKeyPem: string): string {
  const privateKey = loadPrivateKeyFromPem(privateKeyPem);
  return createPublicKey(privateKey).export({
    type: "spki",
    format: "pem",
  }) as string;
}

export function normalizePublicKeyPem(pem: string): string {
  return normalizePem(
    createPublicKey({
      key: normalizePem(pem),
      format: "pem",
    }).export({
      type: "spki",
      format: "pem",
    }) as string,
  );
}

export function publicKeyMatchesPrivateKey(
  publicKeyPem: string,
  privateKeyPem: string,
): boolean {
  const normalizedPublic = normalizePublicKeyPem(publicKeyPem);
  const derivedPublic = normalizePem(publicPemFromPrivateKeyPem(privateKeyPem));
  return normalizedPublic === derivedPublic;
}

export function verifyRsaSha256Pkcs1v15(
  publicKeyPem: string,
  message: Buffer,
  signature: Buffer,
): boolean {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(message);
  verifier.end();

  return verifier.verify(
    {
      key: normalizePem(publicKeyPem),
      padding: constants.RSA_PKCS1_PADDING,
    },
    signature,
  );
}

export function verifyRsaSha256Pkcs1v15KeyObject(
  publicKey: KeyObject,
  message: Buffer,
  signature: Buffer,
): boolean {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(message);
  verifier.end();

  return verifier.verify(
    {
      key: publicKey,
      padding: constants.RSA_PKCS1_PADDING,
    },
    signature,
  );
}

export function signRsaSha256Pkcs1v15(
  privateKeyPem: string,
  message: Buffer,
): Buffer {
  const signer = createSign("RSA-SHA256");
  signer.update(message);
  signer.end();

  return signer.sign({
    key: normalizePem(privateKeyPem),
    padding: constants.RSA_PKCS1_PADDING,
  });
}

export function parseSignatureBuffer(input: Buffer): Buffer {
  const trimmedText = input.toString("utf-8").trim();

  if (!trimmedText) {
    throw new Error("Signature file is empty.");
  }

  const compact = trimmedText.replace(/\s+/g, "");

  if (/^[0-9a-fA-F]+$/.test(compact) && compact.length % 2 === 0) {
    return Buffer.from(compact, "hex");
  }

  if (/^[A-Za-z0-9+/=]+$/.test(compact)) {
    try {
      const decoded = Buffer.from(compact, "base64");
      if (decoded.length > 0) {
        return decoded;
      }
    } catch {
      // fall through
    }
  }

  return input;
}

export function bufferPreview(input: Buffer, max = 64): string {
  return input.toString("hex").slice(0, max);
}

export function parseCertificateData(certData: Buffer | string): ParsedCert {
  let raw = Buffer.isBuffer(certData) ? certData.toString("utf-8") : certData;

  raw = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!raw) {
    throw new Error("Certificate data is empty.");
  }

  // JSON form: extract exact textual values so large integers are preserved.
  if (raw.startsWith("{") && raw.endsWith("}")) {
    const studentIdMatch = raw.match(/"student_id"\s*:\s*"([^"]+)"/);
    const eMatch = raw.match(/"e"\s*:\s*([0-9]+)/);
    const nMatch = raw.match(/"n"\s*:\s*([0-9]+)/);

    if (studentIdMatch && eMatch && nMatch) {
      return {
        studentId: studentIdMatch[1].trim(),
        e: BigInt(eMatch[1]),
        n: BigInt(nMatch[1]),
      };
    }
  }

  // Pipe-delimited form: id|e|n
  const parts = raw.split("|");
  if (parts.length === 3) {
    const [studentId, e, n] = parts.map((x) => x.trim());

    if (!studentId || !e || !n) {
      throw new Error("Certificate pipe format is missing fields.");
    }

    return {
      studentId,
      e: BigInt(e),
      n: BigInt(n),
    };
  }

  throw new Error("Unsupported certificate format. Expected JSON or id|e|n.");
}

function buildCertificateCandidates(
  uploadedBytes: Buffer,
): CertificateCandidate[] {
  const parsedCert = parseCertificateData(uploadedBytes);

  const seen = new Set<string>();
  const candidates: CertificateCandidate[] = [];

  function add(label: string, bytes: Buffer) {
    const key = bytes.toString("hex");
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({
      label,
      bytes,
      parsedCert,
    });
  }

  add("raw_uploaded_bytes", uploadedBytes);

  // Matches Python: json.dumps(certificate, sort_keys=True).encode()
  add(
    "json_python_sort_keys_default",
    Buffer.from(
      `{"e": ${parsedCert.e.toString()}, "n": ${parsedCert.n.toString()}, "student_id": "${parsedCert.studentId}"}`,
      "utf-8",
    ),
  );

  // Likely pretty-printed upload variants
  add(
    "json_pretty_indent2_insertion_order",
    Buffer.from(
      `{\n  "student_id": "${parsedCert.studentId}",\n  "n": ${parsedCert.n.toString()},\n  "e": ${parsedCert.e.toString()}\n}`,
      "utf-8",
    ),
  );

  add(
    "json_pretty_indent2_sorted",
    Buffer.from(
      `{\n  "e": ${parsedCert.e.toString()},\n  "n": ${parsedCert.n.toString()},\n  "student_id": "${parsedCert.studentId}"\n}`,
      "utf-8",
    ),
  );

  // Format explicitly allowed by the lab handout
  add(
    "pipe_delimited",
    Buffer.from(
      `${parsedCert.studentId}|${parsedCert.e.toString()}|${parsedCert.n.toString()}`,
      "utf-8",
    ),
  );

  return candidates;
}

function verifyCertificateAgainstCandidates(
  caPublicKeyPem: string,
  uploadedCertificateBytes: Buffer,
  certSignature: Buffer,
): {
  ok: boolean;
  matchedEncoding: string | null;
  matchedBytes: Buffer | null;
  parsedCert: ParsedCert | null;
} {
  const candidates = buildCertificateCandidates(uploadedCertificateBytes);

  for (const candidate of candidates) {
    const ok = verifyRsaSha256Pkcs1v15(
      caPublicKeyPem,
      candidate.bytes,
      certSignature,
    );

    if (ok) {
      return {
        ok: true,
        matchedEncoding: candidate.label,
        matchedBytes: candidate.bytes,
        parsedCert: candidate.parsedCert,
      };
    }
  }

  return {
    ok: false,
    matchedEncoding: null,
    matchedBytes: null,
    parsedCert: null,
  };
}

function bigIntToBuffer(x: bigint): Buffer {
  if (x < BigInt(0)) {
    throw new Error("Negative bigint not supported.");
  }
  let hex = x.toString(16);
  if (hex.length % 2 !== 0) {
    hex = `0${hex}`;
  }
  return Buffer.from(hex, "hex");
}

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function publicKeyPemFromModulusExponent(n: bigint, e: bigint): string {
  const jwk = {
    kty: "RSA",
    n: toBase64Url(bigIntToBuffer(n)),
    e: toBase64Url(bigIntToBuffer(e)),
    ext: true,
  };

  return createPublicKey({
    key: jwk,
    format: "jwk",
  }).export({
    type: "spki",
    format: "pem",
  }) as string;
}

export async function verifyTask1Submission(params: {
  studentId: string;
  messagePrefix: string;
  studentPublicKeyFile: File;
  studentPrivateKeyFile: File;
  signatureFile: File;
}): Promise<VerificationResult> {
  try {
    const {
      studentId,
      messagePrefix,
      studentPublicKeyFile,
      studentPrivateKeyFile,
      signatureFile,
    } = params;

    if (!isValidStudentId(studentId)) {
      return {
        isValid: false,
        verificationStage: "student_id",
        verificationMessage: "Invalid student ID format.",
      };
    }

    const publicKeyPem = normalizePem(await fileToUtf8(studentPublicKeyFile));
    const privateKeyPem = normalizePem(await fileToUtf8(studentPrivateKeyFile));
    const signatureRaw = await fileToBuffer(signatureFile);
    const signature = parseSignatureBuffer(signatureRaw);
    const message = buildExpectedMessage(messagePrefix, studentId);

    try {
      loadPublicKeyFromPem(publicKeyPem);
    } catch {
      return {
        isValid: false,
        verificationStage: "student_public_key_parse",
        verificationMessage: "Failed to parse student public key PEM.",
      };
    }

    try {
      loadPrivateKeyFromPem(privateKeyPem);
    } catch {
      return {
        isValid: false,
        verificationStage: "student_private_key_parse",
        verificationMessage: "Failed to parse student private key PEM.",
      };
    }

    if (!publicKeyMatchesPrivateKey(publicKeyPem, privateKeyPem)) {
      return {
        isValid: false,
        verificationStage: "student_key_pair_match",
        verificationMessage:
          "Student public key does not match the uploaded private key.",
        studentPublicKeyPem: publicKeyPem,
        studentPrivateKeyPem: privateKeyPem,
        expectedTask1SignatureText: bufferPreview(
          signRsaSha256Pkcs1v15(privateKeyPem, message),
        ),
        submittedSignatureText: bufferPreview(signature),
      };
    }

    const isValid = verifyRsaSha256Pkcs1v15(publicKeyPem, message, signature);
    const expectedTask1Signature = signRsaSha256Pkcs1v15(
      privateKeyPem,
      message,
    );

    return {
      isValid,
      verificationStage: "task1_signature",
      verificationMessage: isValid
        ? "Task 1 signature verified successfully."
        : "Task 1 signature verification failed.",
      studentPublicKeyPem: publicKeyPem,
      studentPrivateKeyPem: privateKeyPem,
      expectedTask1SignatureText: bufferPreview(expectedTask1Signature),
      submittedSignatureText: bufferPreview(signature),
    };
  } catch (error) {
    return {
      isValid: false,
      verificationStage: "task1_internal",
      verificationMessage: "Task 1 verification failed.",
      rawError: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function verifyTask2Submission(params: {
  studentId: string;
  messagePrefix: string;
  caPublicKeyFile: File;
  caPrivateKeyFile: File;
  certificateDataFile: File;
  certificateSignatureFile: File;
  messageSignatureFile: File;
}): Promise<VerificationResult> {
  let certificateDataText: string | null = null;

  try {
    const {
      studentId,
      messagePrefix,
      caPublicKeyFile,
      caPrivateKeyFile,
      certificateDataFile,
      certificateSignatureFile,
      messageSignatureFile,
    } = params;

    if (!isValidStudentId(studentId)) {
      return {
        isValid: false,
        verificationStage: "student_id",
        verificationMessage: "Invalid student ID format.",
      };
    }

    const expectedSuffix = getStudentIdSuffix(studentId);

    const caPublicKeyPem = normalizePem(await fileToUtf8(caPublicKeyFile));
    const caPrivateKeyPem = normalizePem(await fileToUtf8(caPrivateKeyFile));
    const certificateDataBuf = await fileToBuffer(certificateDataFile);
    certificateDataText = certificateDataBuf.toString("utf-8").trim();

    const certSignature = parseSignatureBuffer(
      await fileToBuffer(certificateSignatureFile),
    );
    const messageSignature = parseSignatureBuffer(
      await fileToBuffer(messageSignatureFile),
    );

    const message = buildExpectedMessage(messagePrefix, studentId);

    try {
      loadPublicKeyFromPem(caPublicKeyPem);
    } catch {
      return {
        isValid: false,
        verificationStage: "ca_public_key_parse",
        verificationMessage: "Failed to parse CA public key PEM.",
      };
    }

    try {
      loadPrivateKeyFromPem(caPrivateKeyPem);
    } catch {
      return {
        isValid: false,
        verificationStage: "ca_private_key_parse",
        verificationMessage: "Failed to parse CA private key PEM.",
      };
    }

    if (!publicKeyMatchesPrivateKey(caPublicKeyPem, caPrivateKeyPem)) {
      return {
        isValid: false,
        verificationStage: "ca_key_pair_match",
        verificationMessage:
          "CA public key does not match the uploaded CA private key.",
        caPublicKeyPem,
        caPrivateKeyPem,
        expectedTask2CertificateSignatureText: null,
        certificateDataText,
        certificateSignatureText: bufferPreview(certSignature),
        submittedSignatureText: bufferPreview(messageSignature),
        certificateEncodingUsed: null,
      };
    }

    const certVerification = verifyCertificateAgainstCandidates(
      caPublicKeyPem,
      certificateDataBuf,
      certSignature,
    );

    if (!certVerification.ok || !certVerification.parsedCert) {
      return {
        isValid: false,
        verificationStage: "certificate_signature",
        verificationMessage:
          "Certificate signature verification failed for all supported certificate encodings.",
        caPublicKeyPem,
        certificateDataText,
        certificateSignatureText: bufferPreview(certSignature),
        submittedSignatureText: bufferPreview(messageSignature),
        certificateEncodingUsed: null,
        expectedTask2CertificateSignatureText: null,
      };
    }

    const parsedCert = certVerification.parsedCert;

    const expectedTask2CertificateSignature = certVerification.matchedBytes
      ? signRsaSha256Pkcs1v15(caPrivateKeyPem, certVerification.matchedBytes)
      : null;

    if (parsedCert.studentId !== expectedSuffix) {
      return {
        isValid: false,
        verificationStage: "certificate_student_id",
        verificationMessage:
          "Certificate student ID does not match submitted student ID.",
        caPublicKeyPem,
        caPrivateKeyPem: caPrivateKeyPem,
        certificateDataText,
        certificateSignatureText: bufferPreview(certSignature),
        submittedSignatureText: bufferPreview(messageSignature),
        certificateEncodingUsed: certVerification.matchedEncoding,
        expectedTask2CertificateSignatureText: expectedTask2CertificateSignature
          ? bufferPreview(expectedTask2CertificateSignature)
          : null,
      };
    }

    const studentPublicKeyPem = normalizePem(
      publicKeyPemFromModulusExponent(parsedCert.n, parsedCert.e),
    );

    const messageOk = verifyRsaSha256Pkcs1v15(
      studentPublicKeyPem,
      message,
      messageSignature,
    );

    return {
      isValid: messageOk,
      verificationStage: "task2_signature",
      verificationMessage: messageOk
        ? "Task 2 certificate and signature verified successfully."
        : "Task 2 message signature verification failed after certificate verification.",
      studentPublicKeyPem,
      caPublicKeyPem,
      caPrivateKeyPem: caPrivateKeyPem,
      certificateDataText,
      certificateSignatureText: bufferPreview(certSignature),
      submittedSignatureText: bufferPreview(messageSignature),
      certificateEncodingUsed: certVerification.matchedEncoding,
      expectedTask2CertificateSignatureText: expectedTask2CertificateSignature
        ? bufferPreview(expectedTask2CertificateSignature)
        : null,
    };
  } catch (error) {
    return {
      isValid: false,
      verificationStage: "task2_internal",
      verificationMessage: "Task 2 verification failed.",
      rawError: error instanceof Error ? error.message : "Unknown error",
      certificateDataText: certificateDataText ?? null,
      certificateEncodingUsed: null,
    };
  }
}
