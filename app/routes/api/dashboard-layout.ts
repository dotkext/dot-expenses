import type { Route } from "./+types/dashboard-layout";

import { getLayout, resetLayout, saveLayout } from "@/server/dashboard.service";
import { assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { layoutSchema } from "@/lib/validation";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  return Response.json({ layout: await getLayout(user.id) });
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  switch (request.method) {
    case "PUT": {
      const input = parseBody(layoutSchema, await readBody(request));
      await saveLayout(user.id, input.layout);
      return Response.json({ ok: true });
    }
    case "DELETE": {
      await resetLayout(user.id);
      return Response.json({ layout: await getLayout(user.id) });
    }
    default:
      return new Response(null, { status: 405 });
  }
}
