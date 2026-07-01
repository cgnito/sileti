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
    <section id="how-it-works" className="py-24 md:py-32 bg-surface-bright relative overflow-hidden border-y border-border/40">
      <div className="max-w-screen-xl mx-auto px-4 md:px-margin-desktop">
        {/* Header Block */}
        <div className="max-w-xl mb-20 space-y-3">
          <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight text-on-surface">
            From signup to settled invoice
          </h2>
          <p className="font-body text-sm md:text-base text-on-surface-variant leading-relaxed">
            No migration team, no sales call required. Most schools are
            billing their first class within the hour.
          </p>
        </div>

        {/* Timeline Grid Sequence */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12 items-start relative">
          {steps.map((step, idx) => (
            <div 
              key={step.number} 
              className="relative flex flex-col group lg:after:content-[''] lg:after:absolute lg:after:top-5 lg:after:left-[calc(100%+16px)] lg:after:w-[calc(100%-32px)] lg:after:h-[1px] lg:after:bg-border/60 last:after:hidden"
            >
              {/* Sequential Indicator Counter */}
              <div
                className="text-4xl md:text-5xl font-mono font-medium tracking-tighter text-muted-foreground/20 leading-none mb-5 select-none transition-colors duration-300 group-hover:text-primary/30"
                aria-hidden
              >
                {step.number}
              </div>

              {/* Title & Core Copy Blocks */}
              <div className="space-y-2.5 pr-4">
                <h3 className="font-headline text-base md:text-lg font-bold text-on-surface tracking-tight">
                  {step.title}
                </h3>
                <p className="font-body text-xs md:text-sm text-on-surface-variant leading-relaxed opacity-95">
                  {step.description}
                </p>
              </div>

              {/* Micro Dot Layout Anchor for Mobile Separators */}
              <div className="w-1 h-1 rounded-full bg-border mt-6 md:hidden" aria-hidden />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}