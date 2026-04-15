export type LotCandidate = {
  id: string;
  productId: string;
  warehouseId: string;
  lotCode: string;
  expiryDate: string | null; // ISO date yyyy-mm-dd
  receivedAt: string; // ISO timestamp
  quantityBase: number;
  quantityReservedBase: number;
};

export type FefoAllocation = {
  lotId: string;
  quantityBase: number;
};

export type FefoResult =
  | { ok: true; allocations: FefoAllocation[] }
  | {
      ok: false;
      reason: "insufficient_stock";
      shortBy: number;
      allocations: FefoAllocation[];
    };
