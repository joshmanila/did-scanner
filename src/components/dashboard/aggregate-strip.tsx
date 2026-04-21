interface AggregateStripProps {
  dialsToday: number;
  contactRateToday: number;
  overCapTotal: number;
  dormantTotal: number;
  dialerCount: number;
}

export default function AggregateStrip({
  dialsToday,
  contactRateToday,
  overCapTotal,
  dormantTotal,
  dialerCount,
}: AggregateStripProps) {
  const cards = [
    {
      label: "DIALS TODAY",
      value: dialsToday.toLocaleString(),
      color: "#39ff14",
    },
    {
      label: "CONTACT RATE TODAY",
      value: `${(contactRateToday * 100).toFixed(1)}%`,
      color: "#00bfff",
    },
    {
      label: "DIDS OVER CAP",
      value: overCapTotal.toLocaleString(),
      color: "#ff9500",
    },
    {
      label: "DORMANT DIDS",
      value: dormantTotal.toLocaleString(),
      color: "#a020f0",
    },
    {
      label: "ACTIVE DIALERS",
      value: dialerCount.toLocaleString(),
      color: "#39ff14",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border bg-black/50 p-4 text-center backdrop-blur"
          style={{
            borderColor: `${c.color}33`,
            boxShadow: `0 0 15px ${c.color}15`,
          }}
        >
          <div
            className="font-mono text-[0.55rem] font-bold tracking-[0.2em] uppercase mb-2"
            style={{
              color: c.color,
              textShadow: `0 0 6px ${c.color}99`,
            }}
          >
            [ {c.label} ]
          </div>
          <div
            className="font-mono text-2xl font-bold"
            style={{
              color: c.color,
              textShadow: `0 0 10px ${c.color}66`,
            }}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
