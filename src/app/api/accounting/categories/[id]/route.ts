import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { updateCategory, archiveCategory, restoreCategory } from "@/lib/accounting/categories";

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "MANAGER");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const categoryId = params.id;

  try {
    const body = await req.json();

    if (body.action === "ARCHIVE" || body.isArchived === true) {
      const category = await archiveCategory(context!.workspace.id, categoryId);
      return NextResponse.json({ category });
    }

    if (body.action === "RESTORE" || body.isArchived === false) {
      const category = await restoreCategory(context!.workspace.id, categoryId);
      return NextResponse.json({ category });
    }

    const category = await updateCategory(context!.workspace.id, categoryId, {
      name: body.name,
      icon: body.icon,
      color: body.color,
      sortOrder: body.sortOrder,
      parentId: body.parentId,
    });
    return NextResponse.json({ category });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update category" }, { status: 400 });
  }
}
