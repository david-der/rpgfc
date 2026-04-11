import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Card } from "../components/ui/Card";
import { fetchHealth } from "../lib/api";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  return (
    // Wrapped in a <div> rather than <main> — the AppShell owns the
    // single top-level <main> so the landmark tree stays unambiguous.
    <div className="mx-auto max-w-prose px-6 py-16">
      <header className="border-b border-parchment-300 pb-6">
        <div className="text-xs uppercase tracking-wide text-parchment-500">Walking skeleton</div>
        <h1 className="mt-2 font-serif text-4xl font-medium text-parchment-900">RPG FC</h1>
        <p className="mt-3 font-serif text-lg leading-relaxed text-parchment-700">
          A football management game where merit is earned, identity is expressed through badges,
          and no player is ever reduced to a number.
        </p>
      </header>

      <section className="mt-10">
        <Card eyebrow="System" title="Backend health">
          <HealthBody
            loading={health.isPending}
            error={health.error}
            dialect={health.data?.dialect}
            commit={health.data?.commit}
          />
        </Card>
      </section>
    </div>
  );
}

interface HealthBodyProps {
  loading: boolean;
  error: Error | null;
  dialect: string | undefined;
  commit: string | undefined;
}

function HealthBody({ loading, error, dialect, commit }: HealthBodyProps) {
  if (loading) {
    return <p className="text-parchment-600">Checking the server&hellip;</p>;
  }
  if (error) {
    return (
      <p className="text-semantic-error">
        Could not reach the server. The dev proxy might not be running.
      </p>
    );
  }
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
      <dt className="text-parchment-500">Dialect</dt>
      <dd data-testid="health-dialect" className="font-mono text-parchment-900">
        {dialect}
      </dd>
      <dt className="text-parchment-500">Build</dt>
      <dd data-testid="health-commit-allowlist-number" className="font-mono text-parchment-700">
        {commit}
      </dd>
    </dl>
  );
}
