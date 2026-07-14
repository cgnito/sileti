import { Plus } from "lucide-react";

const faqs = [
  {
    question: "How secure is our school data?",
    answer:
      "We use industry-standard AES-256 encryption and host data on secure, redundant cloud servers. Your school's privacy and data sovereignty are our highest priorities.",
  },
  {
    question: "Can we migrate from our old system?",
    answer:
      "Yes. Our migration team handles the extraction and import of your existing student, staff, and financial records to ensure zero downtime.",
  },
  {
    question: "What is the cost structure?",
    answer:
      "Our pricing scales with your school's size, with flexible termly and annual plans designed to fit the budgets of growing schools.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-24 md:py-32 bg-surface relative overflow-hidden border-t border-border/40">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        {/* Header Block */}
        <div className="text-center mb-20 space-y-3">
          <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight text-on-surface">
            Common questions
          </h2>
          <p className="font-body text-sm md:text-base text-on-surface-variant max-w-xl mx-auto leading-relaxed">
            Everything you need to know about setting up your workspace on ṣilẹti.
          </p>
        </div>

        {/* Minimalist Accordion Row Assemblies */}
        <div className="divide-y divide-border/60 border-t border-b border-border/60">
          {faqs.map((faq, i) => (
            <details
              key={faq.question}
              className="group bg-transparent transition-all duration-300 open:bg-surface-container-low/40"
              open={i === 0}
            >
              <summary className="flex justify-between items-center py-6 px-4 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                <span className="font-headline text-base md:text-lg font-bold text-on-surface tracking-tight transition-colors duration-200 group-hover:text-primary">
                  {faq.question}
                </span>
                <span 
                  className="text-on-surface-variant/60 shrink-0 ml-4 transition-transform duration-300 ease-out group-open:rotate-45 group-open:text-primary" 
                  aria-hidden
                >
                  <Plus className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} />
                </span>
              </summary>
              
              <div className="px-4 pb-6 font-body text-xs md:text-sm text-on-surface-variant leading-relaxed max-w-2xl animate-in fade-in slide-in-from-top-1 duration-200">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}