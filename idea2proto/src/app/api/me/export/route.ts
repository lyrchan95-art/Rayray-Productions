import { currentUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { exportUserData } from "@/lib/repo";

export const GET = handle(async () => {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Not signed in");
  const body = JSON.stringify(exportUserData(u.id), null, 2);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="idea2proto-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
