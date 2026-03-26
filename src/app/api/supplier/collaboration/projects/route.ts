import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import {
  listCollabProjectsForSupplier,
  mapCollabFile,
} from "@/server/services/collaboration/collab-project-service";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, ["SUPPLIER"]);
    const rows = await listCollabProjectsForSupplier();
    return ok(
      rows.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description.slice(0, 500),
        status: p.status,
        createdAt: p.created_at.toISOString(),
        sampleFiles: p.files.map(mapCollabFile),
      })),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
