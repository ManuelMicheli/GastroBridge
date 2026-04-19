import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { LargeTitle } from "@/components/ui/large-title";

export default function TeamPage() {
  return (
    <div>
      {/* Mobile hero */}
      <div className="lg:hidden">
        <LargeTitle
          eyebrow="Impostazioni · Business"
          title="Team"
          subtitle="Invita i membri e gestisci ruoli"
        />
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-charcoal">Team</h1>
        <Badge variant="info">Business</Badge>
      </div>

      <div className="px-3 lg:px-0 mt-3 lg:mt-0">
        <Card className="text-center py-16">
          <Users className="h-12 w-12 text-sage-muted mx-auto mb-4" />
          <p className="text-sage mb-2">Funzionalita disponibile con il piano Business.</p>
          <p className="text-xs text-sage">Invita i membri del tuo team per gestire ordini e fornitori.</p>
        </Card>
      </div>
    </div>
  );
}
