"use client";

import React, { useState } from "react";
import { AccountingProvider, useAccounting } from "./AccountingContext";
import FastTransactionModal from "./FastTransactionModal";
import AccountingOverview from "./AccountingOverview";
import TransactionsView from "./TransactionsView";
import PeopleView from "./PeopleView";
import SalesInvoicesView from "./SalesInvoicesView";
import MoreView, { MoreTool } from "./MoreView";
import ReportsView from "./ReportsView";
import SettingsView from "./SettingsView";
import CategoriesView from "./CategoriesView";
import ProductsView from "./ProductsView";
import "./accounting.css";

export type AccountingTab =
  | "accounting-overview"
  | "accounting-home"
  | "accounting-transactions"
  | "accounting-people"
  | "accounting-sales-invoices"
  | "accounting-invoices"
  | "accounting-products"
  | "accounting-categories"
  | "accounting-accounts-transfers"
  | "accounting-more"
  | "accounting-budgets"
  | "accounting-loans"
  | "accounting-recurring"
  | "accounting-reports"
  | "accounting-reminders"
  | "accounting-settings";

interface AccountingAppProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onReturnToDashboard?: () => void;
}

function AccountingMainContent({ currentTab, onSelectTab, onReturnToDashboard }: AccountingAppProps) {
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  // Map backward-compatible tabs to the right views and initial subtabs
  const renderActiveView = () => {
    switch (currentTab) {
      case "accounting-transactions":
        return <TransactionsView initialSubtab="TRANSACTIONS" />;
      case "accounting-accounts-transfers":
        return <TransactionsView initialSubtab="BALANCES" />;
      case "accounting-people":
        return <PeopleView />;
      case "accounting-sales-invoices":
      case "accounting-invoices":
        return <SalesInvoicesView />;
      case "accounting-products":
        return <ProductsView />;
      case "accounting-categories":
        return <CategoriesView />;
      case "accounting-reports":
        return <ReportsView />;
      case "accounting-more":
        return <MoreView initialTool="BUDGETS" />;
      case "accounting-budgets":
        return <MoreView initialTool="BUDGETS" />;
      case "accounting-loans":
        return <MoreView initialTool="LOANS" />;
      case "accounting-recurring":
        return <MoreView initialTool="RECURRING" />;
      case "accounting-reminders":
        return <MoreView initialTool="REMINDERS" />;
      case "accounting-settings":
        return <SettingsView />;
      case "accounting-home":
      case "accounting-overview":
      default:
        return <AccountingOverview onNavigateTab={onSelectTab} />;
    }
  };

  const isHomeActive = currentTab === "accounting-overview" || currentTab === "accounting-home";
  const isTransactionsActive =
    currentTab === "accounting-transactions" || currentTab === "accounting-accounts-transfers";
  const isPeopleActive = currentTab === "accounting-people";
  const isReportsActive = currentTab === "accounting-reports";
  const isMoreActive = [
    "accounting-more",
    "accounting-budgets",
    "accounting-loans",
    "accounting-recurring",
    "accounting-reminders",
  ].includes(currentTab);

  return (
    <div className="accounting-root">
      {/* Active Feature View */}
      {renderActiveView()}

      {/* Global Quick Transaction Modal */}
      <FastTransactionModal />

      {/* Mobile-First Primary Navigation Bar (Home, Transactions, People, Reports, More) */}
      <nav className="acc-mobile-nav" aria-label="Accounting Mobile Navigation">
        <button
          type="button"
          className={`acc-mobile-nav-btn ${isHomeActive ? "active" : ""}`}
          onClick={() => onSelectTab("accounting-overview")}
        >
          <span style={{ fontSize: "1.25rem" }}>🏠</span>
          <span>Home</span>
        </button>
        <button
          type="button"
          className={`acc-mobile-nav-btn ${isTransactionsActive ? "active" : ""}`}
          onClick={() => onSelectTab("accounting-transactions")}
        >
          <span style={{ fontSize: "1.25rem" }}>💳</span>
          <span>Transactions</span>
        </button>
        <button
          type="button"
          className={`acc-mobile-nav-btn ${isPeopleActive ? "active" : ""}`}
          onClick={() => onSelectTab("accounting-people")}
        >
          <span style={{ fontSize: "1.25rem" }}>👥</span>
          <span>People</span>
        </button>
        <button
          type="button"
          className={`acc-mobile-nav-btn ${isReportsActive ? "active" : ""}`}
          onClick={() => onSelectTab("accounting-reports")}
        >
          <span style={{ fontSize: "1.25rem" }}>📊</span>
          <span>Reports</span>
        </button>
        <button
          type="button"
          className={`acc-mobile-nav-btn ${mobileMoreOpen || isMoreActive ? "active" : ""}`}
          onClick={() => setMobileMoreOpen(true)}
        >
          <span style={{ fontSize: "1.25rem" }}>☰</span>
          <span>More</span>
        </button>
      </nav>

      {/* Mobile "More" Sheet */}
      {mobileMoreOpen && (
        <div className="acc-modal-backdrop" onClick={() => setMobileMoreOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">More Features</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setMobileMoreOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                type="button"
                className={`acc-btn ${currentTab === "accounting-invoices" || currentTab === "accounting-sales-invoices" ? "acc-btn-primary" : "acc-btn-outline"}`}
                style={{ justifyContent: "flex-start", width: "100%" }}
                onClick={() => {
                  onSelectTab("accounting-invoices");
                  setMobileMoreOpen(false);
                }}
              >
                🧾 Invoices
              </button>
              <button
                type="button"
                className={`acc-btn ${currentTab === "accounting-products" ? "acc-btn-primary" : "acc-btn-outline"}`}
                style={{ justifyContent: "flex-start", width: "100%" }}
                onClick={() => {
                  onSelectTab("accounting-products");
                  setMobileMoreOpen(false);
                }}
              >
                📦 Products &amp; Services
              </button>
              <button
                type="button"
                className={`acc-btn ${currentTab === "accounting-categories" ? "acc-btn-primary" : "acc-btn-outline"}`}
                style={{ justifyContent: "flex-start", width: "100%" }}
                onClick={() => {
                  onSelectTab("accounting-categories");
                  setMobileMoreOpen(false);
                }}
              >
                🏷️ Categories
              </button>
              <button
                type="button"
                className={`acc-btn ${currentTab === "accounting-accounts-transfers" ? "acc-btn-primary" : "acc-btn-outline"}`}
                style={{ justifyContent: "flex-start", width: "100%" }}
                onClick={() => {
                  onSelectTab("accounting-accounts-transfers");
                  setMobileMoreOpen(false);
                }}
              >
                🏦 Account Balances & Transfers
              </button>
              <button
                type="button"
                className={`acc-btn ${currentTab === "accounting-budgets" ? "acc-btn-primary" : "acc-btn-outline"}`}
                style={{ justifyContent: "flex-start", width: "100%" }}
                onClick={() => {
                  onSelectTab("accounting-budgets");
                  setMobileMoreOpen(false);
                }}
              >
                🎯 Budgets & Planning
              </button>
              <button
                type="button"
                className={`acc-btn ${currentTab === "accounting-loans" ? "acc-btn-primary" : "acc-btn-outline"}`}
                style={{ justifyContent: "flex-start", width: "100%" }}
                onClick={() => {
                  onSelectTab("accounting-loans");
                  setMobileMoreOpen(false);
                }}
              >
                🤝 Loans & EMIs
              </button>
              <button
                type="button"
                className={`acc-btn ${currentTab === "accounting-recurring" ? "acc-btn-primary" : "acc-btn-outline"}`}
                style={{ justifyContent: "flex-start", width: "100%" }}
                onClick={() => {
                  onSelectTab("accounting-recurring");
                  setMobileMoreOpen(false);
                }}
              >
                🔁 Recurring Items
              </button>
              <button
                type="button"
                className={`acc-btn ${currentTab === "accounting-reminders" ? "acc-btn-primary" : "acc-btn-outline"}`}
                style={{ justifyContent: "flex-start", width: "100%" }}
                onClick={() => {
                  onSelectTab("accounting-reminders");
                  setMobileMoreOpen(false);
                }}
              >
                ⏰ Reminders & Alerts
              </button>
              <button
                type="button"
                className={`acc-btn ${currentTab === "accounting-settings" ? "acc-btn-primary" : "acc-btn-outline"}`}
                style={{ justifyContent: "flex-start", width: "100%" }}
                onClick={() => {
                  onSelectTab("accounting-settings");
                  setMobileMoreOpen(false);
                }}
              >
                ⚙️ Accounting Settings
              </button>

              <hr style={{ margin: "0.75rem 0", borderColor: "var(--acc-border)" }} />

              {onReturnToDashboard && (
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ width: "100%" }}
                  onClick={() => {
                    setMobileMoreOpen(false);
                    onReturnToDashboard();
                  }}
                >
                  ← Return to Leads / Connect
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountingApp(props: AccountingAppProps) {
  return (
    <AccountingProvider>
      <AccountingMainContent {...props} />
    </AccountingProvider>
  );
}
