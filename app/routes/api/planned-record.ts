import type { Route } from "./+types/planned-record";

import { assertSameOrigin, requireApiUser } from "@/server/http";
import { recordPlannedInstallment } from "@/server/planned.service";

export async function action({ request, params }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const result = await recordPlannedInstallment(user, params.id);
  return Response.json(result);
}
