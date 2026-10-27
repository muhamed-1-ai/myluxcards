"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface Workspace {
  id: string;
  name: string;
  type: "BUSINESS" | "PERSONAL";
  currency: string;
  timezone: string;
  profile_template: string;
  role?: "OWNER" | "MANAGER" | "STAFF" | "VIEWER";
}

export interface FinancialAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
  opening_balance_minor?: number | string;
  current_balance_minor: number;
  is_active: boolean;
  description?: string | null;
}

export interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  parent_id: string | null;
  parent_name?: string | null;
  parent_is_archived?: boolean | null;
  color?: string;
  icon?: string;
  is_archived: boolean;
  sort_order?: number;
}

interface AccountingContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (ws: Workspace) => void;
  accounts: FinancialAccount[];
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  loading: boolean;
  refreshKey: number;
  triggerRefresh: () => void;
  formatMoney: (amountMinor: number, currency?: string) => string;
  // Modal states
  fastModalOpen: boolean;
  fastModalType: "INCOME" | "EXPENSE" | "TRANSFER" | null;
  openFastModal: (type: "INCOME" | "EXPENSE" | "TRANSFER") => void;
  closeFastModal: () => void;
  // Permissions
  userRole: "OWNER" | "MANAGER" | "STAFF" | "VIEWER";
  canMutate: boolean;
  canExport: boolean;
  isOwnerOrManager: boolean;
}

export const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

export function AccountingProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Fast Transaction Modal
  const [fastModalOpen, setFastModalOpen] = useState(false);
  const [fastModalType, setFastModalType] = useState<"INCOME" | "EXPENSE" | "TRANSFER" | null>(null);

  const openFastModal = (type: "INCOME" | "EXPENSE" | "TRANSFER") => {
    setFastModalType(type);
    setFastModalOpen(true);
  };

  const closeFastModal = () => {
    setFastModalOpen(false);
    setFastModalType(null);
  };

  const triggerRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Fetch workspaces on mount
  useEffect(() => {
    let isMounted = true;
    async function loadWorkspaces() {
      try {
        setLoading(true);
        const res = await fetch("/api/accounting/workspaces");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.workspaces && data.workspaces.length > 0) {
            setWorkspaces(data.workspaces);
            // Default to first business or first personal workspace
            setActiveWorkspace((prev) => prev || data.workspaces[0]);
          }
        }
      } catch (err) {
        console.error("Error loading accounting workspaces:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadWorkspaces();
    return () => { isMounted = false; };
  }, []);

  // Fetch accounts and categories when active workspace changes or refreshKey bumps
  useEffect(() => {
    if (!activeWorkspace) return;
    const wsId = activeWorkspace.id;
    let isMounted = true;

    async function loadWorkspaceData() {
      try {
        const [accRes, catRes] = await Promise.all([
          fetch(`/api/accounting/accounts?workspaceId=${wsId}`, {
            headers: { "x-workspace-id": wsId },
          }),
          fetch(`/api/accounting/categories?workspaceId=${wsId}&includeArchived=true`, {
            headers: { "x-workspace-id": wsId },
          }),
        ]);

        if (accRes.ok && isMounted) {
          const accData = await accRes.json();
          setAccounts(accData.accounts || []);
        }
        if (catRes.ok && isMounted) {
          const catData = await catRes.json();
          setCategories(catData.categories || []);
        }
      } catch (err) {
        console.error("Error loading workspace accounts and categories:", err);
      }
    }

    loadWorkspaceData();
    return () => { isMounted = false; };
  }, [activeWorkspace, refreshKey]);

  // Precise currency formatting in INR / standard decimal arithmetic
  const formatMoney = useCallback((amountMinor: number, currency: string = "INR") => {
    const major = (amountMinor || 0) / 100;
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currency || "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(major);
    } catch {
      return `₹${major.toFixed(2)}`;
    }
  }, []);

  const userRole = activeWorkspace?.role || "OWNER";
  const canMutate = userRole !== "VIEWER";
  const canExport = userRole !== "VIEWER";
  const isOwnerOrManager = userRole === "OWNER" || userRole === "MANAGER";

  return (
    <AccountingContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        setActiveWorkspace,
        accounts,
        categories,
        setCategories,
        loading,
        refreshKey,
        triggerRefresh,
        formatMoney,
        fastModalOpen,
        fastModalType,
        openFastModal,
        closeFastModal,
        userRole,
        canMutate,
        canExport,
        isOwnerOrManager,
      }}
    >
      {children}
    </AccountingContext.Provider>
  );
}

export function useAccounting() {
  const context = useContext(AccountingContext);
  if (!context) {
    throw new Error("useAccounting must be used within an AccountingProvider");
  }
  return context;
}

export function useOptionalAccounting() {
  return useContext(AccountingContext);
}
