import { Check } from "lucide-react";
import { Button } from "@/src/components/shared/Button";

const plans = [
  {
    name: "Free",
    price: "₦0",
    period: "/month",
    features: [
      "Up to 50 students",
      "Basic fee collection",
      "Academic records",
      "Email support",
    ],
    cta: { label: "Get started for free", href: "/signup", variant: "secondary" as const },
    popular: false,
  },
  {
    name: "Pro",
    price: "₦25,000",
    period: "/month",
    features: [
      "Unlimited students",
      "Advanced fee engine",
      "Automated promotions",
      "Priority support",
      "Custom reports",
    ],
    cta: { label: "Upgrade to Pro", href: "/signup?plan=pro", variant: "primary" as const },
    popular: true,
  },
  {
    name: "Custom",
    price: "Contact us",
    period: "",
    features: [
      "Multi-campus management",
      "API access",
      "Dedicated account manager",
      "On-site training",
      "Custom integrations",
    ],
    cta: { label: "Talk to sales", href: "/contact", variant: "secondary" as const },
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 px-4 md:px-margin-desktop bg-surface-container-low border-t border-border">
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-4">
            Simple, transparent pricing
          </h2>
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your institution&apos;s scale and goals.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.popular
                  ? "bg-surface-container p-10 rounded-xl border-2 border-primary relative flex flex-col h-full shadow-lg md:scale-105 z-10"
                  : "bg-card p-10 rounded-xl border border-border flex flex-col h-full hover:shadow-md transition-shadow"
              }
            >
              {plan.popular && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-on-primary text-xs px-4 py-1 rounded-full uppercase tracking-widest font-bold shadow-sm">
                  Most popular
                </span>
              )}
              <div className="mb-8">
                <h3 className="font-headline text-xl font-bold text-on-surface">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-4 mb-10">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-3 text-sm text-on-surface-variant"
                  >
                    <Check className="w-5 h-5 text-primary shrink-0" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                href={plan.cta.href}
                variant={plan.cta.variant}
                className="mt-auto w-full"
              >
                {plan.cta.label}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
