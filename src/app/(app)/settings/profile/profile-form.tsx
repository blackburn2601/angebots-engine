"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProfileFormProps {
  userId: string;
  userName: string;
  userEmail: string;
}

export function ProfileForm({ userId, userName, userEmail }: ProfileFormProps) {
  const [name, setName] = useState(userName);
  const [pw, setPw] = useState({ current: "", new: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgPw, setMsgPw] = useState("");

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      await fetch(`/api/v1/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setMsg("Name gespeichert ✓");
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.new !== pw.confirm) { setMsgPw("Passwörter stimmen nicht überein"); return; }
    setSavingPw(true);
    setMsgPw("");
    try {
      const res = await fetch(`/api/v1/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw.new }),
      });
      if (!res.ok) { setMsgPw("Fehler beim Speichern"); return; }
      setMsgPw("Passwort geändert ✓");
      setPw({ current: "", new: "", confirm: "" });
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profildaten</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveName} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>E-Mail</Label>
              <Input value={userEmail} disabled className="opacity-60" />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" loading={saving}>Speichern</Button>
              {msg && <span className="text-sm text-emerald-600">{msg}</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Passwort ändern</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Neues Passwort</Label>
              <Input type="password" value={pw.new} onChange={(e) => setPw((p) => ({ ...p, new: e.target.value }))} minLength={8} />
            </div>
            <div className="space-y-1.5">
              <Label>Wiederholen</Label>
              <Input type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" loading={savingPw} disabled={!pw.new || !pw.confirm}>
                Passwort ändern
              </Button>
              {msgPw && <span className={`text-sm ${msgPw.includes("✓") ? "text-emerald-600" : "text-destructive"}`}>{msgPw}</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
