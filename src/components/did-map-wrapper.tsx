"use client";

import dynamic from "next/dynamic";
import type { AreaCodeGroup } from "@/lib/types";
import type { GapAnalysisResult } from "@/lib/gap-analysis";

const DIDMap = dynamic(() => import("@/components/did-map"), { ssr: false });

export default function DidMapWrapper(props: {
  groups: AreaCodeGroup[];
  gapAnalysis?: GapAnalysisResult | null;
}) {
  return <DIDMap {...props} />;
}
