import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  const { data, error } = await supabase
    .from("lab_settings")
    .select(
      "label, task_1_message_prefix, task_2_message_prefix, opens_at, closes_at",
    )
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to load lab settings." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    settings: data ?? null,
  });
}