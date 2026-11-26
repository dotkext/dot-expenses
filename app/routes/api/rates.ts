import type { Route } from "./+types/rates";

import {
  deleteRateOverride,
  getRateInfo,
  refreshRates,
  setRateOverride,
} from "@/server/exchange.service";
import { assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { rateOverrideSchema } from "@/lib/validation";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireApiUser(request);

  // ?refresh=1 forces a re-fetch from the provider (manual, throttled client-side)
  if (new URL(request.url).searchParams.get("refresh") === "1") {
    try {
      await refreshRates();
    } catch {
      // keep serving the cache on failure
    }
  }

  return Response.json(await getRateInfo(user.id, user.currency));
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  switch (request.method) {
    case "POST": {
      const input = parseBody(rateOverrideSchema, await readBody(request));
      await setRateOverride(user.id, input.currency, input.rate);
      return Response.json(await getRateInfo(user.id, user.currency));
    }
    case "DELETE": {
      const currency = new URL(request.url).searchParams.get("currency");
      if (!currency || currency.length !== 3) {
        return Response.json({ error: "currency query param required" }, { status: 400 });
      }
      await deleteRateOverride(user.id, currency.toUpperCase());
      return Response.json(await getRateInfo(user.id, user.currency));
    }
    default:
      return new Response(null, { status: 405 });
  }
}
