export function isValidStudentId(studentId: string): boolean {
  return /^[0-9]{8}$/.test(studentId);
}

// Placeholder only.
// Replace this with your real signature-generation logic.
export function generateExpectedSignature(
  studentId: string,
  publicKey: string,
  privateKey: string
): string {
  return `${studentId}:${publicKey}:${privateKey}`;
}