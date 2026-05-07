"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity, RefreshCw, Trash2, Filter, ChevronLeft, ChevronRight,
  Clock, Globe, AlertCircle, CheckCircle2, XCircle, Search,
  ArrowUpDown, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface ApiLogEntry {
  id: string;
  method: string;
  path: string;
  status_code: number | null;
  duration_ms: number | null;
  request_headers: string | null;
  request_body: string | null;
  response_body: string | null;
  ip: string | null;
  user_id: string | null;
  api_key_id: string | null;
  error: string | null;
  zeitstempel: string;
}

interface LogsResponse {
  logs: ApiLogEntry[];
  total: number;
  page: number;
  limit: number;
}

function StatusBadge({ code }: { code: number | null }) {
  if (!code) return <Badge variant="secondary">–</Badge>;
  if (code < 300) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
      <CheckCircle2 className="h-3 w-3" />{code}
    </span>
  );
  if (code < 400) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
      <Info className="h-3 w-3" />{code}
    </span>
  );
  if (code < 500) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
      <AlertCircle className="h-3 w-3" />{code}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
      <XCircle className="h-3 w-3" />{code}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-blue-100 text-blue-700",
    POST: "bg-emerald-100 text-emerald-700",
    PUT: "bg-amber-100 text-amber-700",
    PATCH: "bg-violet-100 text-violet-700",
    DELETE: "bg-red-100 text-red-700",
  };
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold font-mono", colors[method] ?? "bg-muted text-muted-foreground")}>
      {method}
    </span>
  );
}

export default function AdminLogsPage() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pathFilter, setPathFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<ApiLogEntry | null>(null);
  const [clearing, setClearing] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "50",
      ...(pathFilter ? { path: pathFilter } : {}),
      ...(methodFilter ? { method: methodFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    });
    try {
      const res = await fetch(`/api/admin/logs?${params}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [page, pathFilter, methodFilter, statusFilter]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  const clearLogs = async () => {
    if (!confirm("Alle Logs löschen? Das kann nicht rückgängig gemacht werden.")) return;
    setClearing(true);
    await fetch("/api/admin/logs", { method: "DELETE" });
    setClearing(false);
    void fetchLogs();
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">API-Logs</h1>
            <p className="text-sm text-muted-foreground">
              {data ? `${data.total.toLocaleString()} Einträge` : "Lädt…"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Aktualisieren
          </Button>
          <Button variant="destructive" size="sm" onClick={clearLogs} disabled={clearing}>
            <Trash2 className="h-4 w-4" />
            Logs löschen
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 w-56"
            placeholder="Pfad filtern…"
            value={pathFilter}
            onChange={(e) => { setPathFilter(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="rounded-md border bg-card px-3 py-2 text-sm"
          value={methodFilter}
          onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
        >
          <option value="">Alle Methoden</option>
          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          className="rounded-md border bg-card px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">Alle Status</option>
          <option value="200">200 OK</option>
          <option value="201">201 Created</option>
          <option value="400">400 Bad Request</option>
          <option value="401">401 Unauthorized</option>
          <option value="404">404 Not Found</option>
          <option value="429">429 Too Many Requests</option>
          <option value="500">500 Server Error</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="p-3 text-left font-medium text-muted-foreground">
                <span className="flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />Zeitpunkt</span>
              </th>
              <th className="p-3 text-left font-medium text-muted-foreground">Methode</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Pfad</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="p-3 text-left font-medium text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Dauer</span>
              </th>
              <th className="p-3 text-left font-medium text-muted-foreground">
                <span className="flex items-center gap-1"><Globe className="h-3 w-3" />IP</span>
              </th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Lädt…</td></tr>
            ) : data?.logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center">
                  <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Keine Log-Einträge vorhanden</p>
                  <p className="text-xs text-muted-foreground mt-1">Logs werden bei API-Anfragen automatisch erstellt</p>
                </td>
              </tr>
            ) : data?.logs.map((log) => (
              <tr
                key={log.id}
                className="hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => setSelectedLog(log === selectedLog ? null : log)}
              >
                <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(log.zeitstempel), { addSuffix: true, locale: de })}
                </td>
                <td className="p-3"><MethodBadge method={log.method} /></td>
                <td className="p-3 font-mono text-xs max-w-[200px] truncate">{log.path}</td>
                <td className="p-3"><StatusBadge code={log.status_code} /></td>
                <td className="p-3 text-xs text-muted-foreground">
                  {log.duration_ms != null ? (
                    <span className={cn(log.duration_ms > 1000 ? "text-amber-600" : "text-emerald-600")}>
                      {log.duration_ms}ms
                    </span>
                  ) : "–"}
                </td>
                <td className="p-3 text-xs text-muted-foreground font-mono">{log.ip ?? "–"}</td>
                <td className="p-3 text-right">
                  <span className="text-xs text-muted-foreground">{log.error ? "⚠️" : ""}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selectedLog && (
        <div className="mt-4 rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-3">
              <MethodBadge method={selectedLog.method} />
              <span className="font-mono text-sm font-medium">{selectedLog.path}</span>
              <StatusBadge code={selectedLog.status_code} />
            </div>
            <button
              onClick={() => setSelectedLog(null)}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              ✕ Schließen
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            {/* Meta */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" /> Details
              </p>
              <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-xs">
                {[
                  ["Zeitpunkt", new Date(selectedLog.zeitstempel).toLocaleString("de-DE")],
                  ["IP-Adresse", selectedLog.ip ?? "–"],
                  ["Dauer", selectedLog.duration_ms != null ? `${selectedLog.duration_ms}ms` : "–"],
                  ["User-ID", selectedLog.user_id ?? "–"],
                  ["API-Key-ID", selectedLog.api_key_id ?? "–"],
                  ...(selectedLog.error ? [["Fehler", selectedLog.error]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="font-medium w-24 shrink-0 text-muted-foreground">{k}</span>
                    <span className="break-all font-mono">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Headers */}
            {selectedLog.request_headers && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Filter className="h-3 w-3" /> Request Headers
                </p>
                <pre className="rounded-lg bg-muted/40 border p-3 text-[11px] font-mono overflow-x-auto max-h-48 overflow-y-auto">
                  {JSON.stringify(JSON.parse(selectedLog.request_headers), null, 2)}
                </pre>
              </div>
            )}

            {/* Request Body */}
            {selectedLog.request_body && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Request Body</p>
                <pre className="rounded-lg bg-muted/40 border p-3 text-[11px] font-mono overflow-x-auto max-h-48 overflow-y-auto">
                  {JSON.stringify(JSON.parse(selectedLog.request_body), null, 2)}
                </pre>
              </div>
            )}

            {/* Response Body */}
            {selectedLog.response_body && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Response Body</p>
                <pre className="rounded-lg bg-muted/40 border p-3 text-[11px] font-mono overflow-x-auto max-h-48 overflow-y-auto">
                  {JSON.stringify(JSON.parse(selectedLog.response_body), null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Seite {page} von {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
