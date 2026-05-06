import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export type UserRolle = "SUPER_ADMIN" | "DOMAIN_ADMIN" | "SELLER";

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  rolle: UserRolle;
  muss_pw_aendern: boolean;
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user as unknown as SessionUser;
}

export async function requireRole(...roles: UserRolle[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!roles.includes(user.rolle as UserRolle)) redirect("/");
  return user;
}

export function canManageUsers(rolle: UserRolle) {
  return rolle === "SUPER_ADMIN";
}

export function canManageApiKeys(rolle: UserRolle) {
  return rolle === "SUPER_ADMIN";
}

export function canManageDomains(rolle: UserRolle) {
  return rolle === "SUPER_ADMIN" || rolle === "DOMAIN_ADMIN";
}

export function canManagePricelists(rolle: UserRolle) {
  return rolle === "SUPER_ADMIN" || rolle === "DOMAIN_ADMIN";
}

export function canUseConfigurator(rolle: UserRolle) {
  return true; // all roles
}
