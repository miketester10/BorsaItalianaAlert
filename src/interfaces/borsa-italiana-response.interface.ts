export interface BorsaItalianaResponse {
  intradayPoint: IntradayPoint[];
  status: number;
  entityID: string;
  view: string;
  sessionQuality: string;
  currency: string;
  accuracy: number;
  tickSizeRule: string;
  label: string;
  instrType: string;
}

export interface BorsaItalianaErrorResponse {
  status: number;
  entityID: string;
  view: string;
  sessionQuality: string;
}

export interface BorsaItalianaHttpErrorResponse {
  timestamp: number;
  status: number;
  error: string;
  message: string;
}

// Union type per gestire tutti i tipi di risposta
export type BorsaItalianaApiResponse = BorsaItalianaResponse | BorsaItalianaErrorResponse;

// Type guard per verificare se la risposta contiene dati validi
export const isBorsaItalianaValidResponse = (response: BorsaItalianaApiResponse): response is BorsaItalianaResponse => {
  return "intradayPoint" in response && Array.isArray(response.intradayPoint);
};

export interface IntradayPoint {
  time: string;
  nbTrade: number;
  beginPx: number;
  beginTime: string;
  endPx: number;
  endTime: string;
  highPx: number;
  lowPx: number;
  beginAskPx: number;
  endAskPx: number;
  highAskPx: number;
  lowAskPx: number;
  beginBidPx: number;
  endBidPx: number;
  highBidPx: number;
  lowBidPx: number;
  vol: number;
  amt: number;
  previousClosingPx: number;
  previousClosingDt: string;
  previousSettlementPx: number;
  previousSettlementDt: string;
}
