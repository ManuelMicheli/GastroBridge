import { redirect } from "next/navigation";

// The standalone POS guide was folded into contextual help: next to each
// cash register (Finanze → Collegamenti → Gestisci casse) and in the "Aiuto"
// card of Stato collegamenti. Old links land there.
export default function GuidaRedirect() {
  redirect("/finanze/collegamenti");
}
