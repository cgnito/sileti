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
    <section id="faq" className="py-24 bg-surface-bright border-t border-border">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="font-headline text-3xl font-bold text-center mb-16">
          Common questions
        </h2>
        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <details
              key={faq.question}
              className="group border border-border rounded-xl bg-card transition-all"
              open={i === 0}
            >
              <summary className="flex justify-between items-center p-6 cursor-pointer list-none">
                <span className="font-headline text-lg font-bold text-on-surface">
                  {faq.question}
                </span>
                <span className="text-primary transition-transform group-open:rotate-180" aria-hidden>
                  ⌄
                </span>
              </summary>
              <div className="p-6 pt-0 text-muted-foreground border-t border-border/50">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
