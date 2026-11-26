import type { Route } from "./+types/planned-detail";

import { plannedInputSchema } from "@/lib/validation";
import { apiError, assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { deletePlanned, updatePlanned } from "@/server/planned.service";

export async function action({ request, params }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  switch (request.method) {
    case "PATCH":
    case "PUT": {
      const input = parseBody(plannedInputSchema, await readBody(request));
      await updatePlanned(user, params.id, input);
      return Response.json({ ok: true });
    }
    case "DELETE": {
      await deletePlanned(user.id, params.id);
      return Response.json({ ok: true });
    }
    default:
      apiError("errors.methodNotAllowed", 405);
  }
}
