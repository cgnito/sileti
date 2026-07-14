"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { Logo } from "@/src/components/shared/Logo";
import { fetchOnboardingStatus } from "@/src/features/auth/api/auth.api";
import { useAuthStore } from "@/src/features/auth/store/useAuthStore";
import { useVerifyEmail, useResendVerification } from "../../features/auth/hooks/auth.hooks";

const RESEND_COOLDOWN_SECONDS = 59;

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token");
  const emailFromQuery = searchParams.get("email") ?? "";

  const { verifyEmail, isLoading: isVerifying, error: verifyError } = useVerifyEmail();
  const { resend, isLoading: isResending, error: resendError, sent } = useResendVerification();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [verifyState, setVerifyState] = useState<"idle" | "success" | "failed">("idle");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);

  // Mode 1: arrived with a ?token= from the email link — verify immediately.
  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then(() => setVerifyState("success"))
      .catch(() => setVerifyState("failed"));
  }, [token, verifyEmail]);

  // Mode 2: arrived right after signup, no token yet — just the resend countdown.
  useEffect(() => {
    if (token) return;
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, [token, secondsLeft]);

  async function handleResend() {
    if (!emailFromQuery) return;
    try {
      await resend(emailFromQuery);
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch {
      // Error captured by hook
    }
  }

  async function handleContinue() {
    if (user && accessToken) {
      try {
        const progress = await fetchOnboardingStatus();
        router.replace(progress.is_completed ? "/dashboard" : "/dashboard/setup");
        return;
      } catch {
        router.replace("/dashboard");
        return;
      }
    }

    router.push("/login");
  }

  // ── Mode 1 render states: token present ────────────────────────
  if (token) {
    if (isVerifying || verifyState === "idle") {
      return (
        <StatusCard
          icon={<Mail className="w-12 h-12 text-primary animate-pulse" />}
          title="Verifying your email"
          body="This will only take a moment."
        />
      );
    }

    if (verifyState === "success") {
      return (
        <StatusCard
          icon={<CheckCircle2 className="w-12 h-12 text-primary" />}
          title="Email verified"
          body="Your school account is active and ready to use."
          action={
            <Button onClick={handleContinue} className="w-full !py-4">
              {user && accessToken ? "Continue to dashboard" : "Sign in to your account"}
            </Button>
          }
        />
      );
    }

    return (
      <StatusCard
        icon={<XCircle className="w-12 h-12 text-error" />}
        title="Verification failed"
        body={verifyError?.message ?? "This link is invalid or has expired."}
        action={
          <div className="w-full space-y-3">
            {emailFromQuery && (
              <Button
                onClick={handleResend}
                disabled={isResending}
                className="w-full !py-4 disabled:opacity-60"
              >
                {isResending ? "Sending fresh link…" : "Request new link"}
              </Button>
            )}
            <Button href="/signup" variant="ghost" className="w-full !py-4">
              Return to sign up
            </Button>
          </div>
        }
      />
    );
  }

  // ── Mode 2: just signed up, waiting for the email ──────────────
  return (
    <StatusCard
      icon={<Mail className="w-12 h-12 text-primary" />}
      lockBadge
      title="Verify your email"
      body={
        <>
          We sent an activation link to{" "}
          {emailFromQuery ? (
            <span className="font-semibold text-on-surface bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 text-xs break-all inline-block align-middle my-0.5">
              {emailFromQuery}
            </span>
          ) : (
            "your registered email address"
          )}
          . Click the link to secure your account.
        </>
      }
      action={
        <div className="space-y-4 w-full">
          {resendError && (
            <div
              role="alert"
              className="rounded-lg border border-error/20 bg-error-container/20 px-4 py-3 text-xs text-error text-center"
            >
              {resendError.message}
            </div>
          )}

          {sent && secondsLeft === RESEND_COOLDOWN_SECONDS && (
            <p className="text-xs font-medium text-primary text-center">A fresh link is on its way.</p>
          )}

          <div className="flex flex-col items-center justify-center min-h-[44px]">
            {secondsLeft > 0 ? (
              <p className="font-label text-xs text-muted-foreground">
                Resend link available in <span className="text-on-surface font-semibold">{secondsLeft}s</span>
              </p>
            ) : (
              <Button 
                onClick={handleResend} 
                variant="ghost" 
                disabled={isResending || !emailFromQuery}
                className="text-xs font-semibold text-primary"
              >
                {isResending ? "Sending…" : "Resend verification email"}
              </Button>
            )}
          </div>

          <div className="pt-4 border-t border-border/40">
            <Link
              href="/signup"
              className="text-xs text-muted-foreground hover:text-primary transition-colors block text-center"
            >
              Wrong email address? Change it here
            </Link>
          </div>
        </div>
      }
    />
  );
}

function StatusCard({
  icon,
  lockBadge = false,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  lockBadge?: boolean;
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen flex flex-col justify-between bg-background px-6 py-8 md:p-12">
      {/* Top Section: Persistent Brand Placement */}
      <div className="w-full flex justify-center mb-6 md:mb-0">
        <Logo className="justify-center inline-flex" />
      </div>

      {/* Center Section: Compact Content Container */}
      <div className="w-full max-w-md mx-auto my-auto flex flex-col items-center">
        <div className="w-full bg-card border border-border/80 rounded-2xl p-6 md:p-10 shadow-sm flex flex-col items-center">
          
          {/* Icon Stage */}
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center">
              {icon}
            </div>
            {lockBadge && (
              <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 bg-primary rounded-full border-4 border-card flex items-center justify-center shadow-sm">
                <Lock className="w-3.5 h-3.5 text-on-primary" fill="currentColor" />
              </div>
            )}
          </div>

          {/* Typography Hierarchy */}
          <h1 className="font-headline text-xl md:text-2xl font-bold tracking-tight text-on-surface text-center mb-2">
            {title}
          </h1>
          <p className="font-body text-xs md:text-sm text-on-surface-variant text-center mb-8 leading-relaxed max-w-xs">
            {body}
          </p>

          {/* Clean Action Injection Slot */}
          {action && <div className="w-full">{action}</div>}
        </div>
      </div>

      {/* Bottom Section: Clean, Lower-Priority Anchor Links */}
      <div className="w-full text-center mt-6 md:mt-0">
        <p className="font-label text-xs text-muted-foreground">
          Need assistance?{" "}
          <a
            href="#"
            className="text-on-surface-variant font-medium underline underline-offset-4 decoration-border/60 hover:decoration-primary transition-all"
          >
            Contact support
          </a>
        </p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}