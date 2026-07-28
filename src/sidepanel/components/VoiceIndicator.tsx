import { cn } from "@/lib/utils";

const BAR_HEIGHTS = ["h-2", "h-4", "h-5", "h-3", "h-2"];

/**
 * Stylized equalizer bars for the listening/speaking states — animated via
 * CSS keyframes (wave-listening/wave-speaking, see tailwind.config.ts)
 * rather than driven by real audio amplitude. The ElevenLabs SDK doesn't
 * expose a live amplitude stream to key off of, and a purely decorative,
 * staggered pulse still reads clearly as "something is happening" without
 * needing one.
 */
export function VoiceIndicator({ speaking }: { speaking: boolean }) {
  return (
    <div className="flex h-5 items-end justify-center gap-1" aria-hidden="true">
      {BAR_HEIGHTS.map((height, i) => (
        <span
          key={i}
          className={cn(
            "w-1 origin-bottom rounded-full bg-cyan-400",
            height,
            speaking ? "animate-wave-speaking" : "animate-wave-listening",
          )}
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}

/** Shimmering skeleton bar for the connecting/"thinking" states. */
export function ShimmerBar() {
  return (
    <div className="h-2 w-2/3 overflow-hidden rounded-full bg-white/5">
      <div
        className="h-full w-1/3 animate-shimmer rounded-full bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent"
        style={{ backgroundSize: "200% 100%" }}
      />
    </div>
  );
}
