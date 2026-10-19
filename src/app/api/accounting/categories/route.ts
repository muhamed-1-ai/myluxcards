import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { listCategories, createCategory } from "@/lib/accounting/categories";
import type { CategoryType } from "@/lib/accounting/types";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const type = url.searchParams.get("type") as CategoryType | undefined;

  const categories = await listCategories(context!.workspace.id, { includeArchived, type });
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "MANAGER");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const category = await createCategory(context!.workspace.id, {
      name: body.name,
      type: body.type,
      parentId: body.parentId,
      icon: body.icon,
      color: body.color,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create category" }, { status: 400 });
  }
}
