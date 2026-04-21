"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<{ key: string; label: string; suffix: string }> = [
  { key: "overview", label: "Overview", suffix: "" },
  { key: "dids", label: "DIDs", suffix: "/dids" },
  { key: "area-codes", label: "Area Codes", suffix: "/area-codes" },
  { key: "gap-analysis", label: "Gap Analysis", suffix: "/gap-analysis" },
  { key: "acid-lists", label: "ACID Lists", suffix: "/acid-lists" },
];

export default function SubTabRow({ dialerId }: { dialerId: string }) {
  const pathname = usePathname();
  const base = `/dialer/${dialerId}`;
  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/50 backdrop-blur p-1 overflow-x-auto">
      {TABS.map((t) => {
        const href = `${base}${t.suffix}`;
        const active = t.suffix === "" ? pathname === base : pathname?.startsWith(href);
        return (
          <Link
            key={t.key}
            href={href}
            className={`font-mono text-[0.65rem] font-bold tracking-wider uppercase px-4 py-2 rounded transition-all whitespace-nowrap ${
              active
                ? "bg-[#39ff14]/15 text-[#39ff14] shadow-[inset_0_-2px_0_#39ff14]"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
