import type { PlaygroundAppProps } from "../../platform/types";

const accounts = [
  { label: "Cash", value: "$8,420", tone: "green" },
  { label: "Invested", value: "$42,180", tone: "blue" },
  { label: "Upcoming", value: "$1,260", tone: "amber" },
];

export default function FinanceApp({ site, storage }: PlaygroundAppProps) {
  const target = storage.get("target") ?? "$55,000";

  return (
    <main className="app app--finance">
      <header className="app__header">
        <div>
          <p className="eyebrow">/{site.slug}/</p>
          <h1>{site.title}</h1>
        </div>
        <span className="metric">{target} target</span>
      </header>

      <section className="finance-grid">
        {accounts.map((account) => (
          <article className={`account-card account-card--${account.tone}`} key={account.label}>
            <span>{account.label}</span>
            <strong>{account.value}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
