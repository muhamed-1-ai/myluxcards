import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { getUserDashboardPreferences, updateUserDashboardPreferences } from "@/lib/repositories/users";

export interface DashboardItemPreference {
  id: string;
  visible: boolean;
  order: number;
  displayName?: string;
}

export interface UserDashboardPreferences {
  version: number;
  cards: DashboardItemPreference[];
  sections: DashboardItemPreference[];
}

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const preferences = await getUserDashboardPreferences(identity.id);
    return Response.json({ preferences });
  } catch (error) {
    console.error("[Dashboard Preferences GET] Error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawPreferences = body.preferences || body;

    if (!rawPreferences || typeof rawPreferences !== "object") {
      return Response.json({ message: "Invalid preferences format" }, { status: 400 });
    }

    const sanitizeItems = (items: any[]): DashboardItemPreference[] => {
      if (!Array.isArray(items)) return [];
      return items.map((item, index) => {
        const id = String(item.id || "").trim();
        const visible = Boolean(item.visible);
        const order = typeof item.order === "number" ? item.order : index;
        const rawName = item.displayName ? String(item.displayName).trim().slice(0, 60) : undefined;
        return {
          id,
          visible,
          order,
          ...(rawName ? { displayName: rawName } : {}),
        };
      }).filter((item) => item.id.length > 0);
    };

    const sanitizedPreferences: UserDashboardPreferences = {
      version: typeof rawPreferences.version === "number" ? rawPreferences.version : 1,
      cards: sanitizeItems(rawPreferences.cards),
      sections: sanitizeItems(rawPreferences.sections),
    };

    const ok = await updateUserDashboardPreferences(identity.id, sanitizedPreferences);
    if (!ok) {
      return Response.json({ message: "Failed to save preferences to database" }, { status: 500 });
    }

    return Response.json({
      ok: true,
      preferences: sanitizedPreferences,
      message: "Dashboard preferences saved successfully.",
    });
  } catch (error) {
    console.error("[Dashboard Preferences PUT] Error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
