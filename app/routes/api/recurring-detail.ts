import type { Route } from "./+types/recurring-detail";

import { deleteRule, updateRule } from "@/server/recurring.service";
import { assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { recurringInputSchema } from "@/lib/validation";

export async function action({ request, params }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  switch (request.method) {
    case "PATCH":
    case "PUT": {
      const input = parseBody(recurringInputSchema, await readBody(request));
      await updateRule(user, params.id, input);
      return Response.json({ ok: true });
    }
    case "DELETE": {
      await deleteRule(user.id, params.id);
      return Response.json({ ok: true });
    }
    default:
      return new Response(null, { status: 405 });
  }
}
