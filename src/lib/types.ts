export interface AreaCodeInfo {
  lat: number;
  lng: number;
  city: string;
  state: string;
  country: string;
}

export interface AreaCodeLookup {
  [areaCode: string]: AreaCodeInfo;
}

export interface ParsedDID {
  raw: string;
  cleaned: string;
  areaCode: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
}

export interface AreaCodeGroup {
  areaCode: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
  dids: string[];
}

export interface SummaryStats {
  totalDIDs: number;
  uniqueAreaCodes: number;
  stateBreakdown: { [state: string]: number };
  unmappedCount: number;
}
