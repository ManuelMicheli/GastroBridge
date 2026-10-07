import { RouteNotFoundView } from "@/components/fernly/route-states";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--f-canvas,#ECEEED)]">
      <RouteNotFoundView homeHref="/" homeLabel="Torna alla home" />
    </div>
  );
}
