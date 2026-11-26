import type { Route } from "./+types/merchant-detail";

import { deleteMerchant, updateMerchant } from "@/server/merchants.service";
import { apiError, assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { z } from "zod";

export async function action({ request, params }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  switch (request.method) {
    case "PATCH":
    case "PUT": {
      const input = parseBody(
        z.object({
          name: z.string().trim().min(1).max(120).optional(),
          defaultCategoryId: z.string().uuid().nullable().optional(),
          defaultAccountId: z.string().uuid().nullable().optional(),
        }),
        await readBody(request),
      );
      await updateMerchant(user.id, params.id, input);
      return Response.json({ ok: true });
    }
    case "DELETE": {
      await deleteMerchant(user.id, params.id);
      return Response.json({ ok: true });
    }
    default:
      apiError("errors.methodNotAllowed", 405);
  }
}
