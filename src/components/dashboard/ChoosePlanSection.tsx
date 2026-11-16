"use client";

import React, { useState, useEffect } from "react";
import { Check, Shield, ArrowRight, Sparkles, X, Loader2, AlertCircle, CreditCard, Lock, RefreshCw, Settings } from "lucide-react";
import { PLAN_CATALOG, PlanId, PlanDefinition } from "@/lib/billingPlans";

interface ChoosePlanSectionProps {
  currentUser: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
    featurePermissions?: Record<string, boolean>;
  } | null;
  theme?: "light" | "dark";
  onPlanActivated?: (updatedPermissions: Record<string, boolean>) => void;
  onOpenSettings?: () => void;
}

export default function ChoosePlanSection({
  currentUser,
  theme = "dark",
  onPlanActivated,
  onOpenSettings,
}: ChoosePlanSectionProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"form" | "confirming" | "success" | "error">("form");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Checkout form fields
  const [customerName, setCustomerName] = useState(currentUser?.name || "");
  const [customerEmail, setCustomerEmail] = useState(currentUser?.email || "");
  const [customerPhone, setCustomerPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "Card" | "Net Banking" | "Cash on Delivery">("UPI");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser?.name && !customerName) setCustomerName(currentUser.name);
    if (currentUser?.email && !customerEmail) setCustomerEmail(currentUser.email);
  }, [currentUser]);

  const openCheckout = (planId: PlanId) => {
    setSelectedPlanId(planId);
    setCheckoutStep("form");
    setCheckoutError(null);
    setModalOpen(true);
  };

  const closeCheckout = () => {
    if (checkoutStep === "confirming") return; // do not close during confirmation
    setModalOpen(false);
    setCheckoutStep("form");
    setCheckoutError(null);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;
    setSubmitting(true);
    setCheckoutError(null);

    const plan = PLAN_CATALOG[selectedPlanId];

    try {
      // 1. Submit order to checkout endpoint
      const payload = {
        paymentMethod,
        customer: {
          name: customerName.trim() || currentUser?.name || "Customer",
          email: customerEmail.trim() || currentUser?.email || "",
          phone: customerPhone.trim(),
          jobTitle: jobTitle.trim() || undefined,
        },
        shippingAddress: {
          jobTitle: jobTitle.trim() || undefined,
          line1: addressLine1.trim(),
          city: city.trim(),
          state: stateName.trim(),
          postalCode: postalCode.trim(),
          country: "India",
        },
        items: [
          {
            id: plan.id,
            quantity: 1,
            details: plan.fullName,
          },
        ],
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const orderData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(orderData.message || "Failed to initiate order. Please verify your details.");
      }

      const { orderId, totalMinor, currency, paymentCheckout } = orderData;

      // 2. Online Razorpay payment flow
      if (paymentCheckout?.provider === "RAZORPAY") {
        // Load Razorpay checkout script if not present
        if (!(window as any).Razorpay) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector('script[data-razorpay-checkout]');
            if (existing) {
              existing.addEventListener("load", () => resolve(), { once: true });
              existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay payment window.")), { once: true });
              return;
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.async = true;
            script.dataset.razorpayCheckout = "true";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load secure payment script."));
            document.head.appendChild(script);
          });
        }

        if (!(window as any).Razorpay) {
          throw new Error("Razorpay checkout is unavailable. Please try again or contact support.");
        }

        let paymentFinished = false;
        await new Promise<void>((resolve, reject) => {
          const rzp = new (window as any).Razorpay({
            key: paymentCheckout.keyId,
            order_id: paymentCheckout.providerOrderId,
            amount: totalMinor,
            currency: currency || "INR",
            name: "Zappit",
            description: `${plan.fullName} Activation (Order ${orderData.orderNumber})`,
            prefill: {
              name: customerName,
              email: customerEmail,
              contact: customerPhone,
            },
            theme: { color: "#0066FF" },
            modal: {
              ondismiss: () => {
                if (!paymentFinished) {
                  reject(new Error("Payment was cancelled. Both plans remain available to choose."));
                }
              },
            },
            handler: async (response: any) => {
              paymentFinished = true;
              setCheckoutStep("confirming");
              try {
                // 3. Confirm payment on server and activate entitlement
                const verifyRes = await fetch("/api/billing/confirm", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    orderId,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                  }),
                });
                const verifyData = await verifyRes.json().catch(() => ({}));
                if (!verifyRes.ok || !verifyData.ok) {
                  throw new Error(verifyData.message || "Payment verification failed on server.");
                }

                setCheckoutStep("success");
                if (onPlanActivated && verifyData.featurePermissions) {
                  onPlanActivated(verifyData.featurePermissions);
                } else {
                  // Fallback: hard reload to fetch fresh session permissions
                  window.location.reload();
                }
                resolve();
              } catch (err: any) {
                reject(err);
              }
            },
          });

          rzp.on("payment.failed", (resp: any) => {
            reject(new Error(resp?.error?.description || "Payment failed. Both plans remain available."));
          });

          rzp.open();
        });
      } else {
        // Cash on delivery or offline testing flow
        setCheckoutStep("confirming");
        const verifyRes = await fetch("/api/billing/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const verifyData = await verifyRes.json().catch(() => ({}));
        if (!verifyRes.ok || !verifyData.ok) {
          throw new Error(verifyData.message || "Order registered. Entitlement will activate once payment is confirmed upon delivery.");
        }

        setCheckoutStep("success");
        if (onPlanActivated && verifyData.featurePermissions) {
          onPlanActivated(verifyData.featurePermissions);
        } else {
          window.location.reload();
        }
      }
    } catch (err: any) {
      console.error("[ChoosePlanSection] Checkout error:", err);
      setCheckoutStep("error");
      setCheckoutError(err?.message || "Checkout failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isDark = theme === "dark";
  const activePlan = selectedPlanId ? PLAN_CATALOG[selectedPlanId] : null;

  return (
    <div className={`choose-plan-root w-full max-w-5xl mx-auto px-4 py-8 md:py-12 ${isDark ? "theme-dark" : "theme-light"}`}>
      {/* Header section */}
      <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3.5 bg-blue-500/10 text-blue-500 border border-blue-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Activate Your Access</span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3 text-[var(--plan-heading)]">
          Choose your Zappit plan
        </h1>
        <p className="text-sm sm:text-base leading-relaxed text-[var(--plan-subtext)]">
          Select a transparent plan below to unlock your digital card profile and workspace immediately. No hidden charges or automatic lock-in.
        </p>
      </div>

      {/* Plan Cards Grid: side-by-side on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-stretch max-w-4xl mx-auto">
        {/* CARD 1: Lite Plan */}
        {(() => {
          const plan = PLAN_CATALOG["plan-lite"];
          return (
            <div
              key={plan.id}
              className={`plan-card plan-card-lite relative flex flex-col justify-between rounded-2xl p-6 sm:p-8 transition-all duration-300 ${isDark
                  ? "bg-[#0B0F19] border border-blue-500/20 hover:border-blue-400/40 text-white"
                  : "bg-white border border-slate-200 hover:border-blue-300 text-slate-900"
                }`}
              style={{
                boxShadow: isDark
                  ? "0 18px 40px -10px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 102, 255, 0.08)"
                  : "0 14px 34px -8px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-500">
                    {plan.kicker}
                  </span>
                </div>

                <h3 className="text-2xl font-bold tracking-tight mb-2">
                  {plan.name}
                </h3>

                <p className={`text-xs sm:text-sm leading-relaxed mb-6 min-h-[38px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Physical NFC smart business card paired with complete digital identity software for instant sharing.
                </p>

                {/* Price block */}
                <div className="py-4 border-y border-[var(--plan-divider)] mb-6">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                      ₹{plan.price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs font-semibold text-[var(--plan-subtext)]">
                      {plan.billingPeriod}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--plan-subtext)] mt-1.5 leading-normal">
                    {plan.renewalDetail}
                  </p>
                </div>

                {/* Features List (Always visible by default) */}
                <div className="mb-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--plan-subtext)] block mb-3.5">
                    Included with Lite
                  </span>
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm">
                        <div className="w-4 h-4 rounded-full bg-blue-500/15 text-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span className="leading-snug text-[var(--plan-feature-text)]">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 mt-auto">
                <button
                  type="button"
                  onClick={() => openCheckout("plan-lite")}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${isDark
                      ? "bg-slate-800 hover:bg-slate-700 text-white border border-blue-500/30 hover:border-blue-400"
                      : "bg-white hover:bg-blue-50 text-blue-600 border border-blue-600 shadow-sm"
                    }`}
                >
                  <span>{plan.buttonLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* CARD 2: Pro Plan (Elevated with Full CRM Workspace Badge) */}
        {(() => {
          const plan = PLAN_CATALOG["plan-pro"];
          return (
            <div
              key={plan.id}
              className={`plan-card plan-card-pro relative flex flex-col justify-between rounded-2xl p-6 sm:p-8 transition-all duration-300 ${isDark
                  ? "bg-[#091122] border-2 border-blue-500 text-white shadow-blue-900/30"
                  : "bg-white border-2 border-blue-600 text-slate-900 shadow-blue-500/15"
                }`}
              style={{
                boxShadow: isDark
                  ? "0 22px 50px -10px rgba(0, 102, 255, 0.28), 0 0 0 1px rgba(0, 102, 255, 0.4)"
                  : "0 18px 42px -10px rgba(0, 102, 255, 0.2), 0 2px 8px rgba(0, 102, 255, 0.08)",
              }}
            >
              {/* Highlight Badge */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-600 text-white shadow-md flex items-center gap-1.5 whitespace-nowrap">
                  <Sparkles className="w-3 h-3" />
                  <span>{plan.badge}</span>
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-2 mt-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                    {plan.kicker}
                  </span>
                </div>

                <h3 className="text-2xl font-bold tracking-tight mb-2">
                  {plan.name}
                </h3>

                <p className={`text-xs sm:text-sm leading-relaxed mb-6 min-h-[38px] ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  Everything in Lite, plus complete Lead Management CRM to capture, track, and close deals effortlessly.
                </p>

                {/* Price block */}
                <div className="py-4 border-y border-[var(--plan-divider)] mb-6">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-blue-500">
                      ₹{plan.price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs font-semibold text-[var(--plan-subtext)]">
                      {plan.billingPeriod}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--plan-subtext)] mt-1.5 leading-normal">
                    {plan.renewalDetail}
                  </p>
                </div>

                {/* Features List (Always visible by default) */}
                <div className="mb-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--plan-subtext)] block mb-3.5">
                    Everything in Lite, plus:
                  </span>
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm">
                        <div className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span className="leading-snug text-[var(--plan-feature-text)]">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 mt-auto">
                <button
                  type="button"
                  onClick={() => openCheckout("plan-pro")}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{plan.buttonLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Account Settings footer trigger */}
      <div className="mt-12 text-center">
        <p className="text-xs sm:text-sm text-[var(--plan-subtext)] inline-flex items-center gap-2">
          <span>Need to update password or account credentials?</span>
          <button
            type="button"
            onClick={onOpenSettings}
            className="font-bold text-sky-400 hover:text-sky-300 underline inline-flex items-center gap-1 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Open Account Settings</span>
          </button>
        </p>
      </div>

      {/* CHECKOUT MODAL */}
      {modalOpen && activePlan && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-checkout-title"
        >
          <div
            className={`w-full max-w-lg rounded-2xl p-6 sm:p-8 shadow-2xl relative border ${isDark
                ? "bg-[#0F172A] border-slate-700 text-white"
                : "bg-white border-slate-200 text-slate-900"
              }`}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={closeCheckout}
              disabled={checkoutStep === "confirming"}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer disabled:opacity-40"
              aria-label="Close checkout"
            >
              <X className="w-5 h-5" />
            </button>

            {/* CONFIRMING STEP */}
            {checkoutStep === "confirming" ? (
              <div className="py-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-5 animate-spin">
                  <RefreshCw className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">Confirming your payment…</h3>
                <p className="text-sm text-slate-400 max-w-sm leading-relaxed mb-4">
                  Please hold on while our server verifies your payment signature and activates your {activePlan.fullName} entitlements.
                </p>
                <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Secure cryptographic verification in progress</span>
                </div>
              </div>
            ) : checkoutStep === "success" ? (
              <div className="py-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-5">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-emerald-400">Payment Confirmed!</h3>
                <p className="text-sm text-slate-400 max-w-sm leading-relaxed mb-6">
                  Your {activePlan.fullName} plan has been activated successfully. Opening your dashboard…
                </p>
              </div>
            ) : (
              /* FORM & ERROR STEPS */
              <div>
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">
                    <Shield className="w-4 h-4" />
                    <span>Secure Plan Activation</span>
                  </div>
                  <h2 id="plan-checkout-title" className="text-xl sm:text-2xl font-bold">
                    Checkout {activePlan.fullName}
                  </h2>
                  <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-slate-700/50">
                    <span className="text-xs text-slate-400">Total Due Today:</span>
                    <span className="text-xl font-extrabold text-blue-400">
                      ₹{activePlan.price.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {checkoutError && (
                  <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 leading-relaxed">
                      <p className="font-semibold mb-0.5">Checkout Notice</p>
                      <p>{checkoutError}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  {/* Customer details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full h-10 px-3 rounded-lg text-xs bg-slate-800/80 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Contact Phone *
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="w-full h-10 px-3 rounded-lg text-xs bg-slate-800/80 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Registered Email
                    </label>
                    <input
                      type="email"
                      readOnly
                      value={customerEmail}
                      className="w-full h-10 px-3 rounded-lg text-xs bg-slate-800/40 border border-slate-800 text-slate-400 cursor-not-allowed"
                    />
                  </div>

                  {/* Shipping address for NFC card delivery */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Delivery Address (For Physical Smart Card) *
                    </label>
                    <input
                      type="text"
                      required
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder="Flat, building, street address"
                      className="w-full h-10 px-3 rounded-lg text-xs bg-slate-800/80 border border-slate-700 text-white focus:outline-none focus:border-blue-500 mb-2"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City"
                        className="h-10 px-3 rounded-lg text-xs bg-slate-800/80 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        required
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        placeholder="State"
                        className="h-10 px-3 rounded-lg text-xs bg-slate-800/80 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        required
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="PIN Code"
                        className="h-10 px-3 rounded-lg text-xs bg-slate-800/80 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Payment method */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("UPI")}
                        className={`h-11 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border ${paymentMethod === "UPI"
                            ? "bg-blue-600/20 border-blue-500 text-blue-400"
                            : "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800"
                          }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>UPI / Card / Net Banking</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("Cash on Delivery")}
                        className={`h-11 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border ${paymentMethod === "Cash on Delivery"
                            ? "bg-blue-600/20 border-blue-500 text-blue-400"
                            : "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800"
                          }`}
                      >
                        <span>Cash on Delivery</span>
                      </button>
                    </div>
                  </div>

                  {/* Submit CTA */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-lg shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Initiating Checkout…</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>Pay &amp; Activate {activePlan.name} · ₹{activePlan.price.toLocaleString("en-IN")}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}