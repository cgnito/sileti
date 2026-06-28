const institutions = [
  "Lagos Academy",
  "Nairobi Heights",
  "Accra International",
  "Kigali Tech Prep",
  "Durban Grammar",
  "Cairo British School",
];

export function SocialProofMarquee() {
  return (
    <section className="py-12 bg-surface-container-low border-y border-border overflow-hidden">
      <p className="text-center text-xs font-label text-muted-foreground mb-8 uppercase tracking-widest">
        Trusted by 500+ premier institutions
      </p>
      <div className="flex whitespace-nowrap overflow-hidden">
        <div className="flex gap-16 items-center animate-marquee" style={{ width: "200%" }}>
          {[0, 1].map((repeat) => (
            <div key={repeat} className="flex items-center gap-16 px-8">
              {institutions.map((name) => (
                <span
                  key={`${repeat}-${name}`}
                  className="font-headline text-2xl text-outline italic opacity-60"
                >
                  {name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
