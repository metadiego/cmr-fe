"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getMyPreferences } from "@/lib/api/preferences";
import { commitRecipient, completeEmail, completeRecipients, domainSuggestions, lastToken, readEmailDomains } from "@/lib/email/domains";
import { Input } from "@/components/ui/input";

// The ONE email field of the app (handoff docs/specs/email-domain-autocomplete-handoff.md): a bare user
// part ("larciles") is completed with the first house domain (system preference `email.domains`) on
// Enter, comma, Tab or blur; after "@" the listed domains are suggested (Tab/Enter accepts). Full
// addresses with another domain are kept as typed. Empty list = a plain email input, as before.

let domainsOnce: Promise<string[]> | null = null;
function loadDomains(): Promise<string[]> {
  domainsOnce ??= getMyPreferences()
    .then((p) => readEmailDomains((p as { effective?: unknown }).effective))
    .catch(() => {
      domainsOnce = null; // retry next time, never invent a domain
      return [];
    });
  return domainsOnce;
}

export function useEmailDomains(): string[] {
  const [domains, setDomains] = React.useState<string[]>([]);
  React.useEffect(() => {
    let alive = true;
    loadDomains().then((d) => alive && setDomains(d));
    return () => {
      alive = false;
    };
  }, []);
  return domains;
}

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (v: string) => void;
  /** Several recipients separated by commas (the cash sheet email). */
  multiple?: boolean;
};

export function EmailInput({ value, onValueChange, multiple = false, onKeyDown, onBlur, className, ...rest }: Props) {
  const t = useTranslations("emailInput");
  const domains = useEmailDomains();
  const [focused, setFocused] = React.useState(false);

  const { head, token } = multiple ? lastToken(value) : { head: "", token: value.trim() };
  const suggestions = focused ? domainSuggestions(token, domains) : [];

  const completeAll = (v: string) => (multiple ? completeRecipients(v, domains) : completeEmail(v, domains));
  const accept = (full: string) => onValueChange(head + full);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === "Tab") && suggestions.length) {
      e.preventDefault();
      accept(suggestions[0]);
      return;
    }
    if (multiple && (e.key === "Enter" || e.key === ",")) {
      // A list: complete what is typed and leave ", " ready for the next recipient. Enter never sends.
      e.preventDefault();
      onValueChange(commitRecipient(value, domains));
      return;
    }
    if (e.key === "Enter") {
      const next = completeAll(value);
      if (next !== value) {
        // Completed: this keystroke only completes; the next Enter does what the form does.
        e.preventDefault();
        onValueChange(next);
        return;
      }
    }
    if (e.key === "Tab") {
      const next = completeAll(value);
      if (next !== value) onValueChange(next);
    }
    onKeyDown?.(e);
  }

  return (
    <div className="relative">
      <Input
        {...rest}
        type={multiple ? "text" : "email"}
        inputMode="email"
        autoComplete="off"
        spellCheck={false}
        value={value}
        className={className}
        onChange={(e) => onValueChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          const next = completeAll(value);
          if (next !== value) onValueChange(next);
          onBlur?.(e);
        }}
        onKeyDown={handleKeyDown}
        aria-autocomplete={domains.length ? "list" : undefined}
      />
      {suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label={t("suggestions")}
          className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover text-sm shadow-md"
        >
          {suggestions.map((s, i) => (
            <li key={s} role="option" aria-selected={i === 0}>
              <button
                type="button"
                // mousedown, not click: the input's blur would complete before the click lands.
                onMouseDown={(e) => {
                  e.preventDefault();
                  accept(s);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-accent ${i === 0 ? "bg-accent/60" : ""}`}
              >
                <span className="truncate font-mono">{s}</span>
                {i === 0 && <kbd className="shrink-0 text-[10px] text-muted-foreground">{t("tabHint")}</kbd>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
