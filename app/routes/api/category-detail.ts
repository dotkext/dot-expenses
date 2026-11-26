import type { Route } from "./+types/category-detail";

import { deleteCategory, updateCategory } from "@/server/categories.service";
import { apiError, assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { categoryInputSchema } from "@/lib/validation";

export async function action({ request, params }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  switch (request.method) {
    case "PATCH":
    case "PUT": {
      const input = parseBody(categoryInputSchema, await readBody(request));
      const category = await updateCategory(user.id, params.id, input);
      return Response.json(category);
    }
    case "DELETE": {
      await deleteCategory(user.id, params.id);
      return Response.json({ ok: true });
    }
    default:
      apiError("errors.methodNotAllowed", 405);
  }
}
