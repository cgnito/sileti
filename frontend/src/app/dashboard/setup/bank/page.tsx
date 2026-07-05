"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ChevronLeft, Landmark, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { apiClient } from "@/src/shared/api-client";
import { fetchOnboardingStatus } from "@/src/features/auth/api/auth.api";
import { DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

type BankOption = {
  bank_name: string;
  bank_code: string;
};

type BankLookupResponse = {
  account_number: string;
  account_name: string;
  bank_code: string;
};

type BankSettlementResponse = {
  id: string;
  org_id: string;
  bank_name: string;
  bank_code?: string | null;
  account_number: string;
  account_name: string;
  nomba_subaccount_id: string | null;
};

export default function BankSetupPage() {
  const router = useRouter();
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBanks() {
      setIsLoadingBanks(true);
      setError(null);
      try {
        const [bankList, existingSettlement] = await Promise.all([
          apiClient.get<BankOption[]>("/orgs/banks"),
          apiClient.get<BankSettlementResponse | null>("/orgs/bank-settlement"),
        ]);
        if (active) {
          setBanks(bankList);
          if (existingSettlement) {
            setIsEditing(true);
            setSelectedBankCode(
              existingSettlement.bank_code
                ?? bankList.find((bank) => bank.bank_name === existingSettlement.bank_name)?.bank_code
                ?? "",
            );
            setAccountNumber(existingSettlement.account_number);
            setAccountName(existingSettlement.account_name);
          }
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "We could not load supported banks.");
      } finally {
        if (active) setIsLoadingBanks(false);
      }
    }

    void loadBanks();
    return () => {
      active = false;
    };
  }, []);

  const filteredBanks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const normalized = query ? banks.filter((bank) => bank.bank_name.toLowerCase().includes(query) || bank.bank_code.includes(query)) : banks;

    const seen = new Set<string>();
    return normalized.filter((bank) => {
      const signature = `${bank.bank_code}|${bank.bank_name}`;
      if (seen.has(signature)) {
        return false;
      }
      seen.add(signature);
      return true;
    });
  }, [banks, search]);

  useEffect(() => {
    if (!selectedBankCode || accountNumber.length !== 10) {
      setAccountName("");
      return;
    }

    let active = true;

    async function lookupAccount() {
      setIsLookingUp(true);
      setError(null);
      try {
        const payload = await apiClient.post<BankLookupResponse>("/orgs/bank-lookup", {
          bank_code: selectedBankCode,
          account_number: accountNumber,
        });
        if (active) {
          setAccountName(payload.account_name);
        }
      } catch (err) {
        if (active) {
          setAccountName("");
          setError(err instanceof Error ? err.message : "We could not verify the account name.");
        }
      } finally {
        if (active) setIsLookingUp(false);
      }
    }

    const timer = window.setTimeout(() => {
      void lookupAccount();
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [accountNumber, selectedBankCode]);

  async function handleSave() {
    const selectedBank = banks.find((bank) => bank.bank_code === selectedBankCode);
    if (!selectedBank || !accountName || accountNumber.length !== 10) {
      setError("Select a bank, enter a valid account number, and confirm the verified account name.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (isEditing) {
        await apiClient.patch<BankSettlementResponse>("/orgs/bank-settlement", {
          bank_name: selectedBank.bank_name,
          bank_code: selectedBank.bank_code,
          account_number: accountNumber,
          account_name: accountName,
        });
      } else {
        await apiClient.post<BankSettlementResponse>("/orgs/bank-settlement", {
          bank_name: selectedBank.bank_name,
          bank_code: selectedBank.bank_code,
          account_number: accountNumber,
          account_name: accountName,
        });
      }
      await fetchOnboardingStatus();
      setSuccess(isEditing ? "Bank settlement updated successfully." : "Bank settlement saved successfully.");
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not save your bank settlement details.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DashboardPageShell className="max-w-5xl">
      <DashboardHero
        eyebrow="Setup"
        title={isEditing ? "Update bank details" : "Add bank details"}
        description="Connect your payout details so your onboarding checklist can be completed."
        action={(
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">
            <ChevronLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        )}
      />

      <DashboardPanel className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <label className="space-y-2 text-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-2 font-medium text-on-surface">
              <Search className="h-4 w-4 text-primary" />
              Search bank
            </span>
            <input
              id="bank-search"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Start typing a bank name"
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {filteredBanks.length > 0 ? (
              <select
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={selectedBankCode}
                onChange={(event) => setSelectedBankCode(event.target.value)}
              >
                <option value="">Select a bank</option>
                {filteredBanks.map((bank) => (
                  <option key={`${bank.bank_code}-${bank.bank_name}`} value={bank.bank_code}>
                    {bank.bank_name} ({bank.bank_code})
                  </option>
                ))}
              </select>
            ) : null}
          </label>

          <label className="space-y-2 text-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-2 font-medium text-on-surface">
              <Landmark className="h-4 w-4 text-primary" />
              Account number
            </span>
            <input
              id="account-number"
              inputMode="numeric"
              maxLength={10}
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))}
              placeholder="0123456789"
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>

        <div className="rounded-[1.15rem] border border-border/70 bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
          <span className="inline-flex items-center gap-2 font-semibold text-on-surface">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Resolved account name
          </span>
          <p className="mt-1 min-h-6">
            {isLookingUp ? "Verifying account…" : accountName || "Enter a valid account number and choose a bank to verify the account name."}
          </p>
        </div>

        {error ? (
          <div className="rounded-[1.15rem] border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        ) : null}
        {success ? <p className="text-sm text-primary">{success}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={isSaving || !accountName}>
            {isSaving ? "Saving…" : isEditing ? "Update bank details" : "Save bank settlement"}
          </Button>
        </div>
      </DashboardPanel>
    </DashboardPageShell>
  );
}
