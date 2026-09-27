import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { decryptSession, SESSION_COOKIE } from "@/lib/session";
import type { Role } from "@/generated/prisma/enums";

// Current logged-in user, or null. Cached per request.
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const session = await decryptSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, active: true, passwordChangedAt: true },
  });
  if (!user?.active) return null;
  // Opened before the last password change (e.g. on a lost laptop): no longer valid
  if (user.passwordChangedAt && Math.floor(user.passwordChangedAt.getTime() / 1000) > (session.iat ?? 0)) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active };
});

export async function requireUser(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/api/session/end");
  if (roles && !roles.includes(user.role)) redirect("/");
  return user;
}
