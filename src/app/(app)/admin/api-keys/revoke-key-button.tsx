"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RevokeKeyButton({ keyId }: { keyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function revoke() {
    if (!confirm("API-Key wirklich widerrufen?")) return;
    setLoading(true);
    try {
      await fetch(`/api/v1/api-keys/${keyId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={revoke} disabled={loading}>
      Widerrufen
    </Button>
  );
}
