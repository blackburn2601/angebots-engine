"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Copy, CheckCircle2 } from "lucide-react";

export function NewApiKeyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Fehler"); return; }
      const data = await res.json();
      setNewKey(data.key);
      router.refresh();
    } catch {
      setError("Fehler");
    } finally {
      setLoading(false);
    }
  }

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleClose() {
    setOpen(false);
    setNewKey(null);
    setLabel("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" />Neuer API-Key</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neuen API-Key erstellen</DialogTitle>
        </DialogHeader>
        {newKey ? (
          <div className="space-y-4 mt-2">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
              <p className="text-sm font-medium text-emerald-800 mb-2">
                Key wurde erstellt — kopiere ihn jetzt. Er wird nicht erneut angezeigt.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-white border px-3 py-2 text-xs font-mono">
                  {newKey}
                </code>
                <Button size="sm" variant="outline" onClick={copyKey}>
                  {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button onClick={handleClose} className="w-full">Fertig</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {error && <div className="text-sm text-destructive">{error}</div>}
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input
                placeholder="z.B. n8n Produktion"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>Abbrechen</Button>
              <Button type="submit" loading={loading} className="flex-1">Erstellen</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
