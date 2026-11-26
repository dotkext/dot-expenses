import type { Route } from "./+types/account-detail";

import { deleteAccount, updateAccount } from "@/server/accounts.service";
import { apiError, assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { accountInputSchema } from "@/lib/validation";
import { z } from "zod";

export async function action({ request, params }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  switch (request.method) {
    case "PATCH":
    case "PUT": {
      const input = parseBody(accountInputSchema, await readBody(request));
      await updateAccount(user.id, params.id, input);
      return Response.json({ ok: true });
    }
    case "DELETE": {
      const input = parseBody(
        z.object({ moveTo: z.string().uuid().nullable(), cascade: z.boolean() }),
        await readBody(request),
      );
      await deleteAccount(user.id, params.id, input);
      return Response.json({ ok: true });
    }
    default:
      apiError("errors.methodNotAllowed", 405);
  }
}
