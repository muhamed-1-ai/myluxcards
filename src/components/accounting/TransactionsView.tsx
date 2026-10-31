"use client";

import React, { useState, useEffect } from "react";
import { useAccounting, type FinancialAccount } from "./AccountingContext";
import type { AccountHistoryItem } from "@/lib/accounting/types";
import { resolveTransactionCategory } from "@/lib/accounting/categoryResolver";
import FormattedMoneyInput from "../ui/FormattedMoneyInput";
import { Paperclip } from "lucide-react";
import TransactionAttachmentsDropzone from "./TransactionAttachmentsDropzone";
import TransactionAttachmentViewerModal from "./TransactionAttachmentViewerModal";
import CreatePurchaseModal from "./CreatePurchaseModal";
import PurchaseDetailModal from "./PurchaseDetailModal";
import type { TransactionAttachmentRow, PurchaseRow } from "@/lib/accounting/types";
import { ShoppingBag, Search, Plus, Filter, CreditCard, ChevronRight } from "lucide-react";

interface TransactionItem {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount_minor: number;
  date: string;
  notes?: string;
  contact_name?: string;
  category_id?: string | null;
  category_name?: string;
  parent_category_name?: string;
  main_category_name?: string;
  subcategory_name?: string;
  account_name?: string;
  status: string;
  journal_entry_id?: string;
  voided_at?: string | null;
  voided_by?: string | null;
  voided_by_name?: string | null;
  restored_at?: string | null;
  restored_by?: string | null;
  restored_by_name?: string | null;
  attachment_count?: number;
  attachments?: TransactionAttachmentRow[];
  purchase_id?: string | null;
  purchase_number?: string | null;
}

interface TransactionsViewProps {
  initialSubtab?: "TRANSACTIONS" | "PURCHASES" | "BALANCES" | "VOIDED";
}

function formatVoidDate(dateVal?: Date | string | null): string {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal).slice(0, 10);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return String(dateVal).slice(0, 10);
  }
}

export default function TransactionsView({ initialSubtab = "TRANSACTIONS" }: TransactionsViewProps) {
  const {
    activeWorkspace,
    accounts,
    categories,
    formatMoney,
    openFastModal,
    refreshKey,
    triggerRefresh,
    canMutate,
  } = useAccounting();

  const [subtab, setSubtab] = useState<"TRANSACTIONS" | "PURCHASES" | "BALANCES" | "VOIDED">(initialSubtab);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [activeTotal, setActiveTotal] = useState(0);
  const [voidedTransactions, setVoidedTransactions] = useState<TransactionItem[]>([]);
  const [voidedTotal, setVoidedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingVoided, setLoadingVoided] = useState(true);

  // Purchases State
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [purchasesTotal, setPurchasesTotal] = useState(0);
  const [loadingPurchases, setLoadingPurchases] = useState(true);

  // Filters for Purchases
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<string>("ALL");
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState("");
  const [purchaseStartDate, setPurchaseStartDate] = useState("");
  const [purchaseEndDate, setPurchaseEndDate] = useState("");

  // Purchases Modals State
  const [createPurchaseOpen, setCreatePurchaseOpen] = useState(false);
  const [editingDraftData, setEditingDraftData] = useState<any | null>(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [purchaseDetailOpen, setPurchaseDetailOpen] = useState(false);

  // Filters for All Transactions
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Filters for Voided
  const [voidedCategoryId, setVoidedCategoryId] = useState("");
  const [voidedSearchTerm, setVoidedSearchTerm] = useState("");

  // Toast / Feedback message banner
  const [feedbackToast, setFeedbackToast] = useState<{ type: "success" | "danger"; message: string } | null>(null);

  // Edit Transaction state
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [editMainCatId, setEditMainCatId] = useState("");
  const [editSubCatId, setEditSubCatId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editAttachments, setEditAttachments] = useState<TransactionAttachmentRow[]>([]);
  const [editAttachmentIds, setEditAttachmentIds] = useState<string[]>([]);
  const [editAttachmentsBusy, setEditAttachmentsBusy] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Attachment Viewer Modal State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerAttachments, setViewerAttachments] = useState<TransactionAttachmentRow[]>([]);
  const [viewerTx, setViewerTx] = useState<TransactionItem | null>(null);

  // Void modal state
  const [voidingTx, setVoidingTx] = useState<TransactionItem | null>(null);
  const [submittingVoid, setSubmittingVoid] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Restore modal state
  const [restoringTx, setRestoringTx] = useState<TransactionItem | null>(null);
  const [submittingRestore, setSubmittingRestore] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Opening Balance Modal State
  const [openingModalOpen, setOpeningModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [openingBalanceStr, setOpeningBalanceStr] = useState("");
  const [submittingOpening, setSubmittingOpening] = useState(false);

  // Account History Drawer/Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedHistoryAccount, setSelectedHistoryAccount] = useState<FinancialAccount | null>(null);
  const [historyItems, setHistoryItems] = useState<AccountHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Correction Modal State
  const [correctingEntry, setCorrectingEntry] = useState<AccountHistoryItem | null>(null);
  const [correctAmountStr, setCorrectAmountStr] = useState("");
  const [correctTargetAccountId, setCorrectTargetAccountId] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  // Reversal Modal State
  const [reversingEntry, setReversingEntry] = useState<AccountHistoryItem | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [submittingReversal, setSubmittingReversal] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);

  useEffect(() => {
    setSubtab(initialSubtab);
  }, [initialSubtab]);

  // Auto-dismiss feedback toast
  useEffect(() => {
    if (!feedbackToast) return;
    const timer = setTimeout(() => setFeedbackToast(null), 4000);
    return () => clearTimeout(timer);
  }, [feedbackToast]);

  // Accessible Escape key listener for open dialogs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (createPurchaseOpen && !loadingPurchases) setCreatePurchaseOpen(false);
        else if (purchaseDetailOpen) setPurchaseDetailOpen(false);
        else if (voidingTx && !submittingVoid) setVoidingTx(null);
        else if (restoringTx && !submittingRestore) setRestoringTx(null);
        else if (editingTx && !submittingEdit) setEditingTx(null);
        else if (openingModalOpen && !submittingOpening) setOpeningModalOpen(false);
        else if (correctingEntry && !submittingCorrection) setCorrectingEntry(null);
        else if (reversingEntry && !submittingReversal) setReversingEntry(null);
        else if (historyModalOpen) setHistoryModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    createPurchaseOpen,
    purchaseDetailOpen,
    loadingPurchases,
    voidingTx,
    submittingVoid,
    restoringTx,
    submittingRestore,
    editingTx,
    submittingEdit,
    openingModalOpen,
    submittingOpening,
    historyModalOpen,
    correctingEntry,
    submittingCorrection,
    reversingEntry,
    submittingReversal,
  ]);

  // Load active transactions and voided expenses from server
  useEffect(() => {
    if (!activeWorkspace) return;
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setLoadingVoided(true);

        const [activeRes, voidedRes] = await Promise.all([
          fetch(`/api/accounting/transactions?workspaceId=${activeWorkspace?.id}&status=POSTED`),
          fetch(`/api/accounting/transactions?workspaceId=${activeWorkspace?.id}&status=VOIDED&type=EXPENSE`),
        ]);

        if (activeRes.ok) {
          const data = await activeRes.json();
          if (isMounted) {
            setTransactions(data.transactions || []);
            setActiveTotal(data.total ?? (data.transactions || []).length);
          }
        }

        if (voidedRes.ok) {
          const data = await voidedRes.json();
          if (isMounted) {
            setVoidedTransactions(data.transactions || []);
            setVoidedTotal(data.total ?? (data.transactions || []).length);
          }
        }
      } catch (err) {
        console.error("Failed to load transactions:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
          setLoadingVoided(false);
        }
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [activeWorkspace, refreshKey]);

  // Load purchases from server
  useEffect(() => {
    if (!activeWorkspace) return;
    let isMounted = true;

    async function loadPurchases() {
      try {
        setLoadingPurchases(true);
        const params = new URLSearchParams({ workspaceId: activeWorkspace!.id });
        if (purchaseStatusFilter && purchaseStatusFilter !== "ALL") {
          params.set("status", purchaseStatusFilter);
        }
        if (purchaseSearchTerm.trim()) {
          params.set("search", purchaseSearchTerm.trim());
        }
        if (purchaseStartDate) {
          params.set("startDate", purchaseStartDate);
        }
        if (purchaseEndDate) {
          params.set("endDate", purchaseEndDate);
        }

        const res = await fetch(`/api/accounting/purchases?${params.toString()}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setPurchases(data.purchases || []);
          setPurchasesTotal(data.total ?? (data.purchases || []).length);
        }
      } catch (err) {
        console.error("Failed to load purchases:", err);
      } finally {
        if (isMounted) setLoadingPurchases(false);
      }
    }

    loadPurchases();
    return () => {
      isMounted = false;
    };
  }, [activeWorkspace, refreshKey, purchaseStatusFilter, purchaseSearchTerm, purchaseStartDate, purchaseEndDate]);

  useEffect(() => {
    if (initialSubtab) {
      setSubtab(initialSubtab);
    }
  }, [initialSubtab]);

  // Handle editing a draft purchase
  const handleEditDraft = async (purchase: PurchaseRow) => {
    try {
      const res = await fetch(`/api/accounting/purchases/${purchase.id}?workspaceId=${activeWorkspace?.id}`);
      if (res.ok) {
        const data = await res.json();
        setEditingDraftData(data.purchase);
      } else {
        setEditingDraftData(purchase);
      }
    } catch {
      setEditingDraftData(purchase);
    }
    setCreatePurchaseOpen(true);
  };


  // Void confirmation submit
  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidingTx || submittingVoid) return;

    setSubmittingVoid(true);
    setVoidError(null);
    try {
      const res = await fetch(`/api/accounting/transactions/${voidingTx.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Voided by user" }),
      });
      if (res.ok) {
        const data = await res.json();
        // Remove from active transactions list and decrement total
        setTransactions((prev) => prev.filter((t) => t.id !== voidingTx.id));
        setActiveTotal((prev) => Math.max(0, prev - 1));

        // Add to voided transactions list and increment total
        if (data.transaction) {
          setVoidedTransactions((prev) => [data.transaction, ...prev]);
          setVoidedTotal((prev) => prev + 1);
        }

        setVoidingTx(null);
        setFeedbackToast({ type: "success", message: "Expense moved to Voided." });
        triggerRefresh();
      } else {
        const data = await res.json();
        setVoidError(data.error || "Failed to void expense.");
      }
    } catch {
      setVoidError("Network error voiding expense.");
    } finally {
      setSubmittingVoid(false);
    }
  };

  // Restore confirmation submit
  const handleConfirmRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoringTx || submittingRestore) return;

    setSubmittingRestore(true);
    setRestoreError(null);
    try {
      const res = await fetch(`/api/accounting/transactions/${restoringTx.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Restored by user" }),
      });
      if (res.ok) {
        const data = await res.json();
        // Remove from voided list and decrement voided total
        setVoidedTransactions((prev) => prev.filter((t) => t.id !== restoringTx.id));
        setVoidedTotal((prev) => Math.max(0, prev - 1));

        // Add to active transactions list and increment total
        if (data.transaction) {
          setTransactions((prev) => [data.transaction, ...prev]);
          setActiveTotal((prev) => prev + 1);
        }

        setRestoringTx(null);
        setFeedbackToast({ type: "success", message: "Expense restored." });
        triggerRefresh();
      } else {
        const data = await res.json();
        setRestoreError(data.error || "Failed to restore expense.");
      }
    } catch {
      setRestoreError("Network error restoring expense.");
    } finally {
      setSubmittingRestore(false);
    }
  };

  const handleSetOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(openingBalanceStr);
    if (!activeWorkspace || !selectedAccountId || isNaN(amt)) {
      alert("Please choose an account and specify a valid opening balance.");
      return;
    }

    setSubmittingOpening(true);
    try {
      const res = await fetch("/api/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          accountId: selectedAccountId,
          openingBalanceMinor: Math.round(amt * 100),
        }),
      });

      if (res.ok) {
        setOpeningModalOpen(false);
        setSelectedAccountId("");
        setOpeningBalanceStr("");
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to set opening balance");
      }
    } finally {
      setSubmittingOpening(false);
    }
  };

  const loadAccountHistory = async (accountId: string) => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/accounting/accounts/${accountId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data.history || []);
      } else {
        const err = await res.json();
        setHistoryError(err.error || "Failed to load account history");
      }
    } catch {
      setHistoryError("Network error loading account history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenHistory = (acc: FinancialAccount) => {
    setSelectedHistoryAccount(acc);
    setHistoryModalOpen(true);
    loadAccountHistory(acc.id);
  };

  const handleStartCorrection = (entry: AccountHistoryItem) => {
    setCorrectingEntry(entry);
    setCorrectAmountStr((entry.amountMinor / 100).toString());
    setCorrectTargetAccountId(selectedHistoryAccount?.id || "");
    setCorrectionReason("");
    setCorrectionError(null);
  };

  const handleConfirmCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingEntry || !selectedHistoryAccount) return;
    const amt = parseFloat(correctAmountStr);
    if (isNaN(amt) || amt <= 0) {
      setCorrectionError("Please enter a valid positive amount.");
      return;
    }
    if (!correctTargetAccountId) {
      setCorrectionError("Please choose a destination account.");
      return;
    }
    if (!correctionReason.trim()) {
      setCorrectionError("Please provide a reason for the correction.");
      return;
    }

    setSubmittingCorrection(true);
    setCorrectionError(null);
    try {
      const res = await fetch("/api/accounting/accounts/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: correctingEntry.id,
          correctAmountMinor: Math.round(amt * 100),
          correctAccountId: correctTargetAccountId,
          reason: correctionReason.trim(),
        }),
      });

      if (res.ok) {
        setCorrectingEntry(null);
        setFeedbackToast({
          type: "success",
          message: "Funding entry corrected successfully. Reversal and replacement postings recorded.",
        });
        loadAccountHistory(selectedHistoryAccount.id);
        triggerRefresh();
      } else {
        const err = await res.json();
        setCorrectionError(err.error || "Failed to correct entry");
      }
    } catch {
      setCorrectionError("Network error while submitting correction.");
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const handleStartReversal = (entry: AccountHistoryItem) => {
    setReversingEntry(entry);
    setReversalReason("");
    setReversalError(null);
  };

  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingEntry || !selectedHistoryAccount) return;

    setSubmittingReversal(true);
    setReversalError(null);
    try {
      const res = await fetch("/api/accounting/accounts/reversal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: reversingEntry.id,
          reason: reversalReason.trim() || "User requested entry reversal",
        }),
      });

      if (res.ok) {
        setReversingEntry(null);
        setFeedbackToast({
          type: "success",
          message: "Entry reversed successfully. Account balance effect has been undone.",
        });
        loadAccountHistory(selectedHistoryAccount.id);
        triggerRefresh();
      } else {
        const err = await res.json();
        setReversalError(err.error || "Failed to reverse entry");
      }
    } catch {
      setReversalError("Network error while submitting reversal.");
    } finally {
      setSubmittingReversal(false);
    }
  };

  const openAttachmentViewer = async (tx: TransactionItem) => {
    setViewerTx(tx);
    setViewerOpen(true);
    try {
      const res = await fetch(`/api/accounting/transactions/${tx.id}/attachments`);
      if (res.ok) {
        const data = await res.json();
        setViewerAttachments(data.attachments || []);
      } else {
        setViewerAttachments([]);
      }
    } catch {
      setViewerAttachments([]);
    }
  };

  const openEditTx = (tx: TransactionItem) => {
    setEditingTx(tx);
    setEditError(null);
    setEditDate(tx.date || new Date().toISOString().split("T")[0]);
    setEditNotes(tx.notes || "");
    setEditAttachments([]);
    setEditAttachmentIds([]);
    setEditAttachmentsBusy(false);

    // Load saved attachments for editing
    fetch(`/api/accounting/transactions/${tx.id}/attachments`)
      .then((r) => r.json())
      .then((data) => {
        if (data.attachments) {
          setEditAttachments(data.attachments);
          setEditAttachmentIds(data.attachments.map((a: any) => a.id));
        }
      })
      .catch(() => {});

    const cat = categories.find((c) => c.id === tx.category_id);
    if (cat) {
      if (cat.parent_id) {
        setEditMainCatId(cat.parent_id);
        setEditSubCatId(cat.id);
      } else {
        setEditMainCatId(cat.id);
        setEditSubCatId("");
      }
    } else {
      setEditMainCatId("");
      setEditSubCatId("");
    }
  };

  const handleSaveEditTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    if (editAttachmentsBusy) {
      setEditError("Please wait for all file uploads to finish, or remove failed files.");
      return;
    }

    setSubmittingEdit(true);
    setEditError(null);
    try {
      const targetCatId = editSubCatId || editMainCatId || null;
      const res = await fetch(`/api/accounting/transactions/${editingTx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: targetCatId,
          mainCategoryId: editMainCatId || null,
          subcategoryId: editSubCatId || null,
          date: editDate,
          notes: editNotes,
          attachmentIds: editAttachmentIds,
        }),
      });

      if (res.ok) {
        setEditingTx(null);
        triggerRefresh();
      } else {
        const data = await res.json();
        setEditError(data.error || "Failed to update transaction.");
      }
    } catch {
      setEditError("Network error updating transaction.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Filtered active transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (filterType !== "ALL" && tx.type !== filterType) return false;
    if (filterCategoryId) {
      const matchingCatIds = new Set<string>([filterCategoryId]);
      categories.forEach((c) => {
        if (c.parent_id === filterCategoryId) {
          matchingCatIds.add(c.id);
        }
      });
      if (!tx.category_id || !matchingCatIds.has(tx.category_id)) return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchNotes = (tx.notes || "").toLowerCase().includes(q);
      const matchContact = (tx.contact_name || "").toLowerCase().includes(q);
      const matchCat = (tx.category_name || "").toLowerCase().includes(q);
      const matchParentCat = (tx.parent_category_name || "").toLowerCase().includes(q);
      const matchAcc = (tx.account_name || "").toLowerCase().includes(q);
      if (!matchNotes && !matchContact && !matchCat && !matchParentCat && !matchAcc) return false;
    }
    return true;
  });

  // Filtered voided expenses
  const filteredVoided = voidedTransactions.filter((tx) => {
    if (voidedCategoryId) {
      const matchingCatIds = new Set<string>([voidedCategoryId]);
      categories.forEach((c) => {
        if (c.parent_id === voidedCategoryId) {
          matchingCatIds.add(c.id);
        }
      });
      if (!tx.category_id || !matchingCatIds.has(tx.category_id)) return false;
    }
    if (voidedSearchTerm) {
      const q = voidedSearchTerm.toLowerCase();
      const matchNotes = (tx.notes || "").toLowerCase().includes(q);
      const matchContact = (tx.contact_name || "").toLowerCase().includes(q);
      const matchCat = (tx.category_name || "").toLowerCase().includes(q);
      const matchParentCat = (tx.parent_category_name || "").toLowerCase().includes(q);
      const matchAcc = (tx.account_name || "").toLowerCase().includes(q);
      if (!matchNotes && !matchContact && !matchCat && !matchParentCat && !matchAcc) return false;
    }
    return true;
  });

  const paymentAccounts = accounts.filter(
    (a) => a.is_payment_account || (a.type === "ASSET" && ["CASH", "BANK"].includes(a.subtype))
  );
  const liabilityAccounts = accounts.filter((a) => a.type === "LIABILITY");
  const equityAccounts = accounts.filter((a) => a.type === "EQUITY");

  return (
    <div>
      {/* Header with Title and Actions */}
      <div className="acc-header">
        <div className="acc-title-group">
          <h2 className="acc-title">Transactions</h2>
          <p className="acc-subtitle">Full transaction ledger, financial accounts, and fund transfers.</p>
        </div>

        <div className="acc-header-actions">
          <div className="acc-tx-actions-grid">
            <button
              type="button"
              className="acc-btn acc-btn-primary acc-btn-sm"
              onClick={() => openFastModal("INCOME")}
            >
              + Add Income / Sale
            </button>
            <button
              type="button"
              className="acc-btn acc-btn-outline acc-btn-sm"
              onClick={() => openFastModal("EXPENSE")}
            >
              - Add Expense
            </button>
            <button
              type="button"
              className="acc-btn acc-btn-outline acc-btn-sm acc-tx-transfer-btn"
              onClick={() => openFastModal("TRANSFER")}
            >
              ⇄ Transfer Funds
            </button>
            {subtab === "TRANSACTIONS" && (
              <a
                href={`/api/accounting/reports/export?workspaceId=${activeWorkspace?.id}&status=POSTED&format=csv`}
                download="transactions.csv"
                className="acc-btn acc-btn-outline acc-btn-sm acc-tx-export-btn"
              >
                Export CSV
              </a>
            )}
            {subtab === "VOIDED" && (
              <a
                href={`/api/accounting/reports/export?workspaceId=${activeWorkspace?.id}&status=VOIDED&type=EXPENSE&format=csv`}
                download="voided_expenses.csv"
                className="acc-btn acc-btn-outline acc-btn-sm acc-tx-export-btn"
              >
                Export CSV
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Navigation Segmented Control: All Transactions, Purchases, Account Balances, Voided */}
      <div className="acc-transactions-subtabs" role="tablist" aria-label="Transactions subsections">
        <button
          type="button"
          role="tab"
          aria-selected={subtab === "TRANSACTIONS"}
          className={`acc-subtab-btn ${subtab === "TRANSACTIONS" ? "active" : ""}`}
          onClick={() => setSubtab("TRANSACTIONS")}
        >
          <span className="acc-subtab-icon">💳</span>
          <span className="acc-subtab-label">All Transactions</span>
          <span className="acc-subtab-badge">{activeTotal}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subtab === "PURCHASES"}
          className={`acc-subtab-btn ${subtab === "PURCHASES" ? "active" : ""}`}
          onClick={() => setSubtab("PURCHASES")}
        >
          <span className="acc-subtab-icon">🛒</span>
          <span className="acc-subtab-label">Purchases</span>
          <span className="acc-subtab-badge">{purchasesTotal}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subtab === "BALANCES"}
          className={`acc-subtab-btn ${subtab === "BALANCES" ? "active" : ""}`}
          onClick={() => setSubtab("BALANCES")}
        >
          <span className="acc-subtab-icon">🏦</span>
          <span className="acc-subtab-label">Account Balances</span>
          <span className="acc-subtab-badge">{paymentAccounts.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subtab === "VOIDED"}
          className={`acc-subtab-btn ${subtab === "VOIDED" ? "active" : ""}`}
          onClick={() => setSubtab("VOIDED")}
        >
          <span className="acc-subtab-icon">🗑️</span>
          <span className="acc-subtab-label">Voided</span>
          <span className="acc-subtab-badge">{voidedTotal}</span>
        </button>
      </div>

      {/* Feedback Toast Notification Banner */}
      {feedbackToast && (
        <div
          className={`acc-alert ${feedbackToast.type === "danger" ? "acc-alert-danger" : "acc-alert-success"}`}
          style={{
            marginBottom: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          role="status"
          aria-live="polite"
        >
          <span>{feedbackToast.message}</span>
          <button
            type="button"
            onClick={() => setFeedbackToast(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: "1.1rem",
              lineHeight: 1,
            }}
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* VIEW 1: All Transactions Ledger (Excludes voided expenses) */}
      {subtab === "TRANSACTIONS" && (
        <div>
          {/* Filters Bar */}
          <div className="acc-card" style={{ marginBottom: "1.25rem", padding: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <input
                  type="text"
                  className="acc-form-input"
                  placeholder="Search by description, contact, account, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div style={{ minWidth: "170px" }}>
                <select
                  className="acc-form-select"
                  value={filterCategoryId}
                  onChange={(e) => setFilterCategoryId(e.target.value)}
                  style={{ height: "38px" }}
                >
                  <option value="">All Categories</option>
                  {categories
                    .filter((c) => !c.parent_id)
                    .map((main) => {
                      const subs = categories.filter((s) => s.parent_id === main.id);
                      return (
                        <React.Fragment key={main.id}>
                          <option value={main.id}>{main.name} ({main.type})</option>
                          {subs.map((sub) => (
                            <option key={sub.id} value={sub.id}>&nbsp;&nbsp;↳ {sub.name}</option>
                          ))}
                        </React.Fragment>
                      );
                    })}
                </select>
              </div>
              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                {["ALL", "INCOME", "EXPENSE", "TRANSFER"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`acc-btn acc-btn-sm ${filterType === t ? "acc-btn-primary" : "acc-btn-outline"}`}
                    onClick={() => setFilterType(t)}
                  >
                    {t === "ALL" ? "All Types" : t === "INCOME" ? "+ Income" : t === "EXPENSE" ? "- Expense" : "⇄ Transfers"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="acc-card">
            {loading ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
                Loading transactions ledger...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
                No transactions match the selected filters.
              </div>
            ) : (
              <div className="acc-table-wrapper">
                <table className="acc-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: "160px" }}>Description / Contact</th>
                      <th style={{ minWidth: "120px", whiteSpace: "nowrap" }}>Category</th>
                      <th style={{ minWidth: "120px", whiteSpace: "nowrap" }}>Subcategory</th>
                      <th style={{ minWidth: "90px", whiteSpace: "nowrap" }}>Date</th>
                      <th style={{ minWidth: "110px", whiteSpace: "nowrap" }}>Account</th>
                      <th style={{ minWidth: "80px", whiteSpace: "nowrap" }}>Status</th>
                      <th className="acc-align-right" style={{ minWidth: "100px", whiteSpace: "nowrap" }}>Amount</th>
                      {canMutate && <th className="acc-align-right" style={{ minWidth: "120px", whiteSpace: "nowrap" }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => {
                      const catInfo = resolveTransactionCategory(tx);
                      return (
                        <tr key={tx.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 600 }}>
                                {tx.contact_name || tx.notes || "General Entry"}
                              </span>
                              {Boolean(tx.purchase_id) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPurchaseId(tx.purchase_id!);
                                    setPurchaseDetailOpen(true);
                                  }}
                                  className="acc-badge"
                                  style={{
                                    cursor: "pointer",
                                    backgroundColor: "var(--acc-blue-soft, rgba(37,99,235,0.2))",
                                    color: "var(--acc-blue-accent, #2583FF)",
                                    border: "1px solid var(--acc-blue-border, #303030)",
                                    fontSize: "0.6875rem",
                                    padding: "0.15rem 0.45rem",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                  }}
                                  title="View linked purchase details"
                                >
                                  🛒 {tx.purchase_number || "Purchase"}
                                </button>
                              )}
                              {Boolean(tx.attachment_count && tx.attachment_count > 0) && (
                                <button
                                  type="button"
                                  className="acc-tx-attachment-badge"
                                  title={`View ${tx.attachment_count} attachment${(tx.attachment_count || 0) > 1 ? "s" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAttachmentViewer(tx);
                                  }}
                                >
                                  <Paperclip size={12} />
                                  <span>{tx.attachment_count}</span>
                                </button>
                              )}
                            </div>
                            {tx.notes && tx.contact_name && (
                              <div style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)" }}>
                                {tx.notes}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="acc-badge acc-badge-neutral">
                              {catInfo.category}
                            </span>
                          </td>
                          <td>
                            {catInfo.hasSubcategory ? (
                              <span className="acc-badge acc-badge-neutral" style={{ fontWeight: 600 }}>
                                {catInfo.subcategory}
                              </span>
                            ) : (
                              <span style={{ color: "var(--acc-text-muted)" }}>—</span>
                            )}
                          </td>
                          <td style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", whiteSpace: "nowrap" }}>
                            {tx.date}
                          </td>
                          <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>
                            {tx.account_name || "—"}
                          </td>
                          <td>
                            <span
                              className={`acc-badge ${
                                tx.status === "POSTED"
                                  ? "acc-badge-success"
                                  : tx.status === "VOIDED"
                                  ? "acc-badge-danger"
                                  : "acc-badge-neutral"
                              }`}
                              style={{ fontSize: "0.6875rem" }}
                            >
                              {tx.status}
                            </span>
                          </td>
                          <td
                            className="acc-align-right tabular-nums font-bold"
                            style={{
                              color:
                                tx.type === "INCOME"
                                  ? "var(--acc-success)"
                                  : tx.type === "EXPENSE"
                                  ? "var(--acc-danger)"
                                  : "var(--acc-blue)",
                            }}
                          >
                            {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
                            {formatMoney(tx.amount_minor, activeWorkspace?.currency)}
                          </td>
                          {canMutate && (
                            <td className="acc-align-right" style={{ whiteSpace: "nowrap" }}>
                              {tx.status === "POSTED" && (
                                <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                                  <button
                                    type="button"
                                    className="acc-btn acc-btn-sm acc-btn-outline"
                                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                                    onClick={() => openEditTx(tx)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="acc-btn acc-btn-sm acc-btn-outline"
                                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", color: "var(--acc-danger)" }}
                                    onClick={() => {
                                      setVoidingTx(tx);
                                      setVoidError(null);
                                    }}
                                  >
                                    Void
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 1B: Purchases */}
      {subtab === "PURCHASES" && (
        <div>
          {/* Header & New Purchase Action */}
          <div className="acc-purchases-header">
            <div className="acc-purchases-title-wrap">
              <h2 className="acc-purchases-title">
                Purchases &amp; Supplier Bills
              </h2>
              <p className="acc-purchases-sub">
                Track supplier bills, record payments from Cash in Hand or Bank Account, and monitor Accounts Payable.
              </p>
            </div>
            {canMutate && (
              <button
                type="button"
                className="acc-btn acc-btn-primary acc-purchases-new-btn"
                onClick={() => {
                  setEditingDraftData(null);
                  setCreatePurchaseOpen(true);
                }}
              >
                <Plus size={16} />
                + New Purchase
              </button>
            )}
          </div>

          {/* Filters Bar: Search & Status / Date Filters */}
          <div className="acc-card" style={{ marginBottom: "1.25rem", padding: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              {/* Search input */}
              <div className="acc-purchases-search-wrap" style={{ flex: 1, minWidth: "240px", position: "relative" }}>
                <Search
                  size={16}
                  style={{
                    position: "absolute",
                    left: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--acc-text-muted)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="text"
                  className="acc-form-input"
                  style={{ paddingLeft: "2.25rem" }}
                  placeholder="Search by supplier, reference (PUR-...), or bill #..."
                  value={purchaseSearchTerm}
                  onChange={(e) => setPurchaseSearchTerm(e.target.value)}
                />
              </div>

              {/* Mobile Status Dropdown */}
              <div className="acc-purchases-status-select-wrap">
                <select
                  className="acc-form-select"
                  value={purchaseStatusFilter}
                  onChange={(e) => setPurchaseStatusFilter(e.target.value)}
                  style={{ height: "36px", fontSize: "0.8125rem", width: "100%" }}
                  aria-label="Filter purchases by status"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">Drafts</option>
                  <option value="UNPAID">Unpaid</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="PAID">Paid</option>
                  <option value="VOIDED">Voided</option>
                </select>
              </div>

              {/* Status filter pills */}
              <div className="acc-purchases-status-chips" style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                {[
                  { key: "ALL", label: "All" },
                  { key: "DRAFT", label: "Drafts" },
                  { key: "UNPAID", label: "Unpaid" },
                  { key: "PARTIALLY_PAID", label: "Partially Paid" },
                  { key: "PAID", label: "Paid" },
                  { key: "VOIDED", label: "Voided" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={`acc-btn acc-btn-sm ${purchaseStatusFilter === key ? "acc-btn-primary" : "acc-btn-outline"}`}
                    onClick={() => setPurchaseStatusFilter(key)}
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Date Filters */}
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>From:</span>
                  <input
                    type="date"
                    className="acc-form-input"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.8125rem", width: "135px" }}
                    value={purchaseStartDate}
                    onChange={(e) => setPurchaseStartDate(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>To:</span>
                  <input
                    type="date"
                    className="acc-form-input"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.8125rem", width: "135px" }}
                    value={purchaseEndDate}
                    onChange={(e) => setPurchaseEndDate(e.target.value)}
                  />
                </div>
                {(Boolean(purchaseStartDate) || Boolean(purchaseEndDate) || Boolean(purchaseSearchTerm) || purchaseStatusFilter !== "ALL") && (
                  <button
                    type="button"
                    className="acc-btn acc-btn-sm acc-btn-outline"
                    onClick={() => {
                      setPurchaseSearchTerm("");
                      setPurchaseStatusFilter("ALL");
                      setPurchaseStartDate("");
                      setPurchaseEndDate("");
                    }}
                    style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Purchases Table or Empty State */}
          <div className="acc-card">
            {loadingPurchases ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
                Loading purchases ledger...
              </div>
            ) : purchases.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "3.5rem 1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(37, 99, 235, 0.1)",
                    border: "1px solid rgba(37, 99, 235, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <ShoppingBag size={32} color="var(--acc-blue, #3B82F6)" />
                </div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>
                  {purchaseSearchTerm || purchaseStatusFilter !== "ALL" || purchaseStartDate || purchaseEndDate
                    ? "No purchases match your filters"
                    : "Record your first purchase"}
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--acc-text-muted)",
                    maxWidth: "460px",
                    margin: "0 0 1.5rem 0",
                    lineHeight: 1.5,
                  }}
                >
                  {purchaseSearchTerm || purchaseStatusFilter !== "ALL" || purchaseStartDate || purchaseEndDate
                    ? "Try adjusting your search terms, status filters, or date range."
                    : "Add supplier bills, link item lines and expense categories, track outstanding balances under Accounts Payable, and record cash/bank disbursements."}
                </p>
                {canMutate && (
                  purchaseSearchTerm || purchaseStatusFilter !== "ALL" || purchaseStartDate || purchaseEndDate ? (
                    <button
                      type="button"
                      className="acc-btn acc-btn-outline"
                      onClick={() => {
                        setPurchaseSearchTerm("");
                        setPurchaseStatusFilter("ALL");
                        setPurchaseStartDate("");
                        setPurchaseEndDate("");
                      }}
                    >
                      Clear All Filters
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="acc-btn acc-btn-primary"
                      onClick={() => {
                        setEditingDraftData(null);
                        setCreatePurchaseOpen(true);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.6rem 1.25rem",
                        fontWeight: 600,
                      }}
                    >
                      <Plus size={16} />
                      + Record First Purchase
                    </button>
                  )
                )}
              </div>
            ) : (
              <div className="acc-table-wrapper">
                <table className="acc-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: "120px", whiteSpace: "nowrap" }}>Reference</th>
                      <th style={{ minWidth: "95px", whiteSpace: "nowrap" }}>Date</th>
                      <th style={{ minWidth: "160px" }}>Supplier</th>
                      <th className="acc-align-right" style={{ minWidth: "105px", whiteSpace: "nowrap" }}>Total</th>
                      <th className="acc-align-right" style={{ minWidth: "95px", whiteSpace: "nowrap" }}>Paid</th>
                      <th className="acc-align-right" style={{ minWidth: "105px", whiteSpace: "nowrap" }}>Balance</th>
                      <th style={{ minWidth: "100px", whiteSpace: "nowrap" }}>Status</th>
                      <th className="acc-align-right" style={{ minWidth: "120px", whiteSpace: "nowrap" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p) => {
                      const totalMinor = Number(p.total_minor ?? p.total_amount_minor ?? 0);
                      const paidMinor = Number(p.amount_paid_minor ?? p.paid_amount_minor ?? 0);
                      const dueMinor = Number(p.amount_due_minor ?? p.balance_due_minor ?? 0);
                      const isDraft = p.status === "DRAFT";
                      const isVoided = p.status === "VOIDED";
                      const hasBalance = !isDraft && !isVoided && dueMinor > 0;

                      return (
                        <tr
                          key={p.id}
                          style={{
                            cursor: "pointer",
                            opacity: isVoided ? 0.65 : 1,
                          }}
                          onClick={() => {
                            setSelectedPurchaseId(p.id);
                            setPurchaseDetailOpen(true);
                          }}
                        >
                          {/* Reference */}
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                <span style={{ fontWeight: 700, color: "var(--acc-blue, #60A5FA)" }}>
                                  {p.purchase_number}
                                </span>
                                {Boolean(p.attachment_count && p.attachment_count > 0) && (
                                  <span
                                    title={`${p.attachment_count} attachment(s)`}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "0.15rem",
                                      fontSize: "0.6875rem",
                                      color: "var(--acc-text-muted)",
                                    }}
                                  >
                                    <Paperclip size={12} />
                                    {p.attachment_count}
                                  </span>
                                )}
                              </div>
                              {p.supplier_bill_number && (
                                <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                                  Bill #{p.supplier_bill_number}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Date */}
                          <td style={{ fontSize: "0.8125rem", whiteSpace: "nowrap" }}>
                            <div>{p.purchase_date}</div>
                            {p.due_date && (
                              <div style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)" }}>
                                Due: {p.due_date}
                              </div>
                            )}
                          </td>

                          {/* Supplier */}
                          <td>
                            <div style={{ fontWeight: 600 }}>{p.supplier_name || "Unknown Supplier"}</div>
                            {p.category_name && (
                              <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                                {p.category_name}
                              </div>
                            )}
                          </td>

                          {/* Total */}
                          <td className="acc-align-right tabular-nums font-bold" style={{ whiteSpace: "nowrap" }}>
                            {formatMoney(totalMinor, activeWorkspace?.currency)}
                          </td>

                          {/* Paid */}
                          <td
                            className="acc-align-right tabular-nums"
                            style={{
                              whiteSpace: "nowrap",
                              color: paidMinor > 0 ? "var(--acc-success, #10B981)" : "var(--acc-text-muted)",
                            }}
                          >
                            {formatMoney(paidMinor, activeWorkspace?.currency)}
                          </td>

                          {/* Balance */}
                          <td
                            className="acc-align-right tabular-nums font-bold"
                            style={{
                              whiteSpace: "nowrap",
                              color: hasBalance
                                ? "var(--acc-danger, #EF4444)"
                                : isDraft
                                ? "var(--acc-text-muted)"
                                : "var(--acc-success, #10B981)",
                            }}
                          >
                            {formatMoney(dueMinor, activeWorkspace?.currency)}
                          </td>

                          {/* Status */}
                          <td>
                            <span
                              className={`acc-badge ${
                                p.status === "PAID"
                                  ? "acc-badge-success"
                                  : p.status === "PARTIALLY_PAID"
                                  ? "acc-badge-warning"
                                  : p.status === "UNPAID"
                                  ? "acc-badge-danger"
                                  : isVoided
                                  ? "acc-badge-neutral"
                                  : "acc-badge-neutral"
                              }`}
                              style={{
                                fontSize: "0.6875rem",
                                textDecoration: isVoided ? "line-through" : "none",
                              }}
                            >
                              {p.status === "PARTIALLY_PAID"
                                ? "Partially Paid"
                                : p.status === "UNPAID"
                                ? "Unpaid"
                                : p.status === "PAID"
                                ? "Paid"
                                : p.status === "DRAFT"
                                ? "Draft"
                                : p.status === "VOIDED"
                                ? "Voided"
                                : p.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="acc-align-right" style={{ whiteSpace: "nowrap" }}>
                            <div
                              style={{ display: "inline-flex", gap: "0.35rem" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="acc-btn acc-btn-sm acc-btn-outline"
                                style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                                onClick={() => {
                                  setSelectedPurchaseId(p.id);
                                  setPurchaseDetailOpen(true);
                                }}
                              >
                                View
                              </button>

                              {canMutate && isDraft && (
                                <button
                                  type="button"
                                  className="acc-btn acc-btn-sm acc-btn-outline"
                                  style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", color: "var(--acc-blue, #60A5FA)" }}
                                  onClick={() => handleEditDraft(p)}
                                >
                                  Edit
                                </button>
                              )}

                              {canMutate && hasBalance && (
                                <button
                                  type="button"
                                  className="acc-btn acc-btn-sm acc-btn-primary"
                                  style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                                  onClick={() => {
                                    setSelectedPurchaseId(p.id);
                                    setPurchaseDetailOpen(true);
                                  }}
                                >
                                  Pay
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: Account Balances & Opening Balances */}
      {subtab === "BALANCES" && (
        <div className="acc-two-col-equal">
          {/* Payment Accounts */}
          <div className="acc-card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                  Payment Accounts
                </h3>
                <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                  Cash in Hand and Bank Account payment balances
                </span>
              </div>
              {canMutate && (
                <button
                  type="button"
                  className="acc-btn acc-btn-outline acc-btn-sm"
                  onClick={() => setOpeningModalOpen(true)}
                >
                  Set Opening Balance
                </button>
              )}
            </div>

            <div className="acc-table-wrapper">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th className="acc-col-name">Account Name</th>
                    <th className="acc-align-right acc-col-balance" style={{ width: "140px", whiteSpace: "nowrap" }}>Current Balance</th>
                    <th className="acc-align-right acc-col-action" style={{ width: "160px", whiteSpace: "nowrap" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentAccounts.map((acc) => (
                    <tr key={acc.id}>
                      <td className="acc-col-name" style={{ fontWeight: 600, overflowWrap: "break-word" }}>
                        {acc.name}
                      </td>
                      <td className="acc-align-right tabular-nums font-bold acc-col-balance" style={{ color: Number(acc.current_balance_minor) >= 0 ? "var(--acc-text-main)" : "var(--acc-danger)" }}>
                        {formatMoney(acc.current_balance_minor, activeWorkspace?.currency)}
                      </td>
                      <td className="acc-align-right acc-col-action" style={{ whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "0.35rem", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="acc-btn acc-btn-sm acc-btn-outline"
                            style={{ padding: "0.2rem 0.45rem", fontSize: "0.75rem" }}
                            onClick={() => handleOpenHistory(acc)}
                            title="View balance and funding history"
                          >
                            History
                          </button>
                          {canMutate && (
                            <button
                              type="button"
                              className="acc-btn acc-btn-sm acc-btn-outline"
                              style={{ padding: "0.2rem 0.45rem", fontSize: "0.75rem" }}
                              onClick={() => {
                                setSelectedAccountId(acc.id);
                                setOpeningBalanceStr((Number(acc.opening_balance_minor || 0) / 100).toString());
                                setOpeningModalOpen(true);
                              }}
                            >
                              Adjust
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Liability Accounts */}
          <div className="acc-card" style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.25rem 0" }}>
              Liabilities & Payables
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "block", marginBottom: "1rem" }}>
              Payables to suppliers, loans, and financial obligations
            </span>

            <div className="acc-table-wrapper">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th className="acc-col-code" style={{ width: "50px", whiteSpace: "nowrap" }}>Code</th>
                    <th className="acc-col-name">Account Name</th>
                    <th style={{ width: "80px", whiteSpace: "nowrap" }}>Subtype</th>
                    <th className="acc-align-right acc-col-balance" style={{ width: "125px", whiteSpace: "nowrap" }}>Current Balance</th>
                    <th className="acc-align-right acc-col-action" style={{ width: "100px", whiteSpace: "nowrap" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {liabilityAccounts.map((acc) => (
                    <tr key={acc.id}>
                      <td className="acc-col-code" style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--acc-text-muted)" }}>
                        {acc.code}
                      </td>
                      <td className="acc-col-name" style={{ fontWeight: 600 }}>
                        {acc.name}
                        {acc.description && (
                          <div style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)", fontWeight: "normal" }}>
                            {acc.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="acc-badge acc-badge-neutral">{acc.subtype}</span>
                      </td>
                      <td className="acc-align-right tabular-nums font-bold acc-col-balance" style={{ color: "var(--acc-warning)" }}>
                        {formatMoney(acc.current_balance_minor, activeWorkspace?.currency)}
                      </td>
                      <td className="acc-align-right acc-col-action" style={{ whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="acc-btn acc-btn-sm acc-btn-outline"
                          style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                          onClick={() => handleOpenHistory(acc)}
                          title="View balance and funding history"
                        >
                          📜 History
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Equity Accounts */}
          <div className="acc-card">
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.25rem 0" }}>
              Owner Equity & Capital
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "block", marginBottom: "1rem" }}>
              Net capital investment and retained business earnings
            </span>

            <div className="acc-table-wrapper">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th className="acc-col-code" style={{ width: "70px", whiteSpace: "nowrap" }}>Code</th>
                    <th className="acc-col-name">Account Name</th>
                    <th style={{ width: "110px", whiteSpace: "nowrap" }}>Subtype</th>
                    <th className="acc-align-right acc-col-balance" style={{ width: "150px", whiteSpace: "nowrap" }}>Current Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {equityAccounts.map((acc) => (
                    <tr key={acc.id}>
                      <td className="acc-col-code" style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--acc-text-muted)" }}>
                        {acc.code}
                      </td>
                      <td className="acc-col-name" style={{ fontWeight: 600 }}>
                        {acc.name}
                        {acc.description && (
                          <div style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)", fontWeight: "normal" }}>
                            {acc.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="acc-badge acc-badge-neutral">{acc.subtype}</span>
                      </td>
                      <td className="acc-align-right tabular-nums font-bold acc-col-balance" style={{ color: "var(--acc-text-main)" }}>
                        {formatMoney(acc.current_balance_minor, activeWorkspace?.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: Voided Expenses Section */}
      {subtab === "VOIDED" && (
        <div>
          <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
            Voided expenses are kept here for your records. Restore an expense to make it active again.
          </p>

          {/* Voided Filters Bar (Expenses-focused: no income/transfer options) */}
          <div className="acc-card" style={{ marginBottom: "1.25rem", padding: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <input
                  type="text"
                  className="acc-form-input"
                  placeholder="Search by description, contact, account, or category..."
                  value={voidedSearchTerm}
                  onChange={(e) => setVoidedSearchTerm(e.target.value)}
                />
              </div>
              <div style={{ minWidth: "170px" }}>
                <select
                  className="acc-form-select"
                  value={voidedCategoryId}
                  onChange={(e) => setVoidedCategoryId(e.target.value)}
                  style={{ height: "38px" }}
                >
                  <option value="">All Categories</option>
                  {categories
                    .filter((c) => !c.parent_id && c.type === "EXPENSE")
                    .map((main) => {
                      const subs = categories.filter((s) => s.parent_id === main.id);
                      return (
                        <React.Fragment key={main.id}>
                          <option value={main.id}>{main.name}</option>
                          {subs.map((sub) => (
                            <option key={sub.id} value={sub.id}>&nbsp;&nbsp;↳ {sub.name}</option>
                          ))}
                        </React.Fragment>
                      );
                    })}
                </select>
              </div>
            </div>
          </div>

          {/* Voided Expenses Table */}
          <div className="acc-card">
            {loadingVoided ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
                Loading voided expenses...
              </div>
            ) : filteredVoided.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
                No voided expenses
              </div>
            ) : (
              <div className="acc-table-wrapper">
                <table className="acc-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: "160px" }}>Description / Contact</th>
                      <th style={{ minWidth: "120px", whiteSpace: "nowrap" }}>Category</th>
                      <th style={{ minWidth: "120px", whiteSpace: "nowrap" }}>Subcategory</th>
                      <th style={{ minWidth: "90px", whiteSpace: "nowrap" }}>Date</th>
                      <th style={{ minWidth: "110px", whiteSpace: "nowrap" }}>Account</th>
                      <th style={{ minWidth: "80px", whiteSpace: "nowrap" }}>Status</th>
                      <th className="acc-align-right" style={{ minWidth: "100px", whiteSpace: "nowrap" }}>Amount</th>
                      {canMutate && <th className="acc-align-right" style={{ minWidth: "100px", whiteSpace: "nowrap" }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVoided.map((tx) => {
                      const catInfo = resolveTransactionCategory(tx);
                      return (
                        <tr key={tx.id} style={{ opacity: 1 }}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 600, color: "var(--acc-text-main)" }}>
                                {tx.contact_name || tx.notes || "General Entry"}
                              </span>
                              {Boolean(tx.attachment_count && tx.attachment_count > 0) && (
                                <button
                                  type="button"
                                  className="acc-tx-attachment-badge"
                                  title={`View ${tx.attachment_count} attachment${(tx.attachment_count || 0) > 1 ? "s" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAttachmentViewer(tx);
                                  }}
                                >
                                  <Paperclip size={12} />
                                  <span>{tx.attachment_count}</span>
                                </button>
                              )}
                            </div>
                            {tx.notes && tx.contact_name && (
                              <div style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)" }}>
                                {tx.notes}
                              </div>
                            )}
                            {(tx.voided_at || tx.voided_by_name) && (
                              <div style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)", marginTop: "0.2rem" }}>
                                Voided {formatVoidDate(tx.voided_at)}{tx.voided_by_name ? ` by ${tx.voided_by_name}` : ""}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="acc-badge acc-badge-neutral">
                              {catInfo.category}
                            </span>
                          </td>
                          <td>
                            {catInfo.hasSubcategory ? (
                              <span className="acc-badge acc-badge-neutral" style={{ fontWeight: 600 }}>
                                {catInfo.subcategory}
                              </span>
                            ) : (
                              <span style={{ color: "var(--acc-text-muted)" }}>—</span>
                            )}
                          </td>
                          <td style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", whiteSpace: "nowrap" }}>
                            {tx.date}
                          </td>
                          <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>
                            {tx.account_name || "—"}
                          </td>
                          <td>
                            <span className="acc-badge acc-badge-danger" style={{ fontSize: "0.6875rem" }}>
                              VOIDED
                            </span>
                          </td>
                          <td
                            className="acc-align-right tabular-nums font-bold"
                            style={{ color: "var(--acc-danger)" }}
                          >
                            -{formatMoney(tx.amount_minor, activeWorkspace?.currency)}
                          </td>
                          {canMutate && (
                            <td className="acc-align-right" style={{ whiteSpace: "nowrap" }}>
                              <button
                                type="button"
                                className="acc-btn acc-btn-sm acc-btn-outline"
                                style={{ padding: "0.2rem 0.65rem", fontSize: "0.75rem", fontWeight: 600 }}
                                onClick={() => {
                                  setRestoringTx(tx);
                                  setRestoreError(null);
                                }}
                              >
                                ↺ Restore
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Opening Balance Modal */}
      {openingModalOpen && (
        <div className="acc-modal-backdrop" onClick={() => setOpeningModalOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Set Account Opening Balance</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setOpeningModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSetOpeningBalance}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="opening-account-select">
                  Select Financial Account *
                </label>
                <select
                  id="opening-account-select"
                  required
                  className="acc-form-select"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                >
                  <option value="">-- Choose Account --</option>
                  {paymentAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="opening-balance-input">
                  Balance Amount (₹) *
                </label>
                <FormattedMoneyInput
                  id="opening-balance-input"
                  required
                  className="acc-form-input acc-amount-hero-input tabular-nums"
                  placeholder="0.00"
                  value={openingBalanceStr}
                  onChange={(e) => setOpeningBalanceStr(e.target.value)}
                />
              </div>

              {(() => {
                const selAcc = accounts.find((a) => a.id === selectedAccountId);
                if (!selAcc) return null;
                const recOpening = Number(selAcc.opening_balance_minor || 0);
                if (recOpening > 0) {
                  return (
                    <div className="acc-preview-box" style={{ marginTop: "0.75rem", marginBottom: "0.75rem" }}>
                      <div className="acc-preview-title">Existing Account Record</div>
                      <div className="acc-preview-row">
                        <span>Recorded Opening:</span>
                        <span className="tabular-nums font-bold">
                          {formatMoney(recOpening, activeWorkspace?.currency)}
                        </span>
                      </div>
                      <div className="acc-preview-row">
                        <span>Current Total Balance:</span>
                        <span className="tabular-nums font-bold">
                          {formatMoney(selAcc.current_balance_minor, activeWorkspace?.currency)}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", margin: "0.5rem 0 0 0" }}>
                        Submitting adjusts the opening balance by the difference against Owner Equity (Account 3000). Later transactions remain intact. If you entered the wrong account or want to undo this entry, use <strong>Account History → Correct / Reverse</strong>.
                      </p>
                    </div>
                  );
                }
                return (
                  <p style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", marginTop: "0.5rem" }}>
                    Setting an initial opening balance automatically posts a balanced double-entry journal against Owner Equity (Account 3000).
                  </p>
                );
              })()}

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setOpeningModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submittingOpening}
                >
                  {submittingOpening ? "Updating..." : "Save Balance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Expense Confirmation Modal */}
      {voidingTx && (
        <div
          className="acc-modal-backdrop"
          onClick={() => {
            if (!submittingVoid) setVoidingTx(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-expense-title"
        >
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="acc-modal-header">
              <h3 id="void-expense-title" className="acc-modal-title">
                Void this expense?
              </h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => {
                  if (!submittingVoid) setVoidingTx(null);
                }}
                disabled={submittingVoid}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConfirmVoid}>
              {voidError && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {voidError}
                </div>
              )}

              {/* Expense Context Card */}
              <div
                style={{
                  background: "var(--acc-raised)",
                  border: "1px solid var(--acc-border)",
                  borderRadius: "var(--acc-radius-md)",
                  padding: "0.875rem 1rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.35rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--acc-text-main)" }}>
                    {voidingTx.contact_name || voidingTx.notes || "General Entry"}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--acc-danger)", fontVariantNumeric: "tabular-nums" }}>
                    -{formatMoney(voidingTx.amount_minor, activeWorkspace?.currency)}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  {voidingTx.account_name && <span>Account: <strong>{voidingTx.account_name}</strong></span>}
                  {(() => {
                    const cInfo = resolveTransactionCategory(voidingTx);
                    return cInfo.hasCategory ? (
                      <span>Category: <strong>{cInfo.category}</strong>{cInfo.hasSubcategory ? <> → <strong>{cInfo.subcategory}</strong></> : null}</span>
                    ) : null;
                  })()}
                  <span>Date: <strong>{voidingTx.date}</strong></span>
                </div>
              </div>

              <p style={{ fontSize: "0.875rem", color: "var(--acc-text-main)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
                This expense will leave All Transactions and appear in Voided. Its effect on your account balance and expense totals will be reversed. You can restore it later.
              </p>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  onClick={() => setVoidingTx(null)}
                  disabled={submittingVoid}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ backgroundColor: "var(--acc-danger)", borderColor: "var(--acc-danger)" }}
                  disabled={submittingVoid}
                >
                  {submittingVoid ? "Voiding..." : "Yes, void expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Expense Confirmation Modal */}
      {restoringTx && (
        <div
          className="acc-modal-backdrop"
          onClick={() => {
            if (!submittingRestore) setRestoringTx(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-expense-title"
        >
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="acc-modal-header">
              <h3 id="restore-expense-title" className="acc-modal-title">
                Restore this expense?
              </h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => {
                  if (!submittingRestore) setRestoringTx(null);
                }}
                disabled={submittingRestore}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConfirmRestore}>
              {restoreError && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {restoreError}
                </div>
              )}

              {/* Expense Context Card */}
              <div
                style={{
                  background: "var(--acc-raised)",
                  border: "1px solid var(--acc-border)",
                  borderRadius: "var(--acc-radius-md)",
                  padding: "0.875rem 1rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.35rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--acc-text-main)" }}>
                    {restoringTx.contact_name || restoringTx.notes || "General Entry"}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--acc-danger)", fontVariantNumeric: "tabular-nums" }}>
                    -{formatMoney(restoringTx.amount_minor, activeWorkspace?.currency)}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  {restoringTx.account_name && <span>Account: <strong>{restoringTx.account_name}</strong></span>}
                  {(() => {
                    const cInfo = resolveTransactionCategory(restoringTx);
                    return cInfo.hasCategory ? (
                      <span>Category: <strong>{cInfo.category}</strong>{cInfo.hasSubcategory ? <> → <strong>{cInfo.subcategory}</strong></> : null}</span>
                    ) : null;
                  })()}
                  <span>Date: <strong>{restoringTx.date}</strong></span>
                </div>
              </div>

              <p style={{ fontSize: "0.875rem", color: "var(--acc-text-main)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
                This expense will return to All Transactions and affect your account balance and expense totals again.
              </p>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  onClick={() => setRestoringTx(null)}
                  disabled={submittingRestore}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  disabled={submittingRestore}
                >
                  {submittingRestore ? "Restoring..." : "Yes, restore expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="acc-modal-backdrop" onClick={() => setEditingTx(null)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="acc-modal-header">
              <div>
                <h3 className="acc-modal-title">Edit Transaction</h3>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                  {editingTx.type} • {formatMoney(editingTx.amount_minor, activeWorkspace?.currency)}
                </p>
              </div>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setEditingTx(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEditTx}>
              {editError && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {editError}
                </div>
              )}

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="edit-tx-date">
                  Date *
                </label>
                <input
                  id="edit-tx-date"
                  type="date"
                  required
                  className="acc-form-input"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>

              {editingTx.type !== "TRANSFER" && (
                <>
                  <div className="acc-form-group">
                    <label className="acc-form-label" htmlFor="edit-main-cat">
                      Category (Main)
                    </label>
                    <select
                      id="edit-main-cat"
                      className="acc-form-select"
                      value={editMainCatId}
                      onChange={(e) => {
                        setEditMainCatId(e.target.value);
                        setEditSubCatId(""); // Clear subcategory when parent changes
                      }}
                    >
                      <option value="">No Category</option>
                      {categories
                        .filter((c) => !c.parent_id && !c.is_archived && c.type === editingTx.type)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {editMainCatId && (
                    <div className="acc-form-group">
                      <label className="acc-form-label" htmlFor="edit-sub-cat">
                        Subcategory (Optional)
                      </label>
                      <select
                        id="edit-sub-cat"
                        className="acc-form-select"
                        value={editSubCatId}
                        onChange={(e) => setEditSubCatId(e.target.value)}
                      >
                        <option value="">None (Keep under main category)</option>
                        {categories
                          .filter((c) => c.parent_id === editMainCatId && !c.is_archived)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              ↳ {c.name}
                            </option>
                          ))}
                      </select>
                      <small style={{ color: "var(--acc-text-muted)", fontSize: "0.6875rem", display: "block", marginTop: "0.25rem" }}>
                        Only children of the selected category are shown.
                      </small>
                    </div>
                  )}
                </>
              )}

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="edit-tx-notes">
                  Description / Notes
                </label>
                <input
                  id="edit-tx-notes"
                  type="text"
                  className="acc-form-input"
                  placeholder="e.g. Office supplies purchase"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              {/* Attachments Section */}
              <div className="acc-form-group">
                <TransactionAttachmentsDropzone
                  key={editingTx.id}
                  transactionId={editingTx.id}
                  initialAttachments={editAttachments}
                  onChange={(ids) => setEditAttachmentIds(ids)}
                  onErrorStateChange={(busy) => setEditAttachmentsBusy(busy)}
                  disabled={submittingEdit}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setEditingTx(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submittingEdit}
                >
                  {submittingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Balance & Funding History Modal */}
      {historyModalOpen && selectedHistoryAccount && (
        <div className="acc-modal-backdrop" onClick={() => setHistoryModalOpen(false)}>
          <div
            className="acc-modal-content acc-history-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
          >
            <div className="acc-modal-header acc-history-header">
              <div>
                <h3 id="history-modal-title" className="acc-modal-title">
                  Account History — {selectedHistoryAccount.name} ({selectedHistoryAccount.code})
                </h3>
                <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                  General ledger postings, funding history, and corrections
                </span>
              </div>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setHistoryModalOpen(false)}
                aria-label="Close history modal"
              >
                ✕
              </button>
            </div>

            <div className="acc-history-meta">
              <div className="acc-history-meta-item">
                <span className="acc-history-meta-label">Account Code & Name</span>
                <span className="acc-history-meta-value" title={`${selectedHistoryAccount.code} · ${selectedHistoryAccount.name}`}>
                  {selectedHistoryAccount.code} · {selectedHistoryAccount.name}
                </span>
              </div>
              <div className="acc-history-meta-item">
                <span className="acc-history-meta-label">Recorded Opening</span>
                <span className="acc-history-meta-value tabular-nums">
                  {formatMoney(Number(selectedHistoryAccount.opening_balance_minor || 0), activeWorkspace?.currency)}
                </span>
              </div>
              <div className="acc-history-meta-item">
                <span className="acc-history-meta-label">Current Liquid Balance</span>
                <span
                  className="acc-history-meta-value tabular-nums"
                  style={{
                    color:
                      Number(selectedHistoryAccount.current_balance_minor) >= 0
                        ? "var(--acc-text-main)"
                        : "var(--acc-danger)",
                  }}
                >
                  {formatMoney(selectedHistoryAccount.current_balance_minor, activeWorkspace?.currency)}
                </span>
              </div>
              <div className="acc-history-meta-item">
                <span className="acc-history-meta-label">Classification</span>
                <span className="acc-history-meta-value">
                  {selectedHistoryAccount.type} ({selectedHistoryAccount.subtype})
                </span>
              </div>
            </div>

            <div className="acc-history-body">
              {loadingHistory ? (
                <div className="acc-history-state-message">
                  Loading account history from general ledger...
                </div>
              ) : historyError ? (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {historyError}
                </div>
              ) : historyItems.length === 0 ? (
                <div className="acc-history-state-message">
                  No journal entries or funding records found for this account.
                </div>
              ) : (
                <>
                  {/* Desktop & Tablet Table (>= 768px) with contained horizontal scroll and sticky actions */}
                  <div className="acc-table-wrapper acc-history-table-wrapper">
                    <table className="acc-table acc-history-table" aria-label="Account ledger history table">
                      <thead>
                        <tr>
                          <th className="acc-history-th-date">Date</th>
                          <th className="acc-history-th-entry">Entry / Type</th>
                          <th className="acc-history-th-desc">Description & Counterpart</th>
                          <th className="acc-align-right acc-history-th-amount">Amount</th>
                          <th className="acc-history-th-status">Status</th>
                          <th className="acc-history-th-recorder">Recorded By</th>
                          {canMutate && <th className="acc-align-right acc-col-action acc-history-th-action">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {historyItems.map((entry) => (
                          <tr key={entry.lineId}>
                            <td className="acc-history-td-date">
                              {entry.entryDate}
                            </td>
                            <td className="acc-history-td-entry">
                              <div className="acc-history-entry-num">
                                {entry.entryNumber}
                              </div>
                              <span
                                className="acc-badge acc-badge-neutral"
                                style={{ fontSize: "0.625rem", padding: "0.1rem 0.35rem" }}
                              >
                                {entry.displayType}
                              </span>
                            </td>
                            <td className="acc-history-td-desc">
                              <div className="acc-history-desc-title">
                                {entry.description || "General ledger movement"}
                              </div>
                              <div className="acc-history-desc-sub">
                                Counterpart: {entry.counterpartAccount}
                              </div>
                            </td>
                            <td
                              className={`acc-align-right tabular-nums acc-history-td-amount ${
                                entry.direction === "INFLOW" ? "acc-direction-inflow" : "acc-direction-outflow"
                              }`}
                            >
                              {entry.direction === "INFLOW" ? "+" : "-"}
                              {formatMoney(entry.amountMinor, activeWorkspace?.currency)}
                            </td>
                            <td className="acc-history-td-status">
                              {entry.status === "ACTIVE" ? (
                                <span className="acc-badge acc-badge-success" style={{ fontSize: "0.6875rem" }}>
                                  Active
                                </span>
                              ) : entry.status === "REVERSED" ? (
                                <span
                                  className="acc-badge acc-badge-neutral"
                                  style={{ fontSize: "0.6875rem", opacity: 0.7 }}
                                  title={entry.reversedByEntryNumber ? `Reversed by ${entry.reversedByEntryNumber}` : "Reversed"}
                                >
                                  Reversed
                                </span>
                              ) : (
                                <span className="acc-badge acc-badge-info" style={{ fontSize: "0.6875rem" }}>
                                  Reversal
                                </span>
                              )}
                            </td>
                            <td className="acc-history-td-recorder">
                              <div style={{ fontWeight: 500, color: "var(--acc-text-main)" }}>{entry.createdBy}</div>
                              <div style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)" }}>{formatVoidDate(entry.createdAt)}</div>
                            </td>
                            {canMutate && (
                              <td className="acc-align-right acc-col-action acc-history-td-action">
                                {entry.isEligibleForCorrection ? (
                                  <div className="acc-history-action-buttons">
                                    <button
                                      type="button"
                                      className="acc-btn acc-btn-sm acc-btn-primary"
                                      onClick={() => handleStartCorrection(entry)}
                                    >
                                      Correct
                                    </button>
                                    <button
                                      type="button"
                                      className="acc-btn acc-btn-sm acc-btn-outline acc-btn-danger-outline"
                                      onClick={() => handleStartReversal(entry)}
                                    >
                                      Reverse
                                    </button>
                                  </div>
                                ) : entry.status === "REVERSED" ? (
                                  <span className="acc-history-status-subtext">
                                    {entry.reversedByEntryNumber ? `Reversed by ${entry.reversedByEntryNumber}` : "Reversed"}
                                  </span>
                                ) : entry.status === "REVERSAL" ? (
                                  <span className="acc-history-status-subtext">
                                    {entry.reversalOfEntryNumber ? `Reversal of ${entry.reversalOfEntryNumber}` : "Reversal entry"}
                                  </span>
                                ) : (
                                  <span className="acc-history-status-subtext">
                                    Managed via Transactions
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List (< 768px) */}
                  <div className="acc-history-card-list">
                    {historyItems.map((entry) => (
                      <div key={`card-${entry.lineId}`} className="acc-history-card">
                        <div className="acc-history-card-top">
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span className="acc-history-card-entry">{entry.entryNumber}</span>
                            <span className="acc-badge acc-badge-neutral" style={{ fontSize: "0.625rem" }}>
                              {entry.displayType}
                            </span>
                            {entry.status === "ACTIVE" ? (
                              <span className="acc-badge acc-badge-success" style={{ fontSize: "0.625rem" }}>Active</span>
                            ) : entry.status === "REVERSED" ? (
                              <span className="acc-badge acc-badge-neutral" style={{ fontSize: "0.625rem", opacity: 0.7 }}>Reversed</span>
                            ) : (
                              <span className="acc-badge acc-badge-info" style={{ fontSize: "0.625rem" }}>Reversal</span>
                            )}
                          </div>
                          <span className="acc-history-card-date">{entry.entryDate}</span>
                        </div>

                        <div className="acc-history-card-body">
                          <div className="acc-history-card-desc">
                            {entry.description || "General ledger movement"}
                          </div>
                          <div className="acc-history-card-counterpart">
                            Counterpart: <strong>{entry.counterpartAccount}</strong>
                          </div>
                        </div>

                        <div className="acc-history-card-row">
                          <div className="acc-history-card-field">
                            <span className="acc-history-card-field-label">Amount</span>
                            <span
                              className={`acc-history-card-amount tabular-nums ${
                                entry.direction === "INFLOW" ? "acc-direction-inflow" : "acc-direction-outflow"
                              }`}
                            >
                              {entry.direction === "INFLOW" ? "+" : "-"}
                              {formatMoney(entry.amountMinor, activeWorkspace?.currency)}
                            </span>
                          </div>
                          <div className="acc-history-card-field" style={{ textAlign: "right" }}>
                            <span className="acc-history-card-field-label">Recorded By</span>
                            <span className="acc-history-card-field-value">{entry.createdBy}</span>
                            <span className="acc-history-card-date" style={{ display: "block" }}>{formatVoidDate(entry.createdAt)}</span>
                          </div>
                        </div>

                        {canMutate && (
                          <div className="acc-history-card-footer">
                            {entry.isEligibleForCorrection ? (
                              <div className="acc-history-card-actions">
                                <button
                                  type="button"
                                  className="acc-btn acc-btn-sm acc-btn-primary"
                                  style={{ flex: 1, minHeight: "36px" }}
                                  onClick={() => handleStartCorrection(entry)}
                                >
                                  Correct
                                </button>
                                <button
                                  type="button"
                                  className="acc-btn acc-btn-sm acc-btn-outline acc-btn-danger-outline"
                                  style={{ flex: 1, minHeight: "36px" }}
                                  onClick={() => handleStartReversal(entry)}
                                >
                                  Reverse
                                </button>
                              </div>
                            ) : (
                              <span className="acc-history-status-subtext" style={{ textAlign: "center", width: "100%", display: "block" }}>
                                {entry.status === "REVERSED"
                                  ? (entry.reversedByEntryNumber ? `Reversed by ${entry.reversedByEntryNumber}` : "Reversed")
                                  : entry.status === "REVERSAL"
                                  ? (entry.reversalOfEntryNumber ? `Reversal of ${entry.reversalOfEntryNumber}` : "Reversal entry")
                                  : "Managed via Transactions"}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="acc-history-footer">
              <button
                type="button"
                className="acc-btn acc-btn-outline"
                onClick={() => setHistoryModalOpen(false)}
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Correct Entry Modal */}
      {correctingEntry && selectedHistoryAccount && (
        <div className="acc-modal-backdrop acc-modal-backdrop-elevated" onClick={() => setCorrectingEntry(null)}>
          <div
            className="acc-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "520px" }}
          >
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Correct Funding Entry</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setCorrectingEntry(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmCorrection}>
              <div className="acc-preview-box">
                <div className="acc-preview-title">Original Entry to Correct</div>
                <div className="acc-preview-row">
                  <span>Entry:</span>
                  <span className="tabular-nums font-bold">
                    {correctingEntry.entryNumber} ({correctingEntry.displayType})
                  </span>
                </div>
                <div className="acc-preview-row">
                  <span>Current Account:</span>
                  <span className="font-bold">
                    {selectedHistoryAccount.name} ({selectedHistoryAccount.code})
                  </span>
                </div>
                <div className="acc-preview-row">
                  <span>Original Amount:</span>
                  <span className="tabular-nums font-bold">
                    {formatMoney(correctingEntry.amountMinor, activeWorkspace?.currency)}
                  </span>
                </div>
                <div className="acc-preview-row">
                  <span>Date:</span>
                  <span>{correctingEntry.entryDate}</span>
                </div>
              </div>

              {correctionError && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {correctionError}
                </div>
              )}

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="correct-amount-input">
                  Correct Amount (₹) *
                </label>
                <FormattedMoneyInput
                  id="correct-amount-input"
                  required
                  className="acc-form-input acc-amount-hero-input tabular-nums"
                  placeholder="0.00"
                  value={correctAmountStr}
                  onChange={(e) => setCorrectAmountStr(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="correct-dest-account">
                  Correct Destination Account *
                </label>
                <select
                  id="correct-dest-account"
                  required
                  className="acc-form-select"
                  value={correctTargetAccountId}
                  onChange={(e) => setCorrectTargetAccountId(e.target.value)}
                >
                  {paymentAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <small style={{ color: "var(--acc-text-muted)", fontSize: "0.6875rem", display: "block", marginTop: "0.25rem" }}>
                  If the money was mistakenly deposited into the wrong account, select the correct account here.
                </small>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="correct-reason-input">
                  Correction Reason *
                </label>
                <input
                  id="correct-reason-input"
                  type="text"
                  required
                  className="acc-form-input"
                  placeholder="e.g. Correcting typo in initial funding amount"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                />
              </div>

              {/* Live Proposed Effects Preview */}
              {(() => {
                const newAmt = Math.round((parseFloat(correctAmountStr) || 0) * 100);
                const target = accounts.find((a) => a.id === correctTargetAccountId) || selectedHistoryAccount;
                const isDifferentAccount = target.id !== selectedHistoryAccount.id;

                return (
                  <div className="acc-preview-box">
                    <div className="acc-preview-title">Proposed Balance Effects</div>
                    {isDifferentAccount ? (
                      <>
                        <div className="acc-preview-row">
                          <span>{selectedHistoryAccount.name}:</span>
                          <span className="tabular-nums acc-direction-outflow">
                            -{formatMoney(correctingEntry.amountMinor, activeWorkspace?.currency)} (reversal)
                          </span>
                        </div>
                        <div className="acc-preview-row">
                          <span>{target.name}:</span>
                          <span className="tabular-nums acc-direction-inflow">
                            +{formatMoney(newAmt, activeWorkspace?.currency)} (replacement)
                          </span>
                        </div>
                        <div className="acc-preview-row">
                          <span>Owner Equity:</span>
                          <span className="tabular-nums">
                            Net adjustment of{" "}
                            {formatMoney(Math.abs(newAmt - correctingEntry.amountMinor), activeWorkspace?.currency)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="acc-preview-row">
                          <span>{selectedHistoryAccount.name}:</span>
                          <span className="tabular-nums font-bold">
                            {formatMoney(
                              selectedHistoryAccount.current_balance_minor + (newAmt - correctingEntry.amountMinor),
                              activeWorkspace?.currency
                            )}
                          </span>
                        </div>
                        <div className="acc-preview-row">
                          <span>Net Adjustment:</span>
                          <span
                            className={`tabular-nums ${
                              newAmt >= correctingEntry.amountMinor
                                ? "acc-direction-inflow"
                                : "acc-direction-outflow"
                            }`}
                          >
                            {newAmt >= correctingEntry.amountMinor ? "+" : "-"}
                            {formatMoney(
                              Math.abs(newAmt - correctingEntry.amountMinor),
                              activeWorkspace?.currency
                            )}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setCorrectingEntry(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submittingCorrection}
                >
                  {submittingCorrection ? "Posting Correction..." : "Confirm Correction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reverse Entry Modal */}
      {reversingEntry && selectedHistoryAccount && (
        <div className="acc-modal-backdrop acc-modal-backdrop-elevated" onClick={() => setReversingEntry(null)}>
          <div
            className="acc-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "480px" }}
          >
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Reverse this entry?</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setReversingEntry(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.875rem", color: "var(--acc-text-main)", marginBottom: "1rem" }}>
              This will undo this entry’s effect on the account balance. The original record will remain in history.
            </p>

            <div className="acc-preview-box" style={{ marginBottom: "1.25rem" }}>
              <div className="acc-preview-row">
                <span>Account:</span>
                <span className="font-bold">{selectedHistoryAccount.name} ({selectedHistoryAccount.code})</span>
              </div>
              <div className="acc-preview-row">
                <span>Amount:</span>
                <span className="tabular-nums font-bold">
                  {formatMoney(reversingEntry.amountMinor, activeWorkspace?.currency)}
                </span>
              </div>
              <div className="acc-preview-row">
                <span>Date:</span>
                <span>{reversingEntry.entryDate}</span>
              </div>
              <div className="acc-preview-row">
                <span>Entry Number:</span>
                <span className="tabular-nums">{reversingEntry.entryNumber}</span>
              </div>
            </div>

            {reversalError && (
              <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                {reversalError}
              </div>
            )}

            <form onSubmit={handleConfirmReversal}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="reversal-reason-input">
                  Reason (Optional)
                </label>
                <input
                  id="reversal-reason-input"
                  type="text"
                  className="acc-form-input"
                  placeholder="Reason for reversal (optional)"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setReversingEntry(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{
                    flex: 1.5,
                    backgroundColor: "var(--acc-danger, #EF4444)",
                    borderColor: "var(--acc-danger, #EF4444)",
                  }}
                  disabled={submittingReversal}
                >
                  {submittingReversal ? "Reversing..." : "Yes, reverse entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Attachment Lightbox Viewer Modal */}
      {viewerOpen && viewerTx && (
        <TransactionAttachmentViewerModal
          isOpen={viewerOpen}
          onClose={() => {
            setViewerOpen(false);
            setViewerTx(null);
            setViewerAttachments([]);
          }}
          transactionTitle={viewerTx.contact_name || viewerTx.notes || "Transaction"}
          transactionSubtitle={`${viewerTx.type} • ${formatMoney(viewerTx.amount_minor, activeWorkspace?.currency)} • ${viewerTx.date}`}
          attachments={viewerAttachments}
        />
      )}

      {/* Create / Edit Purchase Modal */}
      {createPurchaseOpen && (
        <CreatePurchaseModal
          isOpen={createPurchaseOpen}
          onClose={() => {
            setCreatePurchaseOpen(false);
            setEditingDraftData(null);
          }}
          onSuccess={() => {
            setCreatePurchaseOpen(false);
            setEditingDraftData(null);
            triggerRefresh();
            setFeedbackToast({ type: "success", message: "Purchase saved successfully." });
          }}
          initialDraftData={editingDraftData}
        />
      )}

      {/* Purchase Detail Modal */}
      {purchaseDetailOpen && selectedPurchaseId && (
        <PurchaseDetailModal
          isOpen={purchaseDetailOpen}
          purchaseId={selectedPurchaseId}
          onClose={() => {
            setPurchaseDetailOpen(false);
            setSelectedPurchaseId(null);
          }}
          onRefresh={() => {
            triggerRefresh();
          }}
          onEditDraft={(p) => {
            setPurchaseDetailOpen(false);
            setEditingDraftData(p);
            setCreatePurchaseOpen(true);
          }}
        />
      )}
    </div>
  );
}
