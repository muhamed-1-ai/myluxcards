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
    <div className={`choose-plan-root ${isDark ? "theme-dark" : "theme-light"}`}>
      {/* Header section */}
      <div className="choose-plan-header">
        <div className="choose-plan-eyebrow">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Activate Your Access</span>
        </div>
        <h1 className="choose-plan-title">
          Choose your Zappit plan
        </h1>
        <p className="choose-plan-desc">
          Select a transparent plan below to unlock your digital card profile and workspace immediately. No hidden charges or automatic lock-in.
        </p>
      </div>

      {/* Plan Cards Grid: side-by-side on desktop, stacked on mobile */}
      <div className="choose-plan-grid grid grid-cols-1 md:grid-cols-2">
        {/* CARD 1: Lite Plan */}
        {(() => {
          const plan = PLAN_CATALOG["plan-lite"];
          return (
            <div
              key={plan.id}
              className="choose-plan-card plan-lite-card plan-card shadow-xl"
            >
              <div>
                <div className="choose-plan-badge-wrapper">
                  <span className="choose-plan-kicker">Standard Bundle</span>
                </div>

                <h3 className="choose-plan-name">
                  {plan.name}
                </h3>

                <p className="choose-plan-card-desc">
                  Physical NFC smart business card paired with our complete digital identity software for instant contact sharing.
                </p>

                {/* Price block */}
                <div className="choose-plan-price-block">
                  <div className="choose-plan-price-row">
                    <span className="choose-plan-currency">₹</span>
                    <span className="choose-plan-amount">
                      {plan.price.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="choose-plan-billing-type">One-time hardware purchase</div>
                  <p className="choose-plan-billing-detail">
                    Includes 1-year digital profile hosting. Annual renewal at ₹499/year. No app required.
                  </p>
                </div>

                <div className="choose-plan-divider"></div>

                {/* Features List */}
                <div className="choose-plan-features-block">
                  <span className="choose-plan-features-label">
                    Included Features
                  </span>
                  <ul className="choose-plan-feature-list">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="choose-plan-feature-item">
                        <Check className="choose-plan-check-icon" strokeWidth={2.5} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="choose-plan-card-footer">
                <button
                  type="button"
                  onClick={() => openCheckout("plan-lite")}
                  className="choose-plan-pill-btn"
                >
                  {plan.buttonLabel}
                </button>
              </div>
            </div>
          );
        })()}

        {/* CARD 2: Pro Plan */}
        {(() => {
          const plan = PLAN_CATALOG["plan-pro"];
          return (
            <div
              key={plan.id}
              className="choose-plan-card plan-pro-card plan-card shadow-2xl"
            >
              <div>
                <div className="choose-plan-badge-wrapper">
                  <span className="choose-plan-badge">
                    {plan.badge || "Includes Full CRM Workspace"}
                  </span>
                </div>

                <h3 className="choose-plan-name">
                  {plan.name}
                </h3>

                <p className="choose-plan-card-desc">
                  Everything in the Standard bundle, plus our complete Lead Management mini-CRM to capture, track, and close deals.
                </p>

                {/* Price block */}
                <div className="choose-plan-price-block">
                  <div className="choose-plan-price-row">
                    <span className="choose-plan-currency">₹</span>
                    <span className="choose-plan-amount">
                      {plan.price.toLocaleString("en-IN")}
                    </span>
                    <span className="choose-plan-period">/year</span>
                  </div>
                  <div className="choose-plan-billing-type">Yearly Plan · Billed Annually</div>
                  <p className="choose-plan-billing-detail">
                    Includes smart NFC card + 1 year of Lead Management CRM access. No app required.
                  </p>
                </div>

                <div className="choose-plan-divider"></div>

                {/* Features List */}
                <div className="choose-plan-features-block">
                  <span className="choose-plan-features-label">
                    Everything in the NFC Card + Software bundle, plus:
                  </span>
                  <ul className="choose-plan-feature-list">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="choose-plan-feature-item">
                        <Check className="choose-plan-check-icon" strokeWidth={2.5} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="choose-plan-card-footer">
                <button
                  type="button"
                  onClick={() => openCheckout("plan-pro")}
                  className="choose-plan-pill-btn"
                >
                  {plan.buttonLabel}
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Account Settings footer trigger */}
      <div className="choose-plan-settings-footer">
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
            className={`w-full max-w-lg rounded-2xl p-6 sm:p-8 shadow-2xl relative border ${
              isDark
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
                        className={`h-11 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                          paymentMethod === "UPI"
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
                        className={`h-11 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                          paymentMethod === "Cash on Delivery"
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
