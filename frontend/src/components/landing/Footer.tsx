import { Globe, Share2, Mail } from "lucide-react";

const platformLinks = [
  "Finance Management",
  "Academic Records",
  "Parent Portal",
  "Staff Dashboard",
];
const companyLinks = ["About us", "Success stories", "Careers", "Contact"];
const supportLinks = [
  "Help center",
  "Migration guide",
  "Privacy policy",
  "Terms of service",
];

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h5 className="text-xs font-label text-on-surface mb-6 uppercase tracking-widest">
        {title}
      </h5>
      <ul className="space-y-4">
        {links.map((link) => (
          <li key={link}>
            <a
              href="#"
              className="text-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-surface-container-highest pt-20 pb-10 border-t border-outline-variant">
      <div className="max-w-screen-xl mx-auto px-4 md:px-margin-desktop grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
        <div className="col-span-1">
          <h2 className="font-headline text-2xl font-bold text-primary mb-6">ṣilẹti</h2>
          <p className="text-sm text-on-surface-variant mb-6">
            Empowering African schools with modern digital infrastructure for
            financial and academic success.
          </p>
          <div className="flex gap-4">
            {[Globe, Share2, Mail].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="w-8 h-8 rounded-full border border-outline flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors"
              >
                <Icon className="w-4 h-4" aria-hidden />
              </a>
            ))}
          </div>
        </div>
        <FooterColumn title="Platform" links={platformLinks} />
        <FooterColumn title="Company" links={companyLinks} />
        <FooterColumn title="Support" links={supportLinks} />
      </div>
      <div className="max-w-screen-xl mx-auto px-4 md:px-margin-desktop pt-10 border-t border-outline-variant/30 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} ṣilẹti Technologies. Built for African
          schools.
        </p>
      </div>
    </footer>
  );
}
