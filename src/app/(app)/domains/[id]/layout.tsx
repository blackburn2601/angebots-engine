import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { notFound } from "next/navigation";
import { DomainNav } from "./domain-nav";

export default async function DomainLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN", "SELLER");
  const { id } = params;

  const domain = await prisma.domain.findUnique({ where: { id } });
  if (!domain) notFound();

  return (
    <div className="flex h-full flex-col">
      <DomainNav domainId={id} domainName={domain.name} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
