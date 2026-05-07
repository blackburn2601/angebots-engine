"use client";

import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>;
}

function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (typeof value === "boolean") return <span className="text-amber-600 font-medium">{String(value)}</span>;
  if (typeof value === "number") return <span className="text-blue-600 font-medium">{value}</span>;
  if (typeof value === "string") return <span className="text-emerald-700">&quot;{value}&quot;</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">[]</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          <span className="text-xs">[{value.length}]</span>
        </button>
        {!collapsed && (
          <span className="block pl-4 border-l-2 border-muted ml-1">
            {value.map((item, i) => (
              <span key={i} className="block">
                <span className="text-muted-foreground text-xs">{i}: </span>
                <JsonValue value={item} depth={depth + 1} />
                {i < value.length - 1 && <span className="text-muted-foreground">,</span>}
              </span>
            ))}
          </span>
        )}
      </span>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted-foreground">{"{}"}</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          <span className="text-xs">{`{${entries.length}}`}</span>
        </button>
        {!collapsed && (
          <span className="block pl-4 border-l-2 border-muted ml-1">
            {entries.map(([k, v], i) => (
              <span key={k} className="block">
                <span className="text-violet-600 font-medium">&quot;{k}&quot;</span>
                <span className="text-muted-foreground">: </span>
                <JsonValue value={v} depth={depth + 1} />
                {i < entries.length - 1 && <span className="text-muted-foreground">,</span>}
              </span>
            ))}
          </span>
        )}
      </span>
    );
  }

  return <span>{String(value)}</span>;
}

export function ConfigViewerClient({ config }: Props) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"tree" | "raw">("tree");

  const jsonString = JSON.stringify(config, null, 2);

  const copyJson = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">app-config.json</span>
          <span className="text-xs text-muted-foreground">
            {(new TextEncoder().encode(jsonString).length / 1024).toFixed(1)} KB
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setViewMode("tree")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${viewMode === "tree" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              Tree
            </button>
            <button
              onClick={() => setViewMode("raw")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${viewMode === "raw" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              Raw
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={copyJson}>
            {copied ? (
              <><Check className="h-3.5 w-3.5 text-emerald-500" /> Kopiert!</>
            ) : (
              <><Copy className="h-3.5 w-3.5" /> JSON kopieren</>
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 overflow-x-auto max-h-[70vh] overflow-y-auto">
        {viewMode === "raw" ? (
          <pre className="text-xs font-mono leading-relaxed text-foreground whitespace-pre">
            {jsonString}
          </pre>
        ) : (
          <div className="text-sm font-mono leading-relaxed">
            <JsonValue value={config} depth={0} />
          </div>
        )}
      </div>
    </div>
  );
}
