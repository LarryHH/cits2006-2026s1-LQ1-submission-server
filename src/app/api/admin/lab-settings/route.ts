import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type LabSettingsRow = {
  id: number;
  label: string;
  task_1_message_prefix: string;
  task_2_message_prefix: string;
  opens_at: string | null;
  closes_at: string | null;
  is_active: boolean;
  created_at: string;
};

function isAdmin(cookieValue: string | undefined) {
  const expected = process.env.ADMIN_PASSWORD;
  return !!expected && cookieValue === expected;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseNullableDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date value.");
  }

  return d.toISOString();
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("admin_auth")?.value;

    if (!isAdmin(adminCookie)) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: activeRow, error: activeError } = await supabase
      .from("lab_settings")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<LabSettingsRow>();

    if (activeError) {
      return NextResponse.json(
        { ok: false, error: "Failed to load lab settings." },
        { status: 500 },
      );
    }

    if (activeRow) {
      return NextResponse.json({ ok: true, labSettings: activeRow });
    }

    const { data: latestRow, error: latestError } = await supabase
      .from("lab_settings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<LabSettingsRow>();

    if (latestError) {
      return NextResponse.json(
        { ok: false, error: "Failed to load latest lab settings." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, labSettings: latestRow ?? null });
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

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("admin_auth")?.value;

    if (!isAdmin(adminCookie)) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();

    const id =
      typeof body.id === "number" && Number.isInteger(body.id) ? body.id : null;

    const label = normalizeString(body.label);
    const task1Prefix = normalizeString(body.task_1_message_prefix);
    const task2Prefix = normalizeString(body.task_2_message_prefix);
    const opensAt = parseNullableDate(body.opens_at);
    const closesAt = parseNullableDate(body.closes_at);
    const isActive = Boolean(body.is_active);

    if (!label) {
      return NextResponse.json(
        { ok: false, error: "Label is required." },
        { status: 400 },
      );
    }

    if (!task1Prefix) {
      return NextResponse.json(
        { ok: false, error: "Task 1 message prefix is required." },
        { status: 400 },
      );
    }

    if (!task2Prefix) {
      return NextResponse.json(
        { ok: false, error: "Task 2 message prefix is required." },
        { status: 400 },
      );
    }

    if (opensAt && closesAt && new Date(opensAt) >= new Date(closesAt)) {
      return NextResponse.json(
        { ok: false, error: "Open time must be before close time." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    if (isActive) {
      const { error: deactivateError } = await supabase
        .from("lab_settings")
        .update({ is_active: false })
        .neq("id", id ?? -1);

      if (deactivateError) {
        return NextResponse.json(
          { ok: false, error: "Failed to deactivate other lab settings." },
          { status: 500 },
        );
      }
    }

    if (id) {
      const { data, error } = await supabase
        .from("lab_settings")
        .update({
          label,
          task_1_message_prefix: task1Prefix,
          task_2_message_prefix: task2Prefix,
          opens_at: opensAt,
          closes_at: closesAt,
          is_active: isActive,
        })
        .eq("id", id)
        .select("*")
        .single<LabSettingsRow>();

      if (error) {
        return NextResponse.json(
          { ok: false, error: "Failed to update lab settings." },
          { status: 500 },
        );
      }

      return NextResponse.json({ ok: true, labSettings: data });
    }

    const { data, error } = await supabase
      .from("lab_settings")
      .insert({
        label,
        task_1_message_prefix: task1Prefix,
        task_2_message_prefix: task2Prefix,
        opens_at: opensAt,
        closes_at: closesAt,
        is_active: isActive,
      })
      .select("*")
      .single<LabSettingsRow>();

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Failed to create lab settings." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, labSettings: data });
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