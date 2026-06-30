"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Copy, Pencil, Trash2 } from "lucide-react";

interface DomainCardActionsProps {
  domainId: string;
  domainName: string;
}

export function DomainCardActions({ domainId, domainName }: DomainCardActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState("");

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState("");

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

  function openDuplicate() {
    setDuplicateName(`${domainName} (Kopie)`);
    setDuplicateError("");
    setDuplicateOpen(true);
  }

  async function handleDuplicate(e: React.FormEvent) {
    e.preventDefault();
    const name = duplicateName.trim();
    if (!name) return;
    setDuplicateError("");
    setDuplicating(true);
    try {
      const res = await fetch(`/api/v1/domains/${domainId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setDuplicateError(data?.error ?? "Fehler beim Duplizieren");
        return;
      }
      setDuplicateOpen(false);
      router.refresh();
    } catch {
      setDuplicateError("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setDuplicating(false);
    }
  }

  function openRename() {
    setRenameName(domainName);
    setRenameError("");
    setRenameOpen(true);
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const name = renameName.trim();
    if (!name || name === domainName) {
      setRenameOpen(false);
      return;
    }
    setRenameError("");
    setRenaming(true);
    try {
      const res = await fetch(`/api/v1/domains/${domainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setRenameError(data?.error ?? "Fehler beim Umbenennen");
        return;
      }
      setRenameOpen(false);
      router.refresh();
    } catch {
      setRenameError("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setRenaming(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        title="Domäne umbenennen"
        onClick={openRename}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        title="Domäne duplizieren"
        onClick={openDuplicate}
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

      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Domäne duplizieren</DialogTitle>
            <DialogDescription>
              Es wird eine Kopie der Konfiguration angelegt. Wähle einen Namen für die neue Domäne.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDuplicate} className="space-y-4 mt-2">
            {duplicateError && <div className="text-sm text-destructive">{duplicateError}</div>}
            <div className="space-y-1.5">
              <Label htmlFor="duplicate-name">Name der neuen Domäne</Label>
              <Input
                id="duplicate-name"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                required
                maxLength={100}
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDuplicateOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" loading={duplicating} className="flex-1">
                Duplizieren
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Domäne umbenennen</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4 mt-2">
            {renameError && <div className="text-sm text-destructive">{renameError}</div>}
            <div className="space-y-1.5">
              <Label htmlFor="rename-name">Name der Domäne</Label>
              <Input
                id="rename-name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                required
                maxLength={100}
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setRenameOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" loading={renaming} className="flex-1">
                Speichern
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
