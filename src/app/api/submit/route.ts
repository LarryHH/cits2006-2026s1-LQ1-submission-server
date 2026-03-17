import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateExpectedSignature, isValidStudentId } from '@/lib/signature';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const studentId = String(body.studentId ?? '').trim();
    const publicKey = String(body.publicKey ?? '').trim();
    const privateKey = String(body.privateKey ?? '').trim();
    const submittedSignature = String(body.signature ?? '').trim();
    const confirmResubmission = Boolean(body.confirmResubmission);

    if (!isValidStudentId(studentId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid student ID format.' },
        { status: 400 }
      );
    }

    if (!publicKey) {
      return NextResponse.json(
        { ok: false, error: 'Public key is required.' },
        { status: 400 }
      );
    }

    if (!privateKey) {
      return NextResponse.json(
        { ok: false, error: 'Private key is required.' },
        { status: 400 }
      );
    }

    if (!submittedSignature) {
      return NextResponse.json(
        { ok: false, error: 'Signature is required.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: existingRows, error: lookupError } = await supabase
      .from('submissions')
      .select('submitted_at')
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false })
      .limit(1);

    if (lookupError) {
      return NextResponse.json(
        { ok: false, error: 'Failed to check previous submissions.' },
        { status: 500 }
      );
    }

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    if (existing && !confirmResubmission) {
      return NextResponse.json({
        ok: true,
        needsConfirmation: true,
        previousSubmittedAt: existing.submitted_at,
      });
    }

    const expectedSignature = generateExpectedSignature(
      studentId,
      publicKey,
      privateKey
    );

    const isCorrect = submittedSignature === expectedSignature;

    const { error: insertError } = await supabase.from('submissions').insert({
      student_id: studentId,
      public_key: publicKey,
      private_key: privateKey,
      submitted_signature: submittedSignature,
      expected_signature: expectedSignature,
      is_correct: isCorrect,
    });

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: 'Failed to save submission.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      submitted: true,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Server error.' },
      { status: 500 }
    );
  }
}