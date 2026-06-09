"use client";

import { useState, useEffect } from "react";
import {
  Webhook, Plus, Pencil, Trash2, CheckCircle2, XCircle,
  ExternalLink, Copy, Check, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface WebhookUrl {
  id: string;
  label: string;
  url: string;
  description: string | null;
  aktiv: boolean;
  erstellt_am: string;
  updated_at: string;
}

function WebhookForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<WebhookUrl>;
  onSave: (data: { label: string; url: string; description: string; aktiv: boolean }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [aktiv, setAktiv] = useState(initial?.aktiv ?? true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!label.trim()) { setError("Bezeichnung ist erforderlich"); return; }
    if (!url.trim()) { setError("URL ist erforderlich"); return; }
    try { new URL(url); } catch { setError("Ungültige URL"); return; }
    await onSave({ label: label.trim(), url: url.trim(), description: description.trim(), aktiv });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="wh-label">Bezeichnung *</Label>
        <Input
          id="wh-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="z.B. n8n Angebot-erstellt"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wh-url">Webhook URL *</Label>
        <Input
          id="wh-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://n8n.example.com/webhook/..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wh-desc">Beschreibung</Label>
        <Input
          id="wh-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Wofür wird dieser Webhook verwendet?"
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch id="wh-aktiv" checked={aktiv} onCheckedChange={setAktiv} />
        <Label htmlFor="wh-aktiv">Aktiv</Label>
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Speichert…" : "Speichern"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WebhookUrl | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/webhooks");
      const data = await res.json();
      setWebhooks(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchWebhooks(); }, []);

  const handleSave = async (data: { label: string; url: string; description: string; aktiv: boolean }) => {
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/v1/admin/webhooks/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        await fetch("/api/v1/admin/webhooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      setDialogOpen(false);
      setEditing(null);
      await fetchWebhooks();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Webhook "${label}" wirklich löschen?`)) return;
    await fetch(`/api/v1/admin/webhooks/${id}`, { method: "DELETE" });
    await fetchWebhooks();
  };

  const handleToggle = async (webhook: WebhookUrl) => {
    await fetch(`/api/v1/admin/webhooks/${webhook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktiv: !webhook.aktiv }),
    });
    await fetchWebhooks();
  };

  const copyUrl = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Webhook className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Webhook URLs</h1>
            <p className="text-sm text-muted-foreground">n8n Workflow-Endpunkte verwalten</p>
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" />
          Webhook hinzufügen
        </Button>
      </div>

      {/* Info banner */}
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3">
        <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-700">
          <strong>Wozu dienen Webhook-URLs?</strong> Diese URLs werden von der Angebots-Engine aufgerufen,
          wenn bestimmte Ereignisse eintreten (z.B. neues Angebot erstellt). Typischerweise sind das n8n-Webhook-Trigger-URLs.
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">Lädt…</div>
      ) : webhooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 text-center">
          <Webhook className="h-8 w-8 text-muted-foreground mb-3" />
          <h3 className="font-semibold">Noch keine Webhooks</h3>
          <p className="mt-1 text-sm text-muted-foreground">Füge deinen ersten Webhook-Endpunkt hinzu</p>
          <Button className="mt-4" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" />Webhook hinzufügen
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className={cn(
                "rounded-xl border bg-card p-4 transition-all",
                !wh.aktiv && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{wh.label}</h3>
                    <Badge variant={wh.aktiv ? "success" : "secondary"}>
                      {wh.aktiv ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" />Aktiv</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" />Inaktiv</>
                      )}
                    </Badge>
                  </div>
                  {wh.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{wh.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <code className="text-xs font-mono text-muted-foreground bg-muted rounded px-2 py-0.5 truncate max-w-sm">
                      {wh.url}
                    </code>
                    <button
                      onClick={() => copyUrl(wh.url, wh.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="URL kopieren"
                    >
                      {copied === wh.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <a
                      href={wh.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="URL öffnen"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={wh.aktiv}
                    onCheckedChange={() => handleToggle(wh)}
                    title={wh.aktiv ? "Deaktivieren" : "Aktivieren"}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setEditing(wh); setDialogOpen(true); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(wh.id, wh.label)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" />
              {editing ? "Webhook bearbeiten" : "Neuer Webhook"}
            </DialogTitle>
          </DialogHeader>
          <WebhookForm
            initial={editing ?? undefined}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditing(null); }}
            saving={saving}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
