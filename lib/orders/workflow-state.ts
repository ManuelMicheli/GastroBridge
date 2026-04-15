export type WorkflowState =
  | "confirmed"
  | "cancelled"
  | "rejected"
  | "pending_customer_confirmation"
  | "stock_conflict"
  | "packed";

export const WORKFLOW_TAG_RE = /\[workflow:([a-z_]+)\]/i;

export const WORKFLOW_STATE_MAP: Record<WorkflowState, string> = {
  confirmed: "confirmed",
  cancelled: "cancelled",
  rejected: "cancelled",
  pending_customer_confirmation: "submitted",
  stock_conflict: "submitted",
  packed: "preparing",
};

export function stripWorkflowTag(notes: string | null | undefined): string {
  if (!notes) return "";
  return notes.replace(WORKFLOW_TAG_RE, "").trim();
}

export function encodeWorkflowNotes(
  state: WorkflowState,
  existingNotes: string | null | undefined,
): string {
  const base = stripWorkflowTag(existingNotes);
  const tag = `[workflow:${state}]`;
  return base ? `${tag} ${base}` : tag;
}

export function getWorkflowState(
  splitStatus: string | null | undefined,
  supplierNotes: string | null | undefined,
): WorkflowState | string {
  const m = supplierNotes?.match(WORKFLOW_TAG_RE);
  if (m && m[1]) return m[1] as WorkflowState;
  return splitStatus ?? "submitted";
}
