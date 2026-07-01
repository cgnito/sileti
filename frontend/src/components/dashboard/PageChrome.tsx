"use client";

import type { ReactNode } from "react";

type PageChromeProps = {
  children: ReactNode;
  className?: string;
};

type HeroProps = {
  eyebrow: string;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

type PanelProps = {
  children: ReactNode;
  className?: string;
};

type EmptyStateProps = {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

const pageShell = "mx-auto flex w-full max-w-7xl flex-col gap-6";
const heroShell =
  "relative overflow-hidden rounded-[1.5rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,250,244,0.96),rgba(249,244,236,0.92))] p-6 backdrop-blur-sm md:p-7";
const panelShell =
  "relative overflow-hidden rounded-[1.35rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,252,247,0.95),rgba(250,245,237,0.92))] p-5 backdrop-blur-sm md:p-6";

export function DashboardPageShell({ children, className = "" }: PageChromeProps) {
  return <div className={`${pageShell} ${className}`.trim()}>{children}</div>;
}

export function DashboardHero({ eyebrow, title, description, action, className = "" }: HeroProps) {
  return (
    <header className={`${heroShell} ${className}`.trim()}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <p className="font-label text-[11px] uppercase tracking-[0.35em] text-primary">{eyebrow}</p>
          <h1 className="mt-2 font-headline text-2xl font-bold tracking-tight text-on-surface md:text-3xl">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant md:text-[15px]">{description}</p>
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-3">{action}</div> : null}
      </div>
    </header>
  );
}

export function DashboardPanel({ children, className = "" }: PanelProps) {
  return (
    <section className={`${panelShell} ${className}`.trim()}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      {children}
    </section>
  );
}

export function DashboardEmptyState({ title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`rounded-[1.25rem] border border-dashed border-border/70 bg-surface-container-low p-8 text-center ${className}`.trim()}>
      <h2 className="font-headline text-lg text-on-surface">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
