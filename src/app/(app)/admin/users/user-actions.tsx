"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

interface UserActionsProps {
  userId: string;
  aktiv: boolean;
  rolle: string;
}

export function UserActions({ userId, aktiv }: UserActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function patch(data: Record<string, unknown>) {
    setLoading(true);
    try {
      await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={loading}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => patch({ muss_pw_aendern: true })}>
          Passwort zurücksetzen
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={aktiv ? "text-destructive" : "text-emerald-600"}
          onClick={() => patch({ aktiv: !aktiv })}
        >
          {aktiv ? "Benutzer deaktivieren" : "Benutzer aktivieren"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
