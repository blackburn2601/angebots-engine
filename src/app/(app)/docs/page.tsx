import { requireAuth } from "@/lib/auth-helpers";
import { DocsClient } from "./docs-client";

export default async function DocsPage() {
  const user = await requireAuth();
  return <DocsClient userRolle={user.rolle} />;
}
