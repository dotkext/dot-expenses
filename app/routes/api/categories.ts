import type { Route } from "./+types/categories";

import { createCategory, listCategories } from "@/server/categories.service";
import { assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { categoryInputSchema } from "@/lib/validation";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  return Response.json(await listCategories(user.id));
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  const input = parseBody(categoryInputSchema, await readBody(request));
  const category = await createCategory(user.id, input);
  return Response.json(category, { status: 201 });
}
