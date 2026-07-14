import { Receipt, Banknote, Users2, Check, type LucideIcon } from "lucide-react";

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
    <section id="platform" className="py-24 md:py-32 px-4 md:px-margin-desktop  mx-auto bg-surface">
      {/* Header Block: Deliberate Type Hierarchy */}
      <div className="text-center mb-20 space-y-4">
        <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight text-on-surface max-w-2xl mx-auto leading-tight">
          Built around the one problem that actually costs schools money
        </h2>
        <p className="font-body text-sm md:text-base text-on-surface-variant max-w-xl mx-auto leading-relaxed">
          Fee collection, invoicing, and payment reconciliation — done right, before anything else.
        </p>
      </div>

      {/* Asymmetric Grid Layout Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 md:gap-8 items-stretch max-w-screen-xl mx-auto">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={
                card.highlight
                  ? "lg:col-span-4 bg-primary p-8 md:p-10 rounded-2xl border border-primary-container/20 shadow-xl text-white flex flex-col h-full transform hover:-translate-y-1 transition-all duration-300"
                  : "lg:col-span-3 bg-surface-container-low p-8 md:p-10 rounded-2xl border border-border shadow-sm hover:shadow-xl hover:border-border/40 transform hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
              }
            >
              {/* Icon Container Frame */}
              <div
                className={
                  card.highlight
                    ? "w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center mb-8"
                    : "w-11 h-11 bg-primary/5 rounded-xl flex items-center justify-center mb-8"
                }
              >
                <Icon
                  className={card.highlight ? "w-5 h-5 text-white" : "w-5 h-5 text-primary"}
                  aria-hidden
                />
              </div>

              {/* Text Blocks */}
              <div className="space-y-3 mb-8">
                <h3 className="font-headline text-lg md:text-xl font-bold tracking-tight">
                  {card.title}
                </h3>
                <p
                  className={
                    card.highlight
                      ? "text-white/80 font-body text-xs md:text-sm leading-relaxed"
                      : "text-on-surface-variant font-body text-xs md:text-sm leading-relaxed"
                  }
                >
                  {card.description}
                </p>
              </div>

              {/* Feature Points Assembly */}
              <ul className="mt-auto space-y-3 pt-4 border-t border-current/10">
                {card.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2.5 text-xs font-label font-medium tracking-wide"
                  >
                    <div
                      className={
                        card.highlight
                          ? "w-4 h-4 rounded-full bg-white/20 flex items-center justify-center shrink-0"
                          : "w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
                      }
                    >
                      <Check className={card.highlight ? "w-2.5 h-2.5 text-white" : "w-2.5 h-2.5 text-primary"} />
                    </div>
                    <span className={card.highlight ? "text-white/95" : "text-on-surface"}>
                      {feature}
                    </span>
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