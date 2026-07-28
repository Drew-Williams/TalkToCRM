import { useEffect, useState } from "react";

// chrome.commands reports shortcuts using its own token names (e.g.
// "Command", "MacCtrl") rather than the printable symbols people actually
// recognize — map the ones Chrome can assign to a manifest command.
const SYMBOL_MAP: Record<string, string> = {
  Command: "⌘",
  MacCtrl: "⌃",
  Ctrl: "Ctrl",
  Alt: "Alt",
  Option: "⌥",
  Shift: "⇧",
};

const IS_MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

function formatShortcut(shortcut: string): string {
  const parts = shortcut.split("+").map((part) => SYMBOL_MAP[part] ?? part);
  // Mac convention has no separator between symbol keys (⌘⇧K); everywhere
  // else reads better with one (Ctrl+Shift+K).
  return parts.join(IS_MAC ? "" : "+");
}

/**
 * Looks up the *actual* key combination assigned to a manifest command
 * (which the rep may have customized in chrome://extensions/shortcuts,
 * so this can't just be hardcoded from the manifest's suggested_key) — for
 * showing a live shortcut badge on the "Talk about this deal" CTA. Returns
 * null while unresolved or if the command has no shortcut assigned, so
 * callers can simply omit the badge rather than show a misleading one.
 */
export function useKeyboardShortcutLabel(commandName: string): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    chrome.commands
      ?.getAll()
      .then((commands) => {
        if (cancelled) return;
        const match = commands.find((c) => c.name === commandName);
        setLabel(match?.shortcut ? formatShortcut(match.shortcut) : null);
      })
      .catch(() => {
        // chrome.commands can be unavailable in some contexts — no badge is
        // a safe fallback, the button itself is still fully clickable.
      });
    return () => {
      cancelled = true;
    };
  }, [commandName]);

  return label;
}
