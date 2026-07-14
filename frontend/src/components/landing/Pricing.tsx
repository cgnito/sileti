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
    <section id="pricing" className="py-24 md:py-32 px-4 md:px-margin-desktop bg-surface relative overflow-hidden border-t border-border/40">
      <div className="max-w-screen-xl mx-auto">
        {/* Header Block */}
        <div className="text-center mb-20 space-y-4">
          <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight text-on-surface">
            Simple, transparent pricing
          </h2>
          <p className="font-body text-sm md:text-base text-on-surface-variant max-w-xl mx-auto leading-relaxed">
            Choose the plan that fits your institution&apos;s scale and goals.
          </p>
        </div>

        {/* Pricing Layout Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.popular
                  ? "bg-primary text-surface p-8 md:p-10 rounded-2xl relative flex flex-col h-full shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                  : "bg-surface-container-low p-8 md:p-10 rounded-2xl border border-border flex flex-col h-full hover:shadow-xl hover:border-border/40 transform hover:-translate-y-1 transition-all duration-300"
              }
            >
              {/* Optional Structural Badge */}
              {plan.popular && (
                <div className="mb-4">
                  <span className="inline-flex items-center bg-primary text-white text-[10px] font-label font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                    Most popular
                  </span>
                </div>
              )}

              {/* Identity & Pricing Header */}
              <div className="mb-8">
                <h3 className="font-headline text-lg font-bold tracking-tight opacity-90">
                  {plan.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl md:text-4xl font-headline font-bold tracking-tight">
                    {plan.price}
                  </span>
                  <span className={plan.popular ? "text-surface-variant/80 text-xs font-body" : "text-on-surface-variant/80 text-xs font-body"}>
                    {plan.period}
                  </span>
                </div>
              </div>

              {/* Core Offer Checklist */}
              <ul className="space-y-3.5 mb-10 pt-6 border-t border-current/10">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-xs md:text-sm font-body leading-relaxed"
                  >
                    <Check 
                      className={
                        plan.popular 
                          ? "w-4 h-4 text-primary shrink-0 mt-0.5" 
                          : "w-4 h-4 text-primary shrink-0 mt-0.5"
                      } 
                      aria-hidden 
                    />
                    <span className={plan.popular ? "text-surface-variant" : "text-on-surface-variant"}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Action Trigger Button */}
              <Button
                href={plan.cta.href}
                variant={plan.cta.variant}
                className={`mt-auto w-full transition-colors ${
                  plan.popular 
                    ? "bg-surface text-on-surface hover:bg-surface-variant" 
                    : ""
                }`}
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