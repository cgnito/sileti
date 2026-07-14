"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { Logo } from "@/src/components/shared/Logo";
import { fetchOnboardingStatus } from "@/src/features/auth/api/auth.api";
import { useLogin } from "../../features/auth/hooks/auth.hooks";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading: isLoggingIn, error } = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const user = await login(email, password);

      if (user.role === "admin") {
        const progress = await fetchOnboardingStatus();
        router.replace(progress.is_completed ? "/dashboard" : "/dashboard/setup");
        return;
      }

      router.replace("/dashboard");
    } catch {
      // Error is handled in the hook
    }
  }

  return (
    <main className="flex flex-col lg:flex-row min-h-screen bg-surface">
      {/* Left Panel: Clean, Intentional Product Spotlight Frame */}
      <section className="hidden lg:flex lg:w-[40%] bg-surface-container-low border-r border-border relative overflow-hidden flex-col justify-between p-12 min-h-screen">
        {/* Top Brand & Hero Block */}
        <div className="z-10 space-y-12">
          <Logo />
          <div className="space-y-4 mt-6">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface leading-tight max-w-sm">
              Run your school on autopilot.
            </h1>
            <p className="text-on-surface-variant font-body text-sm max-w-xs leading-relaxed opacity-90">
              The modern operating system built for West African academic excellence and financial clarity.
            </p>
          </div>
        </div>

        {/* Apple-Style Showcase Window Frame - Isolated with dynamic margins to breathe */}
        <div className="flex-1 flex items-center my-14">
          <div className="relative w-[115%] aspect-[4/3] rounded-l-xl border border-border bg-white shadow-2xl overflow-hidden translate-x-12 transform scale-105 border-r-0 transition-all duration-300">
            <div className="h-6 w-full bg-surface-container-low border-b border-border/60 flex items-center px-3 gap-1.5">
              <div className="w-2 h-2 rounded-full bg-border/80" />
              <div className="w-2 h-2 rounded-full bg-border/80" />
              <div className="w-2 h-2 rounded-full bg-border/80" />
            </div>
            <img
              src="/images/dashboard-preview.png"
              alt="ṣilẹti School Operating Dashboard Preview"
              className="w-full h-[calc(100%-24px)] object-cover object-left-top select-none opacity-95"
              draggable={false}
            />
          </div>
        </div>

        {/* Footer Branding Anchor */}
        <div className="z-10 pt-4">
          <p className="text-[10px] font-label text-muted-foreground uppercase tracking-widest font-semibold">
            Built for African schools
          </p>
        </div>

        {/* Ambient Background Elements */}
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary-container/5 rounded-full blur-3xl pointer-events-none" />
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
              Sign in
            </h2>
            <p className="font-body text-xs md:text-sm text-on-surface-variant leading-relaxed">
              Welcome back. Enter your organizational or personal staff details to continue.
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
            {/* Input 1: Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold font-label text-on-surface-variant" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@yourschool.edu.ng"
                className="w-full px-4 py-3 bg-white border border-border rounded-lg focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all font-body text-sm text-on-surface placeholder:text-muted-foreground/40"
              />
              <p className="text-[11px] text-muted-foreground font-body leading-normal pt-0.5">
                Use your school&apos;s master admin profile, or your personal invitation workspace link.
              </p>
            </div>

            {/* Input 2: Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <label className="text-xs font-semibold font-label text-on-surface-variant" htmlFor="password">
                  Password
                </label>
                <a href="#" className="text-[11px] text-primary font-medium hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            {/* Action Group Block */}
            <div className="space-y-4 pt-3">
              <div className="w-full [&>button]:w-full [&>button]:justify-center">
                <Button
                  type="submit"
                  disabled={isLoggingIn}
                  variant="primary"
                  size="md"
                >
                  {isLoggingIn ? "Signing in…" : "Sign in"}
                </Button>
              </div>

              {/* Repositioned Sub-Action Link */}
              <p className="text-xs font-label text-on-surface-variant text-center">
                New school?{" "}
                <Link href="/signup" className="text-primary font-bold hover:underline transition-all ml-0.5">
                  Create an account
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Footnote Block */}
        <footer className="w-full text-center text-[11px] text-muted-foreground pt-8 lg:absolute lg:bottom-0 lg:left-0 lg:p-12">
          © {new Date().getFullYear()} ṣilẹti Technologies. Built for the future of African education.
        </footer>
      </section>
    </main>
  );
}