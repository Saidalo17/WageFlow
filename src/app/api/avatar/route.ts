import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAvatar } from "@/lib/services/profile";

/** GET /api/avatar: the signed-in user's own profile photo. Nobody else's photo can be requested. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const avatar = await getAvatar(session.user.id);
  if (!avatar) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(avatar.bytes), {
    headers: {
      "Content-Type": avatar.mime,
      // The address carries ?v=<time of the upload>, so a new photo gets a new address and can be cached for long.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
