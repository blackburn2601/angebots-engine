"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity, RefreshCw, Trash2, ChevronLeft, ChevronRight,
  Clock, Globe, AlertCircle, CheckCircle2, XCircle, Search,
  Info, Filter, MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  if (!code) return <span className="text-xs text-muted-foreground">–</span>;
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
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold font-mono shrink-0", colors[method] ?? "bg-muted text-muted-foreground")}>
      {method}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1.5 border-b last:border-0">
      <span className="text-xs font-medium text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="text-xs font-mono break-all">{value}</span>
    </div>
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
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [apiKeyMap, setApiKeyMap] = useState<Record<string, string>>({});

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
      const res = await fetch(`/api/v1/admin/logs?${params}`);
      const json = await res.json();
      setData(res.ok ? (json.data || { logs: [], total: 0, page, limit: 50 }) : { logs: [], total: 0, page, limit: 50 });
    } catch {
      setData({ logs: [], total: 0, page, limit: 50 });
    } finally {
      setLoading(false);
    }
  }, [page, pathFilter, methodFilter, statusFilter]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/users").then((r) => r.json()).catch(() => ({ data: [] })),
      fetch("/api/v1/api-keys").then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([usersRes, keysRes]) => {
      setUserMap(Object.fromEntries((usersRes.data ?? []).map((u: { id: string; name: string }) => [u.id, u.name])));
      setApiKeyMap(Object.fromEntries((keysRes.data ?? []).map((k: { id: string; label: string }) => [k.id, k.label])));
    });
  }, []);

  const clearLogs = async () => {
    if (!confirm("Alle Logs löschen? Das kann nicht rückgängig gemacht werden.")) return;
    setClearing(true);
    await fetch("/api/v1/admin/logs", { method: "DELETE" });
    setClearing(false);
    setSelectedLog(null);
    void fetchLogs();
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="flex flex-col h-full">

      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between gap-4 border-b bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">API-Logs</h1>
            <p className="text-xs text-muted-foreground">
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
            Löschen
          </Button>
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Log list ── */}
        <div className="flex flex-col w-[420px] shrink-0 border-r overflow-hidden">

          {/* Filters */}
          <div className="shrink-0 border-b bg-muted/20 px-3 py-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Pfad filtern…"
                value={pathFilter}
                onChange={(e) => { setPathFilter(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex gap-2">
              <select
                className="flex-1 rounded-md border bg-card px-2 py-1 text-xs"
                value={methodFilter}
                onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
              >
                <option value="">Alle Methoden</option>
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                className="flex-1 rounded-md border bg-card px-2 py-1 text-xs"
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
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Lädt…</div>
            ) : data?.logs.length === 0 ? (
              <div className="p-8 text-center">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Keine Einträge</p>
              </div>
            ) : data?.logs.map((log) => {
              const isSelected = selectedLog?.id === log.id;
              return (
                <button
                  key={log.id}
                  onClick={() => setSelectedLog(isSelected ? null : log)}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors",
                    isSelected
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-muted/50 border-l-2 border-l-transparent"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <MethodBadge method={log.method} />
                    <StatusBadge code={log.status_code} />
                    {log.error && <span className="text-xs text-destructive ml-auto">⚠ Fehler</span>}
                  </div>
                  <p className="text-xs font-mono truncate text-foreground mb-1">{log.path}</p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(log.zeitstempel), { addSuffix: true, locale: de })}
                    </span>
                    {log.duration_ms != null && (
                      <span className={log.duration_ms > 1000 ? "text-amber-600" : "text-emerald-600"}>
                        {log.duration_ms}ms
                      </span>
                    )}
                    {log.ip && (
                      <span className="flex items-center gap-1 ml-auto font-mono">
                        <Globe className="h-3 w-3" />{log.ip}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="shrink-0 border-t bg-muted/20 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Seite {page} / {totalPages}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Detail panel ── */}
        <div className="flex-1 overflow-y-auto">
          {!selectedLog ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-2">
                <MousePointerClick className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Eintrag auswählen</p>
                <p className="text-xs text-muted-foreground/60">Klicke auf einen Log-Eintrag in der Liste</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">

              {/* Detail header */}
              <div className="flex items-start gap-3 pb-4 border-b">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MethodBadge method={selectedLog.method} />
                    <StatusBadge code={selectedLog.status_code} />
                    {selectedLog.error && (
                      <span className="text-xs text-destructive font-medium">Fehler aufgetreten</span>
                    )}
                  </div>
                  <p className="font-mono text-sm font-medium break-all">{selectedLog.path}</p>
                </div>
              </div>

              {/* Meta */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3 w-3" /> Details
                </p>
                <div className="rounded-lg border bg-muted/20 px-3 divide-y">
                  <DetailRow label="Zeitpunkt" value={new Date(selectedLog.zeitstempel).toLocaleString("de-DE")} />
                  <DetailRow label="IP-Adresse" value={selectedLog.ip ?? "–"} />
                  <DetailRow label="Dauer" value={selectedLog.duration_ms != null ? `${selectedLog.duration_ms}ms` : "–"} />
                  <DetailRow
                    label="User-ID"
                    value={selectedLog.user_id
                      ? `${selectedLog.user_id}${userMap[selectedLog.user_id] ? ` (${userMap[selectedLog.user_id]})` : ""}`
                      : "–"}
                  />
                  <DetailRow
                    label="API-Key-ID"
                    value={selectedLog.api_key_id
                      ? `${selectedLog.api_key_id}${apiKeyMap[selectedLog.api_key_id] ? ` (${apiKeyMap[selectedLog.api_key_id]})` : ""}`
                      : "–"}
                  />
                  {selectedLog.error && (
                    <DetailRow label="Fehler" value={selectedLog.error} />
                  )}
                </div>
              </div>

              {/* Request Headers */}
              {selectedLog.request_headers && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Filter className="h-3 w-3" /> Request Headers
                  </p>
                  <pre className="rounded-lg border bg-muted/20 p-3 text-[11px] font-mono overflow-x-auto">
                    {JSON.stringify(JSON.parse(selectedLog.request_headers), null, 2)}
                  </pre>
                </div>
              )}

              {/* Request Body */}
              {selectedLog.request_body && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Request Body</p>
                  <pre className="rounded-lg border bg-muted/20 p-3 text-[11px] font-mono overflow-x-auto">
                    {JSON.stringify(JSON.parse(selectedLog.request_body), null, 2)}
                  </pre>
                </div>
              )}

              {/* Response Body */}
              {selectedLog.response_body && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Response Body</p>
                  <pre className="rounded-lg border bg-muted/20 p-3 text-[11px] font-mono overflow-x-auto">
                    {JSON.stringify(JSON.parse(selectedLog.response_body), null, 2)}
                  </pre>
                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
