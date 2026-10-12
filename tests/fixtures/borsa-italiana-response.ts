import type {
  BorsaItalianaErrorResponse,
  BorsaItalianaSuccessResponse,
} from "../../src/interfaces/borsa-italiana-response.interface";

// Simula una risposta API valida con il prezzo specificato.
export const createValidResponse = (endPx: number): BorsaItalianaSuccessResponse => {
  return {
    label: "BTP PER I TEST",
    status: 200,
    entityID: "test-entity",
    view: "intraday",
    sessionQuality: "valid",
    currency: "EUR",
    accuracy: 2,
    tickSizeRule: "test",
    instrType: "BOND",
    intradayPoint: [
      {
        time: "12:00",
        nbTrade: 1,
        beginPx: endPx,
        beginTime: "12:00",
        endPx,
        endTime: "12:00",
        highPx: endPx,
        lowPx: endPx,
        beginAskPx: endPx,
        endAskPx: endPx,
        highAskPx: endPx,
        lowAskPx: endPx,
        beginBidPx: endPx,
        endBidPx: endPx,
        highBidPx: endPx,
        lowBidPx: endPx,
        vol: 1,
        amt: endPx,
        previousClosingPx: endPx,
        previousClosingDt: "2026-10-12",
        previousSettlementPx: endPx,
        previousSettlementDt: "2026-10-12",
      },
    ],
  };
};

// Simula una risposta valida, ma senza prezzi intraday.
export const createNoPriceResponse = (): BorsaItalianaSuccessResponse => {
  return {
    ...createValidResponse(100),
    intradayPoint: [],
  };
};

// Simula un ISIN non trovato dall'API.
export const createNotFoundResponse = (): BorsaItalianaErrorResponse => {
  return {
    status: 404,
    entityID: "",
    view: "",
    sessionQuality: "",
  };
};
