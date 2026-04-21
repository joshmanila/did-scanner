"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import type { Dialer } from "@/db/schema";

interface DialerPickerProps {
  dialers: Dialer[];
  activeDialerId?: string;
}

export default function DialerPicker({
  dialers,
  activeDialerId,
}: DialerPickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const active = dialers.find((d) => d.id === activeDialerId);
  const label = active ? `Dialer: ${active.name}` : "Dialers";

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`font-mono text-[0.65rem] font-bold tracking-wider uppercase px-3 py-1.5 rounded border transition-all inline-flex items-center gap-2 ${
          active
            ? "border-[#00bfff]/40 text-[#00bfff] bg-[#00bfff]/10"
            : "border-white/10 text-white/60 hover:text-[#00bfff] hover:border-[#00bfff]/40 hover:bg-[#00bfff]/5"
        }`}
      >
        <span>{label}</span>
        <span className="text-[0.55rem]">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[200px] rounded-lg border border-white/10 bg-black/95 backdrop-blur shadow-[0_0_20px_rgba(0,0,0,0.8)] z-50 overflow-hidden">
          {dialers.length === 0 ? (
            <div className="px-4 py-3 font-mono text-[0.65rem] text-white/40">
              No dialers yet.
            </div>
          ) : (
            dialers.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  router.push(`/dialer/${d.id}`);
                  setOpen(false);
                }}
                className={`w-full text-left font-mono text-xs px-4 py-2 transition-all flex items-center justify-between gap-3 ${
                  d.id === activeDialerId
                    ? "text-[#00bfff] bg-[#00bfff]/10"
                    : "text-white/70 hover:text-[#00bfff] hover:bg-[#00bfff]/5"
                }`}
              >
                <span>{d.name}</span>
                {!d.isActive && (
                  <span className="text-[0.55rem] uppercase tracking-widest text-white/30">
                    paused
                  </span>
                )}
              </button>
            ))
          )}
          <div className="border-t border-white/10" />
          <button
            onClick={() => {
              router.push("/settings");
              setOpen(false);
            }}
            className="w-full text-left font-mono text-[0.65rem] px-4 py-2 text-white/50 hover:text-[#39ff14] hover:bg-[#39ff14]/5 uppercase tracking-wider"
          >
            + Manage dialers
          </button>
        </div>
      )}
    </div>
  );
}
