import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SubscriptionState } from "../hooks/useSubscription";

interface SubscriptionGateProps {
  subscription: SubscriptionState | null;
}

// subscription is null for two different reasons that read the same way to
// a rep: never started a trial, or a trial/subscription that lapsed long
// enough ago it's not worth distinguishing in this copy. Either way, the
// fix is the same link.
export function SubscriptionGate({ subscription }: SubscriptionGateProps) {
  const marketingUrl = import.meta.env.VITE_MARKETING_SITE_URL;
  const everSubscribed = subscription !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{everSubscribed ? "Your trial has ended" : "Start your free trial"}</CardTitle>
        <CardDescription>
          {everSubscribed
            ? "Your Corner trial or subscription is no longer active. Reactivate it to keep talking through your deals."
            : "Corner isn't active on this account yet. Start a 7-day free trial to connect your CRM and start talking through deals."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full">
          <a href={`${marketingUrl}/pricing`} target="_blank" rel="noreferrer">
            {everSubscribed ? "Reactivate your plan" : "Start 7-day free trial"}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
