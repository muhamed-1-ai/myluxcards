"use client";

import React, { useState, useEffect, useRef, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import {
  Wallet,
  Banknote,
  Landmark,
  Smartphone,
  ChevronDown,
  Check,
  Search,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useOptionalAccounting, FinancialAccount } from "./AccountingContext";

function defaultFormatMoney(amountMinor: number, currency: string = "INR") {
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
}

export interface PaymentAccountPickerProps {
  id?: string;
  name?: string;
  value: string; // Selected FinancialAccount.id
  onChange: (accountId: string) => void;
  accounts?: FinancialAccount[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean | string;
  className?: string;
  currency?: string;
  loading?: boolean;
  isFailed?: boolean;
  onRetry?: () => void;
  accountFilter?: (account: FinancialAccount) => boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

// Helper to determine the best semantic icon for a payment account
export function getAccountIcon(account?: FinancialAccount | null, size: number = 16) {
  if (!account) return <Wallet size={size} />;
  const sub = (account.subtype || "").toUpperCase();
  const nameLower = (account.name || "").toLowerCase();

  if (sub === "CASH" || nameLower.includes("cash") || nameLower.includes("petty")) {
    return <Banknote size={size} />;
  }
  if (
    sub === "BANK" ||
    nameLower.includes("bank") ||
    nameLower.includes("savings") ||
    nameLower.includes("current") ||
    nameLower.includes("checking")
  ) {
    return <Landmark size={size} />;
  }
  if (
    sub === "PAYMENT_PROCESSOR" ||
    nameLower.includes("upi") ||
    nameLower.includes("gpay") ||
    nameLower.includes("phonepe") ||
    nameLower.includes("paytm") ||
    nameLower.includes("razorpay") ||
    nameLower.includes("stripe")
  ) {
    return <Smartphone size={size} />;
  }
  return <Wallet size={size} />;
}

// User-friendly account subtype label
export function getAccountTypeLabel(account: FinancialAccount): string {
  const sub = (account.subtype || "").toUpperCase();
  const nameLower = (account.name || "").toLowerCase();

  if (sub === "CASH" || nameLower.includes("cash")) return "Cash in Hand";
  if (sub === "BANK" || nameLower.includes("bank")) return "Bank Account";
  if (
    sub === "PAYMENT_PROCESSOR" ||
    nameLower.includes("upi") ||
    nameLower.includes("wallet")
  ) {
    return "UPI / Digital Wallet";
  }
  if (account.type === "ASSET") return "Asset Account";
  return account.type || "Payment Account";
}

// Format balance with unmistakable negative detection, explicit minus sign, and zero treatment
export function formatAccountBalance(
  amountMinor: number,
  formatMoneyFn: (amountMinor: number, currency?: string) => string,
  currency: string = "INR"
) {
  // Determine sign from actual numeric value before formatting
  const isNegative = amountMinor < 0;
  const isZero = amountMinor === 0;
  const isPositive = amountMinor > 0;

  // Use application's shared currency formatter
  let formatted = formatMoneyFn(amountMinor, currency);

  // Ensure explicit unicode minus sign "−" (U+2212) on negative amounts
  if (isNegative) {
    if (formatted.startsWith("-")) {
      formatted = `−${formatted.slice(1)}`;
    } else if (formatted.startsWith("₹-")) {
      formatted = `−₹${formatted.slice(2)}`;
    } else if (!formatted.includes("−") && !formatted.includes("-")) {
      formatted = `−${formatted}`;
    }
  }

  return {
    formatted,
    isNegative,
    isZero,
    isPositive,
  };
}

export function PaymentAccountPicker({
  id,
  name,
  value,
  onChange,
  accounts: customAccounts,
  placeholder = "Select account (Cash, Bank, UPI)...",
  disabled = false,
  required = false,
  error = false,
  className = "",
  currency: customCurrency,
  loading: customLoading,
  isFailed = false,
  onRetry,
  accountFilter,
  autoFocus = false,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: PaymentAccountPickerProps) {
  const pickerUid = useId();
  const triggerId = id || `acc-picker-trigger-${pickerUid}`;
  const listboxId = `acc-picker-list-${pickerUid}`;

  const accountingContext = useOptionalAccounting();
  const contextAccounts = accountingContext?.accounts;
  const formatMoney = accountingContext?.formatMoney || defaultFormatMoney;
  const activeWorkspace = accountingContext?.activeWorkspace;
  const contextLoading = accountingContext?.loading || false;

  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);

  const isLoading = customLoading !== undefined ? customLoading : contextLoading;
  const currency = customCurrency || activeWorkspace?.currency || "INR";

  // Determine available accounts
  const rawAccounts = customAccounts || contextAccounts || [];
  const filteredAccounts = React.useMemo(() => {
    let list = rawAccounts;
    if (accountFilter) {
      list = list.filter(accountFilter);
    } else if (!customAccounts) {
      // Default to liquid accounts if none explicitly passed
      list = list.filter(
        (a) => a.type === "ASSET" && ["CASH", "BANK", "PAYMENT_PROCESSOR"].includes(a.subtype)
      );
    }
    return list;
  }, [rawAccounts, accountFilter, customAccounts]);

  // Selected account object
  const selectedAccount = React.useMemo(() => {
    if (!value) return null;
    return rawAccounts.find((a) => a.id === value) || null;
  }, [rawAccounts, value]);

  // Filter accounts when search query is entered
  const displayAccounts = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredAccounts;
    return filteredAccounts.filter((a) => {
      const nameMatch = (a.name || "").toLowerCase().includes(q);
      const codeMatch = (a.code || "").toLowerCase().includes(q);
      const typeMatch = (a.subtype || "").toLowerCase().includes(q);
      return nameMatch || codeMatch || typeMatch;
    });
  }, [filteredAccounts, searchQuery]);

  // Show search box only when account list is long enough (>= 6)
  const shouldShowSearch = filteredAccounts.length >= 6;

  // Positioning coordinates for fixed portaled popover
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    openAbove: boolean;
  }>({
    top: 0,
    left: 0,
    width: 320,
    maxHeight: 320,
    openAbove: false,
  });

  // Track client mount for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute position with viewport collision detection
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 6;
    const padding = 12;

    // Popover width matches trigger width, constrained to reasonable bounds
    const popoverWidth = Math.min(
      Math.max(rect.width, 280),
      viewportWidth - padding * 2
    );

    const estimatedPopoverHeight = Math.min(
      320,
      shouldShowSearch ? 340 : 280
    );

    // Vertical placement logic
    const spaceBelow = viewportHeight - rect.bottom - gap - padding;
    const spaceAbove = rect.top - gap - padding;

    let top: number;
    let openAbove = false;
    let availableHeight: number;

    if (spaceBelow < 200 && spaceAbove > spaceBelow) {
      // Flip ABOVE trigger
      openAbove = true;
      availableHeight = Math.min(estimatedPopoverHeight, spaceAbove);
      top = Math.max(padding, rect.top - gap - availableHeight);
    } else {
      // Place BELOW trigger
      openAbove = false;
      availableHeight = Math.min(estimatedPopoverHeight, spaceBelow);
      top = rect.bottom + gap;
    }

    // Horizontal placement with bounds clamping
    let left = rect.left;
    if (left + popoverWidth > viewportWidth - padding) {
      left = viewportWidth - padding - popoverWidth;
    }
    if (left < padding) {
      left = padding;
    }

    setCoords({
      top: Math.round(top),
      left: Math.round(left),
      width: Math.round(popoverWidth),
      maxHeight: Math.max(160, Math.round(availableHeight)),
      openAbove,
    });
  }, [shouldShowSearch]);

  // Open/Close toggle
  const handleToggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      setSearchQuery("");
      // Set initial highlighted index to selected account or first account
      const selIdx = displayAccounts.findIndex((a) => a.id === value);
      setHighlightedIndex(selIdx >= 0 ? selIdx : 0);

      // Announce open to close other active pickers
      window.dispatchEvent(
        new CustomEvent("zappit-picker-opened", { detail: { id: pickerUid } })
      );
    }
    setIsOpen(!isOpen);
  };

  // Close when another picker opens
  useEffect(() => {
    const handleOtherPicker = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      if (customEvent.detail?.id && customEvent.detail.id !== pickerUid) {
        setIsOpen(false);
      }
    };
    window.addEventListener("zappit-picker-opened", handleOtherPicker);
    return () => window.removeEventListener("zappit-picker-opened", handleOtherPicker);
  }, [pickerUid]);

  // Recalculate position on scroll or resize while open
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    window.addEventListener("scroll", updatePosition, { capture: true, passive: true });
    window.addEventListener("resize", updatePosition, { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updatePosition, { passive: true });
      window.visualViewport.addEventListener("scroll", updatePosition, { passive: true });
    }

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updatePosition);
        window.visualViewport.removeEventListener("scroll", updatePosition);
      }
    };
  }, [isOpen, updatePosition]);

  // Click outside handling
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  // Focus search input or selected option when popover opens
  useEffect(() => {
    if (isOpen) {
      if (shouldShowSearch && searchInputRef.current) {
        searchInputRef.current.focus();
      }
      // Scroll selected item into view
      setTimeout(() => {
        const selectedEl = optionsListRef.current?.querySelector(
          '[aria-selected="true"]'
        ) as HTMLElement;
        if (selectedEl) {
          selectedEl.scrollIntoView({ block: "nearest" });
        }
      }, 20);
    }
  }, [isOpen, shouldShowSearch]);

  // Select account handler
  const handleSelectAccount = (accountId: string) => {
    onChange(accountId);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        handleToggleOpen();
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (e.key === "Tab") {
      setIsOpen(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < displayAccounts.length - 1 ? prev + 1 : 0
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : displayAccounts.length - 1
      );
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      setHighlightedIndex(0);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      setHighlightedIndex(displayAccounts.length - 1);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < displayAccounts.length) {
        handleSelectAccount(displayAccounts[highlightedIndex].id);
      }
    }
  };

  // Keep highlighted option visible when navigating with arrow keys
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionsListRef.current) {
      const optionEl = optionsListRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      if (optionEl && typeof optionEl.scrollIntoView === "function") {
        optionEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Selected account balance details
  const selectedBalance = selectedAccount
    ? formatAccountBalance(selectedAccount.current_balance_minor, formatMoney, currency)
    : null;

  return (
    <div className={`acc-picker-container ${className}`} ref={containerRef}>
      {/* Hidden native input for standard form serialization & validation */}
      <input
        type="hidden"
        id={id}
        name={name}
        value={value}
        required={required}
        aria-hidden="true"
      />

      {/* Main Accessible Trigger Button */}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel || (selectedAccount ? `Selected account: ${selectedAccount.name}` : placeholder)}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        autoFocus={autoFocus}
        onClick={handleToggleOpen}
        onKeyDown={handleKeyDown}
        className={`acc-picker-trigger ${isOpen ? "open" : ""} ${error ? "error" : ""} ${
          selectedAccount ? "has-selected" : ""
        }`}
      >
        <div className="acc-picker-trigger-left">
          <div
            className={`acc-picker-icon-box ${selectedAccount ? "active" : ""}`}
            aria-hidden="true"
          >
            {getAccountIcon(selectedAccount)}
          </div>
          <div className="acc-picker-trigger-info">
            {selectedAccount ? (
              <>
                <span className="acc-picker-account-name">{selectedAccount.name}</span>
                <span className="acc-picker-account-sub">
                  {getAccountTypeLabel(selectedAccount)}
                </span>
              </>
            ) : (
              <span className="acc-picker-placeholder">{placeholder}</span>
            )}
          </div>
        </div>

        <div className="acc-picker-trigger-right">
          {selectedAccount && selectedBalance && (
            <div className="acc-picker-balance-container">
              <span
                className={`acc-picker-balance-val ${
                  selectedBalance.isNegative
                    ? "negative"
                    : selectedBalance.isZero
                    ? "zero"
                    : ""
                }`}
                title={`Balance: ${selectedBalance.formatted}`}
              >
                {selectedBalance.formatted}
              </span>
              {selectedBalance.isNegative && (
                <span className="acc-picker-badge-negative">
                  <AlertCircle size={9} aria-hidden="true" />
                  <span>Negative balance</span>
                </span>
              )}
              {selectedBalance.isZero && (
                <span className="acc-picker-badge-zero">Zero balance</span>
              )}
            </div>
          )}

          <ChevronDown
            size={16}
            className={`acc-picker-chevron ${isOpen ? "open" : ""}`}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Portaled Dropdown Menu */}
      {mounted &&
        isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            className="acc-picker-popover"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: `${coords.maxHeight}px`,
            }}
            onKeyDown={handleKeyDown}
          >
            {/* Optional search header when account list is long */}
            {shouldShowSearch && (
              <div className="acc-picker-search-bar">
                <Search size={14} className="text-muted" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="acc-picker-search-input"
                  placeholder="Search payment accounts..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  aria-label="Search payment accounts"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="acc-picker-search-clear"
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Listbox Container */}
            <div
              ref={optionsListRef}
              id={listboxId}
              role="listbox"
              tabIndex={-1}
              aria-label="Payment Accounts"
              className="acc-picker-list"
            >
              {isLoading ? (
                <div className="acc-picker-state">
                  <Loader2 className="animate-spin text-muted" size={18} />
                  <span>Loading payment accounts...</span>
                </div>
              ) : isFailed ? (
                <div className="acc-picker-state error">
                  <AlertCircle size={18} />
                  <span>Failed to load accounts</span>
                  {onRetry && (
                    <button
                      type="button"
                      className="acc-picker-retry-btn"
                      onClick={onRetry}
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : displayAccounts.length === 0 ? (
                <div className="acc-picker-state">
                  {searchQuery ? (
                    <span>No accounts match &ldquo;{searchQuery}&rdquo;</span>
                  ) : (
                    <span>No payment accounts available</span>
                  )}
                </div>
              ) : (
                displayAccounts.map((account, index) => {
                  const isSelected = account.id === value;
                  const isHighlighted = index === highlightedIndex;
                  const balance = formatAccountBalance(
                    account.current_balance_minor,
                    formatMoney,
                    currency
                  );

                  return (
                    <div
                      key={account.id}
                      role="option"
                      id={`acc-opt-${account.id}`}
                      aria-selected={isSelected}
                      onClick={() => handleSelectAccount(account.id)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`acc-picker-option ${
                        isSelected ? "selected" : ""
                      } ${isHighlighted ? "highlighted" : ""}`}
                    >
                      <div className="acc-picker-option-left">
                        <div
                          className={`acc-picker-icon-box ${
                            isSelected ? "active" : ""
                          }`}
                          aria-hidden="true"
                        >
                          {getAccountIcon(account)}
                        </div>
                        <div className="acc-picker-option-info">
                          <span className="acc-picker-account-name">
                            {account.name}
                          </span>
                          <span className="acc-picker-account-sub">
                            {getAccountTypeLabel(account)}
                          </span>
                        </div>
                      </div>

                      <div className="acc-picker-option-right">
                        <div className="acc-picker-balance-container">
                          <span
                            className={`acc-picker-balance-val ${
                              balance.isNegative
                                ? "negative"
                                : balance.isZero
                                ? "zero"
                                : ""
                            }`}
                          >
                            {balance.formatted}
                          </span>
                          {balance.isNegative && (
                            <span className="acc-picker-badge-negative">
                              <AlertCircle size={9} aria-hidden="true" />
                              <span>Negative balance</span>
                            </span>
                          )}
                          {balance.isZero && (
                            <span className="acc-picker-badge-zero">
                              Zero balance
                            </span>
                          )}
                        </div>

                        {isSelected ? (
                          <Check
                            size={16}
                            className="acc-picker-check"
                            aria-hidden="true"
                          />
                        ) : (
                          <div
                            className="acc-picker-check-placeholder"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default PaymentAccountPicker;
