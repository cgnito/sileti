import { Receipt, Banknote, Users2, type LucideIcon } from "lucide-react";

const cards: {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
  highlight: boolean;
}[] = [
  {
    icon: Receipt,
    title: "Fee Templates & Batch Invoicing",
    description:
      "Build itemized fee templates once, then generate invoices for an entire class in a single run — no chasing individual students.",
    features: ["Reusable fee templates", "One-click batch invoice runs"],
    highlight: false,
  },
  {
    icon: Banknote,
    title: "Payments That Reconcile Themselves",
    description:
      "Parents pay via a Nomba checkout link in WhatsApp. Every payment is cryptographically verified and matched to the right invoice automatically.",
    features: ["Nomba-powered checkout", "Automatic invoice reconciliation"],
    highlight: true,
  },
  {
    icon: Users2,
    title: "Student & Staff Records",
    description:
      "Add students individually or bulk-import a class roster by CSV. Invite staff with role-based access in a couple of clicks.",
    features: ["CSV bulk roster import", "Role-based staff invites"],
    highlight: false,
  },
];

export function ValuePropositionGrid() {
  return (
    <section id="platform" className="py-24 px-4 md:px-margin-desktop max-w-screen-xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="font-headline text-3xl font-bold text-on-surface mb-4">
          Built around the one problem that actually costs schools money
        </h2>
        <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto">
          Fee collection, invoicing, and payment reconciliation — done right,
          before anything else.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={
                card.highlight
                  ? "bg-primary-container p-10 rounded-xl border border-primary/20 shadow-sm text-on-primary-container flex flex-col h-full"
                  : "bg-card p-10 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow flex flex-col h-full"
              }
            >
              <div
                className={
                  card.highlight
                    ? "w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-6"
                    : "w-12 h-12 bg-primary-container/20 rounded-full flex items-center justify-center mb-6"
                }
              >
                <Icon
                  className={card.highlight ? "w-6 h-6 text-on-primary" : "w-6 h-6 text-primary"}
                  aria-hidden
                />
              </div>
              <h3 className="font-headline text-xl font-bold mb-4">{card.title}</h3>
              <p
                className={
                  card.highlight
                    ? "text-on-primary/80 mb-6"
                    : "text-muted-foreground mb-6"
                }
              >
                {card.description}
              </p>
              <ul className="mt-auto space-y-3">
                {card.features.map((feature) => (
                  <li
                    key={feature}
                    className={
                      card.highlight
                        ? "flex items-center gap-3 text-sm font-label text-on-primary"
                        : "flex items-center gap-3 text-sm font-label text-on-surface-variant"
                    }
                  >
                    <span aria-hidden>✓</span> {feature}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}