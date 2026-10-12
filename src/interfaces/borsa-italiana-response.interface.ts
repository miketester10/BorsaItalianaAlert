export interface BorsaItalianaSuccessResponse {
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

export interface BorsaItalianaErrorResponse {
  status: number;
  entityID: string;
  view: string;
  sessionQuality: string;
}

// Union type per gestire tutti i tipi di risposta
export type BorsaItalianaResponse = BorsaItalianaSuccessResponse | BorsaItalianaErrorResponse;

// Type guard per verificare se la risposta contiene dati validi
const isBorsaItalianaValidResponse = (
  response: BorsaItalianaResponse,
): response is BorsaItalianaSuccessResponse => {
  return "intradayPoint" in response && Array.isArray(response.intradayPoint);
};

/**
 * Esito estrazione ultimo prezzo: un'unica chiamata distingue
 * risposta invalida (`invalid`), dato assente/incoerente (`nodata`, con raw per i log)
 * e prezzo valido (`ok`). Prezzi Borsa sempre > 0.
 */
type LastPriceStatus =
  | { kind: "ok"; price: number; label: string }
  | { kind: "invalid" }
  | { kind: "nodata"; raw: unknown };

export const getLastPriceStatus = (response: BorsaItalianaResponse): LastPriceStatus => {
  if (!isBorsaItalianaValidResponse(response)) return { kind: "invalid" };
  const price = response.intradayPoint.at(-1)?.endPx;
  if (typeof price !== "number" || Number.isNaN(price) || price <= 0)
    return { kind: "nodata", raw: price };
  return { kind: "ok", price, label: response.label };
};
