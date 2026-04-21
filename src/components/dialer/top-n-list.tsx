interface TopNListRow {
  primary: string;
  secondary?: string;
  value: string;
  tag?: { label: string; color: string };
}

interface TopNListProps {
  title: string;
  color: string;
  rows: TopNListRow[];
  emptyMessage?: string;
}

export default function TopNList({
  title,
  color,
  rows,
  emptyMessage = "No data yet.",
}: TopNListProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/50 backdrop-blur overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <div
          className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase"
          style={{
            color,
            textShadow: `0 0 6px ${color}99`,
          }}
        >
          [ {title} ]
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center font-mono text-xs text-white/40">
          {emptyMessage}
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {rows.map((r, idx) => (
            <div
              key={`${r.primary}-${idx}`}
              className="px-4 py-2.5 flex items-center justify-between gap-3"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-sm text-white/80 truncate">
                  {r.primary}
                </span>
                {r.secondary && (
                  <span className="font-mono text-[0.6rem] uppercase tracking-wider text-white/40">
                    {r.secondary}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {r.tag && (
                  <span
                    className="font-mono text-[0.55rem] px-2 py-0.5 rounded uppercase tracking-wider"
                    style={{
                      color: r.tag.color,
                      border: `1px solid ${r.tag.color}40`,
                      background: `${r.tag.color}15`,
                    }}
                  >
                    {r.tag.label}
                  </span>
                )}
                <span
                  className="font-mono text-sm font-bold"
                  style={{ color, textShadow: `0 0 6px ${color}66` }}
                >
                  {r.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
