import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export default function TeamPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-charcoal">Team</h1>
        <Badge variant="info">Business</Badge>
      </div>
      <Card className="text-center py-16">
        <Users className="h-12 w-12 text-sage-muted mx-auto mb-4" />
        <p className="text-sage mb-2">Funzionalita disponibile con il piano Business.</p>
        <p className="text-xs text-sage">Invita i membri del tuo team per gestire ordini e fornitori.</p>
      </Card>
    </div>
  );
}
