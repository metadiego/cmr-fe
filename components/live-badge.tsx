// «En vivo» pill shown while a screen's SSE stream is connected (useCitaStream().live). One markup for
// every live screen; each passes its own translated label.
export function LiveBadge({ label, className = "bg-success" }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-success-foreground ${className}`}>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-foreground opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-success-foreground" />
      </span>
      {label}
    </span>
  );
}
