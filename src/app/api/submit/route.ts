import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateExpectedSignature, isValidStudentId } from '@/lib/signature';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const studentId = String(body.studentId ?? '').trim();
    const submittedSignature = String(body.signature ?? '').trim();

    if (!isValidStudentId(studentId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid student ID format.' },
        { status: 400 }
      );
    }

    const expectedSignature = generateExpectedSignature(studentId);
    const isCorrect = submittedSignature === expectedSignature;

    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('submissions').insert({
      student_id: studentId,
      submitted_signature: submittedSignature,
      is_correct: isCorrect,
    });

    if (error) {
      console.error(error);
      return NextResponse.json(
        { ok: false, error: 'Failed to save submission.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      isCorrect,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: 'Server error.' },
      { status: 500 }
    );
  }
}