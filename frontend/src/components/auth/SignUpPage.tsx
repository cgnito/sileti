"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { Logo } from "@/src/components/shared/Logo";
import { useRegister } from "../../features/auth/hooks/auth.hooks";

export default function SignupPage() {
  const router = useRouter();
  const { register, isLoading, error } = useRegister();

  const [schoolName, setSchoolName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreedToTerms) return;

    try {
      await register({
        schoolName,
        shortCode: shortCode || undefined,
        schoolEmail,
        password,
      });

      router.push(`/verify-email?email=${encodeURIComponent(schoolEmail)}`);
    } catch {
      // Error captured by useRegister hook
    }
  }

  return (
    <main className="flex flex-col lg:flex-row min-h-screen bg-surface">
      {/* Left Panel: Clean, Intentional Product Spotlight Frame */}
      <section className="hidden lg:flex lg:w-[40%] bg-surface-container-low border-r border-border relative overflow-hidden flex-col justify-between p-12">
        <div className="z-10 space-y-8">
          <Logo />
          <div className="space-y-3 mt-6">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface leading-tight max-w-sm">
              Run your school on autopilot.
            </h1>
            <p className="text-on-surface-variant font-body text-sm max-w-xs leading-relaxed">
              The modern operating system built for West African academic excellence and financial clarity.
            </p>
          </div>
        </div>

        {/* Apple-Style Showcase Window Frame */}
        <div className="relative w-[115%] aspect-[4/3] rounded-l-xl border border-border bg-white shadow-2xl overflow-hidden my-auto translate-x-12 transform scale-105 border-r-0 transition-all duration-300">
          <div className="h-6 w-full bg-surface-container-low border-b border-border/60 flex items-center px-3 gap-1.5">
            <div className="w-2 h-2 rounded-full bg-border" />
            <div className="w-2 h-2 rounded-full bg-border" />
            <div className="w-2 h-2 rounded-full bg-border" />
          </div>
          <img 
            src="/images/dashboard-preview.png" 
            alt="ṣilẹti School Operating Dashboard Preview" 
            className="w-full h-[calc(100%-24px)] object-cover object-left-top select-none opacity-95"
            draggable={false}
          />
        </div>

        <div className="z-10 mt-auto">
          <p className="text-[10px] font-label text-muted-foreground uppercase tracking-widest font-semibold">
            Built for African schools
          </p>
        </div>

        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary-container/5 rounded-full blur-3xl" />
      </section>

      {/* Right Panel: Clean, Uncluttered Entry Field Block */}
      <section className="flex-1 flex flex-col justify-between p-6 md:p-12 lg:p-16 relative min-h-screen lg:min-h-0">
        
        {/* Mobile View Top Branding Anchor */}
        <header className="w-full flex items-center mb-8 lg:hidden">
          <Logo />
        </header>

        {/* Central Card Assembly */}
        <div className="w-full max-w-md mx-auto my-auto space-y-8">
          <div className="space-y-2">
            <h2 className="font-headline text-2xl md:text-3xl font-bold tracking-tight text-on-surface">
              Register your school
            </h2>
            <p className="font-body text-xs md:text-sm text-on-surface-variant leading-relaxed">
              Get started with West Africa&apos;s leading school operating system. 
              Your organizational email will serve as the master admin login.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-error/20 bg-error-container/20 px-4 py-3 text-xs text-error text-center font-medium"
            >
              {error.message}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Input 1: School Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold font-label text-on-surface-variant" htmlFor="schoolName">
                School name
              </label>
              <input
                id="schoolName"
                type="text"
                required
                minLength={3}
                maxLength={100}
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Knowledge Oasis Academy"
                className="w-full px-4 py-3 bg-white border border-border rounded-lg focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all font-body text-sm text-on-surface placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Input 2: Short Code */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <label className="text-xs font-semibold font-label text-on-surface-variant" htmlFor="shortCode">
                  School short code
                </label>
                <span className="text-[10px] text-muted-foreground font-normal lowercase">
                  optional
                </span>
              </div>
              <input
                id="shortCode"
                type="text"
                minLength={2}
                maxLength={10}
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value.toUpperCase())}
                placeholder="KOA"
                className="w-full px-4 py-3 bg-white border border-border rounded-lg focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all font-label uppercase tracking-widest text-sm text-on-surface placeholder:text-muted-foreground/40"
              />
              <p className="text-[11px] text-muted-foreground font-body leading-normal pt-0.5">
                Generates systematic IDs (e.g., <span className="font-mono font-medium text-on-surface">KOA/2026/0001</span>).
              </p>
            </div>

            {/* Input 3: Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold font-label text-on-surface-variant" htmlFor="schoolEmail">
                School email address
              </label>
              <input
                id="schoolEmail"
                type="email"
                required
                autoComplete="email"
                value={schoolEmail}
                onChange={(e) => setSchoolEmail(e.target.value)}
                placeholder="admin@yourschool.edu.ng"
                className="w-full px-4 py-3 bg-white border border-border rounded-lg focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all font-body text-sm text-on-surface placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Input 4: Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold font-label text-on-surface-variant" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-4 py-3 bg-white border border-border rounded-lg focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all font-body text-sm text-on-surface placeholder:text-muted-foreground/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                id="terms"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-primary border-border rounded focus:ring-primary/20 cursor-pointer transition-all"
              />
              <label htmlFor="terms" className="text-xs text-on-surface-variant leading-normal select-none">
                I agree to the{" "}
                <a href="#" className="text-primary font-medium hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-primary font-medium hover:underline">
                  Privacy Policy
                </a>
                .
              </label>
            </div>

            {/* Action Group Block */}
            <div className="space-y-4 pt-3">
              {/* FIXED BUTTON OVERRIDES: Spreading block expansion cleanly through a block layout div wrapper */}
              <div className="w-full [&>button]:w-full [&>button]:justify-center">
                <Button
                  type="submit"
                  disabled={isLoading || !agreedToTerms}
                  variant="primary"
                  size="md"
                >
                  {isLoading ? "Creating account…" : "Register school"}
                </Button>
              </div>

              {/* Conversion Redirect Link */}
              <p className="text-xs font-label text-on-surface-variant text-center">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-bold hover:underline transition-all ml-0.5">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Footnote Block */}
        <footer className="w-full mt-7 text-center text-[11px] text-muted-foreground pt-8 ">
          © {new Date().getFullYear()} ṣilẹti Technologies. Built for the future of African education.
        </footer>
      </section>
    </main>
  );
}