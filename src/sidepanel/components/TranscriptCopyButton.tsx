import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Small copy-to-clipboard action next to each agent line in the live captions feed. */
export function TranscriptCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied/unavailable in this context — non-fatal,
      // the text is still fully visible on screen to copy by hand.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      className="shrink-0 rounded p-0.5 text-muted-foreground/70 transition-colors hover:bg-white/5 hover:text-foreground"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
