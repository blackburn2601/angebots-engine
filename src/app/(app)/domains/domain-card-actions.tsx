"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Copy, Trash2 } from "lucide-react";

interface DomainCardActionsProps {
  domainId: string;
  domainName: string;
}

export function DomainCardActions({ domainId, domainName }: DomainCardActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Domäne „${domainName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/domains/${domainId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/v1/domains/${domainId}/duplicate`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        title="Domäne duplizieren"
        onClick={handleDuplicate}
        loading={duplicating}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        title="Domäne löschen"
        onClick={handleDelete}
        loading={deleting}
        className="text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}
