import { auth } from "@/lib/auth";
import { authenticateApiKey } from "@/lib/api-key-auth";
import type { UserRolle } from "@/lib/auth-helpers";
import { requestAuthStore } from "@/lib/api-logger";

export type RequestAuth =
  | { type: "session"; userId: string; rolle: UserRolle }
  | { type: "api_key"; keyId: string };

export async function getRequestAuth(req: Request): Promise<RequestAuth | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const keyId = await authenticateApiKey(authHeader);
    if (!keyId) return null;
    const store = requestAuthStore.getStore();
    if (store) store.apiKeyId = keyId;
    return { type: "api_key", keyId };
  }
  const session = await auth();
  if (!session?.user) return null;
  const store = requestAuthStore.getStore();
  if (store) store.userId = session.user.id!;
  return {
    type: "session",
    userId: session.user.id!,
    rolle: (session.user as { rolle: UserRolle }).rolle,
  };
}

// API keys are admin-created and trusted — grant full access
export function hasRole(ctx: RequestAuth, ...roles: UserRolle[]): boolean {
  if (ctx.type === "api_key") return true;
  return roles.includes(ctx.rolle);
}
