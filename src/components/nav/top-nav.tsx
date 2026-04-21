import Link from "next/link";
import { getAllDialers } from "@/lib/queries";
import DialerPicker from "./dialer-picker";

export default async function TopNav({
  activeDialerId,
}: {
  activeDialerId?: string;
}) {
  const dialers = await getAllDialers();

  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-3">
          <span
            className="font-mono text-sm font-bold tracking-[0.25em] uppercase text-[#39ff14] text-glow-green"
            style={{ textShadow: "0 0 8px rgba(57,255,20,0.6)" }}
          >
            DID SCANNER
          </span>
          <span className="hidden sm:inline-block font-mono text-[0.55rem] tracking-widest uppercase text-white/30">
            Convoso Multi-Dialer
          </span>
        </Link>
        <nav className="flex items-center gap-2 ml-auto">
          <NavLink href="/" label="Dashboard" />
          <DialerPicker dialers={dialers} activeDialerId={activeDialerId} />
          <NavLink href="/settings" label="Settings" />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="font-mono text-[0.65rem] font-bold tracking-wider uppercase px-3 py-1.5 rounded border border-white/10 text-white/60 hover:text-[#39ff14] hover:border-[#39ff14]/40 hover:bg-[#39ff14]/5 transition-all"
    >
      {label}
    </Link>
  );
}
