import type { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";

const UpdateSchema = z.object({
  status: z.enum(["new", "good", "bad", "contacted", "needs_review"]).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lead = await store.leads.get(id);
  if (!lead) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }
  return Response.json(lead);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lead = await store.leads.get(id);
  if (!lead) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = UpdateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.status) lead.status = parsed.data.status;
    await store.leads.set(lead);

    return Response.json(lead);
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lead = await store.leads.get(id);
  if (!lead) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }
  await store.leads.delete(id);
  return Response.json({ deleted: true });
}
