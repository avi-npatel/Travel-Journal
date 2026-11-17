"use client";

import type { KeyboardEvent } from "react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { COUNTRIES, countryName } from "@/lib/countries";

interface CountryPickerProps {
  id: string;
  value: string[];
  onChange: (codes: string[]) => void;
  placeholder?: string;
}

const MAX_RESULTS = 8;

/** Lower-cased, accents removed, so "cote" finds "Côte d'Ivoire". */
const searchable = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const INDEX = COUNTRIES.map((country) => ({ ...country, key: searchable(country.name) }));

/**
 * Pick any number of countries by typing. Chosen countries show as chips;
 * the text box follows the standard combobox keyboard pattern (arrows to
 * move, Enter to choose, Escape to close, Backspace on empty removes the last).
 */
export function CountryPicker({ id, value, onChange, placeholder = "Type a country…" }: CountryPickerProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const needle = searchable(query.trim());
  const results = needle
    ? INDEX.filter((country) => !value.includes(country.code) && country.key.includes(needle))
        // Names that start with the query rank above names that merely contain it.
        .sort((a, b) => Number(b.key.startsWith(needle)) - Number(a.key.startsWith(needle)))
        .slice(0, MAX_RESULTS)
    : [];
  const showList = open && needle.length > 0;

  function add(code: string) {
    onChange([...value, code]);
    setQuery("");
    setHighlighted(0);
    inputRef.current?.focus();
  }

  function remove(code: string) {
    onChange(value.filter((c) => c !== code));
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setOpen(true);
      setHighlighted((current) => (current + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      // Never let Enter in this box submit the surrounding form.
      event.preventDefault();
      if (showList && results[highlighted]) add(results[highlighted].code);
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Backspace" && query === "" && value.length > 0) {
      remove(value[value.length - 1]);
    }
  }

  return (
    <div className="relative">
      <div
        className="field flex flex-wrap items-center gap-1.5 py-1.5"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((code) => (
          <span key={code} className="chip">
            {countryName(code)}
            <button
              type="button"
              className="chip-remove"
              onClick={() => remove(code)}
              aria-label={`Remove ${countryName(code)}`}
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
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && results[highlighted] ? `${listId}-${results[highlighted].code}` : undefined
          }
          autoComplete="off"
          className="min-w-32 flex-1 bg-transparent py-1 outline-none placeholder:text-muted/75"
          placeholder={value.length === 0 ? placeholder : ""}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => setOpen(true)}
          // Delay so a click on an option lands before the list closes.
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching countries"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded border border-ink bg-raised py-1"
        >
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">No country matches “{query}”.</li>
          )}
          {results.map((country, index) => (
            <li
              key={country.code}
              id={`${listId}-${country.code}`}
              role="option"
              aria-selected={index === highlighted}
              className={cn(
                "flex cursor-pointer items-baseline justify-between gap-4 px-3 py-2",
                index === highlighted && "bg-accent text-on-accent",
              )}
              onMouseEnter={() => setHighlighted(index)}
              // mousedown, not click: it fires before the input loses focus.
              onMouseDown={(event) => {
                event.preventDefault();
                add(country.code);
              }}
            >
              <span>{country.name}</span>
              <span className={cn("meta", index === highlighted && "text-on-accent")}>
                {country.continent}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
