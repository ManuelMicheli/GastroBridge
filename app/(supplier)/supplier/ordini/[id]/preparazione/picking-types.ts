/**
 * Task 12 — Tipi condivisi tra la server page e il client della picking list.
 *
 * Le view sono gia' arricchite lato server con proposta FEFO e alternative
 * disponibili, in modo che il client debba solo mostrare e confermare.
 */

export type PickingLotOption = {
  lotId: string;
  lotCode: string;
  expiryDate: string | null;
  receivedAt: string;
  quantityBase: number;
  quantityReservedBase: number;
};

export type PickingProposal = {
  lotId: string;
  lotCode: string;
  expiryDate: string | null;
  quantityBase: number;
};

export type PickedLotBreakdown = {
  lotId: string;
  lotCode: string;
  expiryDate: string | null;
  quantityBase: number;
};

export type PickingLineView = {
  splitItemId: string;
  productId: string;
  productName: string;
  quantityAccepted: number;
  quantityPicked: number;
  remaining: number;
  picked: boolean;
  /**
   * Proposta FEFO (1 o piu' allocazioni se un singolo lotto non basta a
   * coprire la quantita' residua da prelevare).
   */
  proposals: PickingProposal[];
  /**
   * Quantita' non coprivibile con i lotti gia' prenotati (se > 0 → alert).
   */
  proposalShortage: number;
  /** Tutti i lotti disponibili del prodotto nel magazzino dello split. */
  options: PickingLotOption[];
  /** Breakdown dei prelievi gia' confermati su questa riga. */
  pickedLots: PickedLotBreakdown[];
};

export type PickingInitialData = {
  splitId: string;
  orderShortId: string;
  restaurantName: string;
  expectedDeliveryDate: string | null;
  workflowState: string;
  lines: PickingLineView[];
};
