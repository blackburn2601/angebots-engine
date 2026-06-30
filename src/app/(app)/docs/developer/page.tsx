import { requireRole } from "@/lib/auth-helpers";
import { developerDocs } from "@/generated/developer-docs";
import { DeveloperDocsClient } from "./developer-docs-client";

// Developer documentation (docs/developer/*.md) — restricted to SUPER_ADMIN.
// requireRole redirects anyone else to "/" before any content is rendered.
export default async function DeveloperDocsPage() {
  await requireRole("SUPER_ADMIN");
  return <DeveloperDocsClient docs={developerDocs} />;
}
