const steps = [
  {
    number: "01",
    title: "Register your school",
    description:
      "Create your admin account and your school's profile in one step. Verify your email to activate it.",
  },
  {
    number: "02",
    title: "Set up classes & fee templates",
    description:
      "Add your class arms, then build itemized fee templates — tuition, levies, books — once per term.",
  },
  {
    number: "03",
    title: "Generate invoices in one run",
    description:
      "Pick a class and a template, and ṣilẹti creates an individual invoice for every active student instantly.",
  },
  {
    number: "04",
    title: "Get paid, automatically reconciled",
    description:
      "Parents pay via a Nomba checkout link sent on WhatsApp. Payments are verified and matched to the right invoice — no manual matching, ever.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-surface-container relative overflow-hidden">
      <div className="max-w-screen-xl mx-auto px-4 md:px-margin-desktop">
        <div className="max-w-xl mb-16">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-4">
            From signup to settled invoice
          </h2>
          <p className="font-body text-lg text-muted-foreground">
            No migration team, no sales call required. Most schools are
            billing their first class within the hour.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {steps.map((step) => (
            <div key={step.number} className="relative">
              <div
                className="text-6xl font-headline text-outline-variant/40 leading-none mb-4 select-none"
                aria-hidden
              >
                {step.number}
              </div>
              <h3 className="font-headline text-lg font-bold text-primary mb-3">
                {step.title}
              </h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}