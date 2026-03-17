export function isValidStudentId(studentId: string): boolean {
  return /^[0-9]{8}$/.test(studentId); // adjust if needed
}

// Placeholder only.
// Replace this with your real signature-generation logic.
export function generateExpectedSignature(studentId: string): string {
  return studentId.split('').reverse().join('');
}