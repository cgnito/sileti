"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { apiClient } from "@/src/shared/api-client";
import { fetchOnboardingStatus } from "@/src/features/auth/api/auth.api";

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
            setSelectedBankCode(bankList.find((bank) => bank.bank_name === existingSettlement.bank_name)?.bank_code ?? "");
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
    if (!query) return banks;
    return banks.filter((bank) => bank.bank_name.toLowerCase().includes(query) || bank.bank_code.includes(query));
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
          account_number: accountNumber,
          account_name: accountName,
        });
      } else {
        await apiClient.post<BankSettlementResponse>("/orgs/bank-settlement", {
          bank_name: selectedBank.bank_name,
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
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-on-surface-variant transition-colors hover:text-primary">
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="mt-3 font-headline text-xl font-bold tracking-tight text-on-surface">{isEditing ? "Update bank details" : "Add bank details"}</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Connect your payout details so your onboarding checklist can be completed.</p>
      </header>

      <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor="bank-search">
              Search bank
            </label>
            <input
              id="bank-search"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Start typing a bank name"
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {search && filteredBanks.length > 0 && (
              <select
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={selectedBankCode}
                onChange={(event) => setSelectedBankCode(event.target.value)}
              >
                <option value="">Select a bank</option>
                {filteredBanks.map((bank) => (
                  <option key={bank.bank_code} value={bank.bank_code}>
                    {bank.bank_name} ({bank.bank_code})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor="account-number">
              Account number
            </label>
            <input
              id="account-number"
              inputMode="numeric"
              maxLength={10}
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))}
              placeholder="0123456789"
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="rounded-xl border border-border/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">Resolved account name</span>
            <p className="mt-1 min-h-6">
              {isLookingUp ? "Verifying account…" : accountName || "Enter a valid account number and choose a bank to verify the account name."}
            </p>
          </div>

          {error && <p className="text-xs text-error">{error}</p>}
          {success && <p className="text-xs text-primary">{success}</p>}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={isSaving || !accountName}>
              {isSaving ? "Saving…" : isEditing ? "Update bank details" : "Save bank settlement"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
