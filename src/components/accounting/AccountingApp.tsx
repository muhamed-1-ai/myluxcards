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
  | "accounting-purchases"
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
  // Map backward-compatible tabs to the right views and initial subtabs
  const renderActiveView = () => {
    switch (currentTab) {
      case "accounting-transactions":
        return <TransactionsView initialSubtab="TRANSACTIONS" />;
      case "accounting-purchases":
        return <TransactionsView initialSubtab="PURCHASES" />;
      case "accounting-accounts-transfers":
        return <TransactionsView initialSubtab="BALANCES" />;
      case "accounting-voided":
        return <TransactionsView initialSubtab="VOIDED" />;
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

  return (
    <div className="accounting-root">
      {/* Active Feature View */}
      {renderActiveView()}

      {/* Global Quick Transaction Modal */}
      <FastTransactionModal />
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
