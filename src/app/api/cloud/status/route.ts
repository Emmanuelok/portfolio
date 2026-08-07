import { getCloudAvailability } from "@/lib/cloud/config";
import { cloudJson } from "@/lib/cloud/http";
import { createServerCloudClient } from "@/lib/cloud/server";

export const runtime = "nodejs";

export async function GET() {
  const availability = getCloudAvailability();
  if (!availability.configured) {
    return cloudJson({ ok: true, cloud: availability, authenticated: false });
  }

  const client = await createServerCloudClient();
  const { data } = client
    ? await client.auth.getUser()
    : { data: { user: null } };
  return cloudJson({
    ok: true,
    cloud: availability,
    authenticated: Boolean(data.user),
  });
}
