import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { store } from "@/lib/store";
import type { ICPProfile } from "@/lib/types";

const ICPSchema = z.object({
  name: z.string().min(1).max(100),
  industry_keywords: z.array(z.string()).min(1).max(20),
  company_size_min: z.number().int().min(0),
  company_size_max: z.number().int().min(0),
  region: z.string().min(1).max(100),
  target_roles: z.array(z.string()).max(10),
});

export async function GET() {
  return Response.json(await store.icp.getAll());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ICPSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const profile: ICPProfile = {
      id: uuidv4(),
      ...parsed.data,
      created_at: new Date().toISOString(),
    };

    await store.icp.set(profile);
    return Response.json(profile, { status: 201 });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
