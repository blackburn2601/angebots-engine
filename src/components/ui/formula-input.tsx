"use client";

import { useRef, useState } from "react";
import type { Datenfeld } from "@/types/domain";

interface FormulaInputProps {
  value: string;
  onChange: (v: string) => void;
  fields: Datenfeld[];
  placeholder?: string;
}

const OPERATORS = ["+", "-", "*", "/", "(", ")", "Math.round()", "Math.floor()", "Math.ceil()", "Math.min(a,b)", "Math.max(a,b)"];

function getWordAtCursor(val: string, cursor: number) {
  let start = cursor;
  while (start > 0 && /[a-z0-9_]/.test(val[start - 1])) start--;
  let end = cursor;
  while (end < val.length && /[a-z0-9_]/.test(val[end])) end++;
  return { word: val.slice(start, end), start, end };
}

export function FormulaInput({ value, onChange, fields, placeholder }: FormulaInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [wordRange, setWordRange] = useState<{ start: number; end: number } | null>(null);

  const numericFields = fields.filter((f) => ["number", "formula", "output"].includes(f.typ));
  const fieldKeys = numericFields.map((f) => f.key);

  function updateSuggestions(val: string, cursor: number) {
    const { word, start, end } = getWordAtCursor(val, cursor);
    if (word.length >= 1) {
      const matches = fieldKeys.filter((k) => k.startsWith(word) && k !== word);
      setSuggestions(matches);
      setWordRange(matches.length > 0 ? { start, end } : null);
    } else {
      setSuggestions([]);
      setWordRange(null);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
    updateSuggestions(e.target.value, e.target.selectionStart ?? e.target.value.length);
  }

  function handleKeyUp(e: React.KeyboardEvent<HTMLInputElement>) {
    updateSuggestions(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length);
  }

  function applySuggestion(suggestion: string) {
    if (!wordRange) return;
    const newVal = value.slice(0, wordRange.start) + suggestion + value.slice(wordRange.end);
    onChange(newVal);
    setSuggestions([]);
    setWordRange(null);
    setTimeout(() => {
      if (inputRef.current) {
        const pos = wordRange.start + suggestion.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  function insertAtCursor(text: string) {
    const input = inputRef.current;
    if (!input) return;
    const pos = input.selectionStart ?? value.length;
    const newVal = value.slice(0, pos) + text + value.slice(pos);
    onChange(newVal);
    setTimeout(() => {
      input.focus();
      const newPos = pos + text.length;
      input.setSelectionRange(newPos, newPos);
    }, 0);
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyUp={handleKeyUp}
          onBlur={() => setTimeout(() => setSuggestions([]), 150)}
          placeholder={placeholder}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
            {suggestions.map((s) => (
              <div
                key={s}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono cursor-pointer hover:bg-muted"
                onMouseDown={() => applySuggestion(s)}
              >
                <span className="text-muted-foreground">field</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {numericFields.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="self-center text-xs text-muted-foreground mr-0.5">Felder:</span>
          {numericFields.map((f) => (
            <button
              key={f.key}
              type="button"
              title={f.label}
              onClick={() => insertAtCursor(f.key)}
              className="rounded bg-blue-50 px-2 py-0.5 text-xs font-mono text-blue-700 hover:bg-blue-100 transition-colors"
            >
              {f.key}
            </button>
          ))}
          <span className="self-center text-xs text-muted-foreground ml-1 mr-0.5">Ops:</span>
          {OPERATORS.map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => insertAtCursor(op)}
              className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground hover:bg-accent transition-colors"
            >
              {op}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
