"use client";

import React, { useState, useEffect, useRef } from "react";
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
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "Cash on Delivery">("UPI");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pin?: string;
  }>({});

  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser?.name && !customerName) setCustomerName(currentUser.name);
    if (currentUser?.email && !customerEmail) setCustomerEmail(currentUser.email);
  }, [currentUser]);

  const openCheckout = (planId: PlanId) => {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      lastActiveElementRef.current = document.activeElement;
    }
    setSelectedPlanId(planId);
    setCheckoutStep("form");
    setCheckoutError(null);
    setFieldErrors({});
    setModalOpen(true);
  };

  const closeCheckout = () => {
    if (checkoutStep === "confirming") return; // do not close during confirmation
    setModalOpen(false);
    setCheckoutStep("form");
    setCheckoutError(null);
    setFieldErrors({});
    setTimeout(() => {
      lastActiveElementRef.current?.focus();
    }, 50);
  };

  // Close on Escape key when not confirming
  useEffect(() => {
    if (!modalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && checkoutStep !== "confirming") {
        e.preventDefault();
        closeCheckout();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen, checkoutStep]);

  // Trap focus inside modal
  useEffect(() => {
    if (!modalOpen || !dialogRef.current) return;
    const dialog = dialogRef.current;

    const firstInput = dialog.querySelector<HTMLElement>("input:not([disabled])");
    if (firstInput) {
      firstInput.focus();
    } else {
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) focusable[0].focus();
    }

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusableEls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusableEls.length === 0) return;
      const firstEl = focusableEls[0];
      const lastEl = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, [modalOpen, checkoutStep]);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;

    const errors: Record<string, string> = {};
    if (!customerName.trim()) {
      errors.name = "Please enter your full name.";
    }
    const phoneClean = customerPhone.trim().replace(/\D/g, "");
    if (!customerPhone.trim()) {
      errors.phone = "Please enter your contact phone number.";
    } else if (phoneClean.length < 10) {
      errors.phone = "Please enter a valid 10-digit phone number.";
    }
    if (!addressLine1.trim()) {
      errors.address = "Please enter your street delivery address.";
    }
    if (!city.trim()) {
      errors.city = "Please enter your city.";
    }
    if (!stateName.trim()) {
      errors.state = "Please enter your state.";
    }
    if (!postalCode.trim()) {
      errors.pin = "Please enter your PIN code.";
    } else if (postalCode.trim().length < 5) {
      errors.pin = "Please enter a valid PIN code.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
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
          className="plan-checkout-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-checkout-title"
        >
          <div
            ref={dialogRef}
            className="plan-checkout-dialog"
          >
            {/* Header: Title + Close Button */}
            <div className="plan-checkout-header">
              <h2 id="plan-checkout-title" className="plan-checkout-title">
                Checkout
              </h2>
              <button
                type="button"
                onClick={closeCheckout}
                disabled={checkoutStep === "confirming"}
                className="plan-checkout-close-btn"
                aria-label="Close checkout"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* CONFIRMING STEP */}
            {checkoutStep === "confirming" ? (
                  <div className="plan-checkout-body plan-checkout-status-view">
                    <div className="plan-checkout-status-spinner">
                      <RefreshCw className="w-8 h-8 animate-spin" />
                    </div>
                      <h3 className="plan-checkout-status-title">Confirming your payment…</h3>
                      <p className="plan-checkout-status-desc">
                        Please hold on while our server verifies your payment signature and activates your {activePlan.fullName} entitlements.
                      </p>
                        <div className="plan-checkout-status-chip">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Secure cryptographic verification in progress</span>
                        </div>
                      </div>
                      ) : checkoutStep === "success" ? (
                          <div className="plan-checkout-body plan-checkout-status-view">
                            <div className="plan-checkout-status-success-icon">
                              <Check className="w-8 h-8 stroke-[3]" />
                            </div>
                              <h3 className="plan-checkout-status-title text-emerald-400">Payment Confirmed!</h3>
                              <p className="plan-checkout-status-desc">
                                Your {activePlan.fullName} plan has been activated successfully. Opening your dashboard…
                              </p>
                          </div>
                          ) : (
                          /* FORM & ERROR STEPS */
                                <form onSubmit={handleCheckoutSubmit} className="plan-checkout-form-wrap">
                                  <div className="plan-checkout-body">
                                    {/* Compact Order Summary */}
                                    <div className="plan-checkout-summary">
                                      <div className="plan-checkout-summary-row">
                                        <div>
                                          <h3 className="plan-checkout-summary-plan-name">
                                            {activePlan.fullName}
                                          </h3>
                                          <p className="plan-checkout-summary-term">
                                            {selectedPlanId === "plan-lite"
                                              ? "One-time hardware purchase"
                                              : "Yearly Plan · Billed Annually"}
                                          </p>
                                        </div>
                                        <div className="plan-checkout-summary-total-col">
                                          <div className="plan-checkout-summary-total-label">Total due today</div>
                                          <div className="plan-checkout-summary-amount">
                                            ₹{activePlan.price.toLocaleString("en-IN")}
                                          </div>
                                        </div>
                                      </div>
                                      {activePlan.renewalDetail && (
                                        <div className="plan-checkout-summary-renewal">
                                          <RefreshCw className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                          <span>{activePlan.renewalDetail}</span>
                                        </div>
                                      )}
                                    </div>

                                        {checkoutError && (
                                          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1 leading-relaxed">
                                              <p className="font-semibold mb-0.5">Checkout Notice</p>
                                              <p>{checkoutError}</p>
                                            </div>
                                          </div>
                  )}

                                            {/* Section 1: Contact Details */}
                                            <div className="plan-checkout-section">
                                              <h4 className="plan-checkout-section-heading">
                                                <span>Contact Details</span>
                                              </h4>
                                              <div className="plan-checkout-row-2">
                                                <div>
                                                  <label htmlFor="checkout-customer-name" className="plan-checkout-field-label">
                                                    Full Name *
                                                  </label>
                                                  <input
                                                    id="checkout-customer-name"
                                                    type="text"
                                                    value={customerName}
                                                    onChange={(e) => {
                                                      setCustomerName(e.target.value);
                                                      if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                                                    }}
                                                    placeholder="Your full name"
                                                    className={`plan-checkout-input ${fieldErrors.name ? "has-error" : ""}`}
                                                  />
                                                  {fieldErrors.name && (
                                                    <p className="plan-checkout-field-error">{fieldErrors.name}</p>
                                                  )}
                                                </div>
                                                <div>
                                                  <label htmlFor="checkout-customer-phone" className="plan-checkout-field-label">
                                                    Contact Phone *
                                                  </label>
                                                  <input
                                                    id="checkout-customer-phone"
                                                    type="tel"
                                                    value={customerPhone}
                                                    onChange={(e) => {
                                                      setCustomerPhone(e.target.value);
                                                      if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                                                    }}
                                                    placeholder="e.g. 9876543210"
                                                    className={`plan-checkout-input ${fieldErrors.phone ? "has-error" : ""}`}
                                                  />
                                                  {fieldErrors.phone && (
                                                    <p className="plan-checkout-field-error">{fieldErrors.phone}</p>
                                                  )}
                                                </div>
                                              </div>

                                              <div>
                                                  <label className="plan-checkout-field-label">
                                                    Registered Email
                                                  </label>
                                                  <div className="plan-checkout-account-badge">
                                                    <div className="flex items-center gap-2">
                                                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                                                      <span className="plan-checkout-account-email">
                                                        {customerEmail || "No registered email"}
                                                      </span>
                                                    </div>
                                                    <span className="plan-checkout-account-tag">
                                                      Verified Account
                                                    </span>
                                                  </div>
                                              </div>
                                            </div>

                                            {/* Section 2: Delivery Address */}
                                            <div className="plan-checkout-section">
                                              <h4 className="plan-checkout-section-heading">
                                                <span>Delivery Address</span>
                                              </h4>
                                              <p className="plan-checkout-field-helper">
                                                Your custom physical NFC smart business card will be delivered to this address.
                                              </p>

                                                  <div>
                                                    <label htmlFor="checkout-address-line1" className="plan-checkout-field-label">
                                                      Street Address *
                                                    </label>
                                                    <input
                                                      id="checkout-address-line1"
                                                      type="text"
                                                      value={addressLine1}
                                                      onChange={(e) => {
                                                        setAddressLine1(e.target.value);
                                                        if (fieldErrors.address) setFieldErrors((prev) => ({ ...prev, address: undefined }));
                                                      }}
                                                      placeholder="Flat / house number, building, street, locality"
                                                      className={`plan-checkout-input ${fieldErrors.address ? "has-error" : ""}`}
                                                    />
                                                    {fieldErrors.address && (
                                                      <p className="plan-checkout-field-error">{fieldErrors.address}</p>
                                                    )}
                                                  </div>

                                                  <div className="plan-checkout-row-3">
                                                    <div>
                                                      <label htmlFor="checkout-city" className="plan-checkout-field-label">
                                                        City *
                                                      </label>
                                                      <input
                                                        id="checkout-city"
                                                        type="text"
                                                        value={city}
                                                        onChange={(e) => {
                                                          setCity(e.target.value);
                                                          if (fieldErrors.city) setFieldErrors((prev) => ({ ...prev, city: undefined }));
                                                        }}
                                                        placeholder="City"
                                                        className={`plan-checkout-input ${fieldErrors.city ? "has-error" : ""}`}
                                                      />
                                                      {fieldErrors.city && (
                                                        <p className="plan-checkout-field-error">{fieldErrors.city}</p>
                                                      )}
                                                    </div>
                                                    <div>
                                                      <label htmlFor="checkout-state" className="plan-checkout-field-label">
                                                        State *
                                                      </label>
                                                      <input
                                                        id="checkout-state"
                                                        type="text"
                                                        value={stateName}
                                                        onChange={(e) => {
                                                          setStateName(e.target.value);
                                                          if (fieldErrors.state) setFieldErrors((prev) => ({ ...prev, state: undefined }));
                                                        }}
                                                        placeholder="State"
                                                        className={`plan-checkout-input ${fieldErrors.state ? "has-error" : ""}`}
                                                      />
                                                      {fieldErrors.state && (
                                                        <p className="plan-checkout-field-error">{fieldErrors.state}</p>
                                                      )}
                                                    </div>
                                                    <div>
                                                      <label htmlFor="checkout-pin" className="plan-checkout-field-label">
                                                        PIN Code *
                                                      </label>
                                                      <input
                                                        id="checkout-pin"
                                                        type="text"
                                                        value={postalCode}
                                                        onChange={(e) => {
                                                          setPostalCode(e.target.value);
                                                          if (fieldErrors.pin) setFieldErrors((prev) => ({ ...prev, pin: undefined }));
                                                        }}
                                                        placeholder="PIN Code"
                                                        className={`plan-checkout-input ${fieldErrors.pin ? "has-error" : ""}`}
                                                      />
                                                      {fieldErrors.pin && (
                                                        <p className="plan-checkout-field-error">{fieldErrors.pin}</p>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>

                                                      {/* Section 3: Payment Method */}
                  <div className="plan-checkout-section">
                                                      <h4 className="plan-checkout-section-heading">
                                                        <span>Payment Method</span>
                                                      </h4>
                                                      <div className="plan-checkout-payment-options">
                                                        <div
                                                          role="radio"
                                                          aria-checked={paymentMethod === "UPI"}
                                                          tabIndex={0}
                                                          onClick={() => setPaymentMethod("UPI")}
                        onKeyDown={(e) => {
                                                            if (e.key === " " || e.key === "Enter") {
                                                              e.preventDefault();
                                                              setPaymentMethod("UPI");
                                                            }
                                                          }}
                                                          className={`plan-checkout-payment-card ${paymentMethod === "UPI" ? "is-selected" : ""
                                                            }`}
                                                        >
                        <div className="plan-checkout-radio-circle">
                                                          {paymentMethod === "UPI" && <div className="plan-checkout-radio-dot" />}
                                                        </div>
                                                        <div className="plan-checkout-payment-info">
                                                          <span className="plan-checkout-payment-name">Online Payment</span>
                                                          <span className="plan-checkout-payment-subtext">UPI, Cards, Net Banking</span>
                                                        </div>
                                                      </div>

                                                      <div
                                                        role="radio"
                                                        aria-checked={paymentMethod === "Cash on Delivery"}
                                                        tabIndex={0}
                                                        onClick={() => setPaymentMethod("Cash on Delivery")}
                        onKeyDown={(e) => {
                                                          if (e.key === " " || e.key === "Enter") {
                                                            e.preventDefault();
                                                            setPaymentMethod("Cash on Delivery");
                                                          }
                                                        }}
                                                        className={`plan-checkout-payment-card ${paymentMethod === "Cash on Delivery" ? "is-selected" : ""
                                                          }`}
                                                      >
                                                      <div className="plan-checkout-radio-circle">
                                                        {paymentMethod === "Cash on Delivery" && <div className="plan-checkout-radio-dot" />}
                                                      </div>
                                                      <div className="plan-checkout-payment-info">
                                                        <span className="plan-checkout-payment-name">Cash on Delivery</span>
                                                        <span className="plan-checkout-payment-subtext">Pay upon card delivery</span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>

                                          {/* Modal Distinct Footer */}
                                          <div className="plan-checkout-footer">
                                            <button
                                              type="submit"
                                              disabled={submitting}
                                              className="plan-checkout-submit-btn"
                                            >
                                              {submitting ? (
                                                <>
                                                  <Loader2 className="w-4 h-4 animate-spin" />
                                                  <span>{paymentMethod === "Cash on Delivery" ? "Placing order…" : "Initiating Checkout…"}</span>
                                                </>
                                              ) : (
                                                <span>
                                                  {paymentMethod === "Cash on Delivery"
                                                    ? "Place order"
                                                    : `Pay ₹${activePlan.price.toLocaleString("en-IN")}`}
                                                </span>
                                              )}
                                            </button>
                                            {paymentMethod === "Cash on Delivery" && (
                                              <p className="plan-checkout-cod-note">
                                                Access will remain pending until payment is collected and verified upon card delivery.
                                              </p>
                                            )}
                                          </div>
                                      </form>
            )}
                                    </div>
        </div>
      )}
                            </div>
                            );
}
