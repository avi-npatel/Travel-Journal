"use client";

import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";

interface ChipInputProps {
  id: string;
  value: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  /** Tidies an entry before it is added, e.g. lower-casing tags. */
  normalize?: (text: string) => string;
  /**
   * Treat commas as separators, so "food, hiking" becomes two entries. Right
   * for tags; wrong for places, where "Chicago, Illinois" is one entry.
   */
  splitOnComma?: boolean;
  /** Existing values offered as one-click buttons under the field. */
  suggestions?: string[];
}

/**
 * A list of short free-text entries (places, tags). Type one and press Enter
 * to add it; Backspace on an empty box removes the last.
 */
export function ChipInput({
  id,
  value,
  onChange,
  placeholder,
  normalize = (text) => text,
  splitOnComma = false,
  suggestions = [],
}: ChipInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");

  /** Adds what was typed (or pasted), skipping blanks and duplicates. */
  function add(text: string) {
    const entries = (splitOnComma ? text.split(",") : [text])
      .map((part) => normalize(part.trim().replace(/\s+/g, " ")))
      .filter(Boolean);
    const fresh = [...new Set(entries)].filter((entry) => !value.includes(entry));
    if (fresh.length > 0) onChange([...value, ...fresh]);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || (splitOnComma && event.key === ",")) {
      event.preventDefault(); // Enter must not submit the form
      add(draft);
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const unused = suggestions.filter((suggestion) => !value.includes(suggestion));

  return (
    <>
      <div
        className="field flex flex-wrap items-center gap-1.5 py-1.5"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((item) => (
          <span key={item} className="chip">
            {item}
            <button
              type="button"
              className="chip-remove"
              onClick={() => onChange(value.filter((v) => v !== item))}
              aria-label={`Remove ${item}`}
            >
              <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          className="min-w-32 flex-1 bg-transparent py-1 outline-none placeholder:text-muted/75"
          placeholder={value.length === 0 ? placeholder : ""}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          // Whatever is typed counts when leaving the field, Enter or not.
          onBlur={() => add(draft)}
        />
      </div>

      {unused.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="meta mr-1">Used before</span>
          {unused.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="tag min-h-7 py-0.5"
              onClick={() => onChange([...value, suggestion])}
            >
              <span aria-hidden="true">+ </span>
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
