"use client";

import { useAuthStore } from "@/src/features/auth/store/useAuthStore";
import { Button } from "@/src/components/shared/Button";

export function FinalCTA() {
  const user = useAuthStore((s) => s.user);

 
  return (
    <section className="py-24 bg-primary text-on-primary text-center px-4">
      <div className="max-w-2xl mx-auto">
        <h2 className="font-headline text-4xl font-bold mb-6">
          Ready to transform your institution?
        </h2>
        <p className="text-lg mb-10 opacity-90 italic">
          Join schools already digitizing for the future of African
          education.
        </p>
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <Button href="/signup" variant="white" size="lg">
            Get started for free
          </Button>
          <Button href="#contact" variant="secondary" size="lg" className="!bg-primary-container !text-white border border-white/20">
            Talk to our experts
          </Button>
        </div>
      </div>
    </section>
  );
}
