import { useActiveDeal } from "./hooks/useActiveDeal";
import { DealStatusCard } from "./components/DealStatusCard";

export default function App() {
  const { deal, loading } = useActiveDeal();

  return (
    <div className="min-h-screen bg-background p-4 text-foreground">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">Talk to CRM</h1>
        <p className="text-sm text-muted-foreground">Voice coaching for HubSpot &amp; Pipedrive deals.</p>
      </header>
      <DealStatusCard deal={deal} loading={loading} />
    </div>
  );
}
