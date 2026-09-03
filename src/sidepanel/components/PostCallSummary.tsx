import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CoachingMemory } from "@/lib/coaching-memory/types";

function formatForClipboard(memory: CoachingMemory): string {
  const lines = ["Corner call summary"];
  if (memory.summary) lines.push(`Summary: ${memory.summary}`);
  if (memory.risk) lines.push(`Risk: ${memory.risk}`);
  if (memory.nextAction) lines.push(`Next step: ${memory.nextAction}`);
  return lines.join("\n");
}

/**
 * One-time, ephemeral block shown right after a call ends — not a
 * persistent history (the side panel deliberately doesn't show one, see
 * mem/design/coaching-memory-v1.md), just a chance to grab a clean summary
 * to paste into the CRM's own notes before it's gone. Disappears once the
 * rep dismisses it, starts a new call, or switches deals — never
 * resurfaces after that.
 */
export function PostCallSummary({ memory, onDismiss }: { memory: CoachingMemory; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const hasContent = !!(memory.summary || memory.risk || memory.nextAction);
  if (!hasContent) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatForClipboard(memory));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied/unavailable — non-fatal, the text is still
      // fully visible on screen to copy by hand.
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Call summary</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1.5 text-slate-200">
        {memory.summary && <p className="break-words">{memory.summary}</p>}
        {memory.risk && (
          <p className="break-words">
            <span className="font-medium text-foreground">Risk: </span>
            {memory.risk}
          </p>
        )}
        {memory.nextAction && (
          <p className="break-words">
            <span className="font-medium text-foreground">Next step: </span>
            {memory.nextAction}
          </p>
        )}
      </div>
      <Button size="sm" variant="outline" className="w-full" onClick={handleCopy}>
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy for your CRM
          </>
        )}
      </Button>
    </div>
  );
}
