"use client";

import React, {
  forwardRef,
  useRef,
  useImperativeHandle,
  useState,
  useEffect,
  useCallback,
} from "react";

/**
 * Formats a raw numeric/decimal string or number into standard 3-digit comma-grouped representation.
 * Examples:
 * - 1000 -> 1,000
 * - 10000 -> 10,000
 * - 20000 -> 20,000
 * - 100000 -> 100,000
 * - 1000000 -> 1,000,000
 * - 10000.50 -> 10,000.50
 * - 0. -> 0.
 * - "" -> ""
 */
export function formatAmountWithCommas(
  value: string | number | null | undefined,
  maxDecimals: number = 2
): string {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value).trim();
  if (!str) return "";

  const isNegative = str.startsWith("-");
  const unsigned = isNegative ? str.slice(1) : str;

  const hasDot = unsigned.includes(".");
  const [intRaw, decRaw] = unsigned.split(".");

  let formattedInt = "";
  if (intRaw !== undefined && intRaw !== "") {
    const digitsOnly = intRaw.replace(/\D/g, "");
    if (digitsOnly) {
      formattedInt = digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    } else if (hasDot) {
      formattedInt = "0";
    }
  } else if (hasDot) {
    formattedInt = "0";
  }

  let result = (isNegative ? "-" : "") + formattedInt;
  if (hasDot) {
    const cleanDec = decRaw !== undefined ? decRaw.replace(/\D/g, "").slice(0, maxDecimals) : "";
    result += "." + cleanDec;
  }
  return result;
}

/**
 * Strips formatting commas, returning a canonical numeric string ready for API/calculations.
 */
export function stripCommas(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).replace(/,/g, "").trim();
}

/**
 * Checks whether a string is a valid money format (clean or grouped).
 * Rejects letters like "10abc20" and invalid symbols.
 */
export function isValidMoneyString(str: string, allowNegative: boolean = false): boolean {
  if (!str || !str.trim()) return true;
  const clean = str.trim().replace(/^[₹$€£]\s?/, "").trim();
  if (!clean) return true;
  if (clean === "." || (allowNegative && (clean === "-" || clean === "-."))) return true;
  const regex = allowNegative
    ? /^-?((\d{1,3}(,\d{3})*|\d+)(\.\d{0,10})?|\.\d{1,10})$/
    : /^((\d{1,3}(,\d{3})*|\d+)(\.\d{0,10})?|\.\d{1,10})$/;
  return regex.test(clean);
}

export interface FormattedMoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value?: string | number | null;
  defaultValue?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>, rawValue: string) => void;
  onValueChange?: (rawValue: string) => void;
  maxDecimals?: number;
  allowNegative?: boolean;
}

export const FormattedMoneyInput = forwardRef<HTMLInputElement, FormattedMoneyInputProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      onValueChange,
      maxDecimals = 2,
      allowNegative = false,
      name,
      className,
      placeholder = "0.00",
      disabled,
      readOnly,
      required,
      autoFocus,
      onKeyDown,
      onPaste,
      ...restProps
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    // Initial formatted display
    const initialRaw =
      value !== undefined
        ? value === null
          ? ""
          : String(value)
        : defaultValue !== undefined
        ? String(defaultValue)
        : "";

    const [displayValue, setDisplayValue] = useState(() =>
      formatAmountWithCommas(initialRaw, maxDecimals)
    );

    // Sync external value updates when controlled
    useEffect(() => {
      if (value === undefined) return;
      const incomingRaw = value === null ? "" : String(value);
      if (inputRef.current) {
        const currentRaw = stripCommas(inputRef.current.value);
        if (currentRaw !== incomingRaw) {
          const nextFormatted = formatAmountWithCommas(incomingRaw, maxDecimals);
          inputRef.current.value = nextFormatted;
          setDisplayValue(nextFormatted);
        }
      } else {
        setDisplayValue(formatAmountWithCommas(incomingRaw, maxDecimals));
      }
    }, [value, maxDecimals]);

    // Handle form reset event when uncontrolled
    useEffect(() => {
      const input = inputRef.current;
      if (!input || !input.form) return;
      const form = input.form;
      const handleReset = () => {
        const resetRaw = defaultValue !== undefined ? String(defaultValue) : "";
        const formatted = formatAmountWithCommas(resetRaw, maxDecimals);
        input.value = formatted;
        setDisplayValue(formatted);
      };
      form.addEventListener("reset", handleReset);
      return () => form.removeEventListener("reset", handleReset);
    }, [defaultValue, maxDecimals]);

    const notifyChange = useCallback(
      (raw: string) => {
        if (onValueChange) {
          onValueChange(raw);
        }
        if (onChange && inputRef.current) {
          // Wrap in a synthetic-like event where e.target.value is the clean raw number
          const syntheticEvent = {
            ...({} as React.ChangeEvent<HTMLInputElement>),
            target: {
              ...inputRef.current,
              name: name || inputRef.current.name || "",
              value: raw,
            },
            currentTarget: {
              ...inputRef.current,
              name: name || inputRef.current.name || "",
              value: raw,
            },
            persist: () => {},
            preventDefault: () => {},
            stopPropagation: () => {},
          };
          onChange(syntheticEvent as unknown as React.ChangeEvent<HTMLInputElement>, raw);
        }
      },
      [name, onChange, onValueChange]
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (onKeyDown) onKeyDown(e);
      if (e.defaultPrevented) return;

      const input = inputRef.current;
      if (!input) return;

      const { selectionStart, selectionEnd, value: curVal } = input;

      // Natural Backspace handling around commas
      if (e.key === "Backspace") {
        if (selectionStart !== null && selectionStart === selectionEnd && selectionStart > 0) {
          // If character right before cursor is comma, delete the digit preceding the comma
          if (curVal[selectionStart - 1] === ",") {
            e.preventDefault();
            const before = curVal.slice(0, selectionStart - 2);
            const after = curVal.slice(selectionStart);
            const newRaw = stripCommas(before + after);
            const newFormatted = formatAmountWithCommas(newRaw, maxDecimals);

            // Count non-comma characters before selectionStart - 2
            const nonCommaBefore = stripCommas(before).length;
            input.value = newFormatted;
            setDisplayValue(newFormatted);

            let newPos = newFormatted.length;
            let count = 0;
            if (nonCommaBefore === 0) {
              newPos = 0;
            } else {
              for (let i = 0; i < newFormatted.length; i++) {
                if (newFormatted[i] !== ",") count++;
                if (count === nonCommaBefore) {
                  newPos = i + 1;
                  break;
                }
              }
            }
            input.setSelectionRange(newPos, newPos);
            notifyChange(newRaw);
            return;
          }
        }
      }

      // Natural Delete handling around commas
      if (e.key === "Delete") {
        if (selectionStart !== null && selectionStart === selectionEnd && selectionStart < curVal.length) {
          // If character at cursor is comma, delete the digit following the comma
          if (curVal[selectionStart] === ",") {
            e.preventDefault();
            const before = curVal.slice(0, selectionStart);
            const after = curVal.slice(selectionStart + 2);
            const newRaw = stripCommas(before + after);
            const newFormatted = formatAmountWithCommas(newRaw, maxDecimals);

            const nonCommaBefore = stripCommas(before).length;
            input.value = newFormatted;
            setDisplayValue(newFormatted);

            let newPos = newFormatted.length;
            let count = 0;
            if (nonCommaBefore === 0) {
              newPos = 0;
            } else {
              for (let i = 0; i < newFormatted.length; i++) {
                if (newFormatted[i] !== ",") count++;
                if (count === nonCommaBefore) {
                  newPos = i + 1;
                  break;
                }
              }
            }
            input.setSelectionRange(newPos, newPos);
            notifyChange(newRaw);
            return;
          }
        }
      }

      // Allow navigation and standard editing shortcuts
      const isControlKey =
        e.key === "Backspace" ||
        e.key === "Delete" ||
        e.key === "Tab" ||
        e.key === "Escape" ||
        e.key === "Enter" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "Home" ||
        e.key === "End";

      const isModifierShortcut = (e.ctrlKey || e.metaKey) && ["a", "c", "v", "x", "z", "y"].includes(e.key.toLowerCase());

      if (isControlKey || isModifierShortcut) {
        return;
      }

      // Allow negative sign if enabled and at start
      if (allowNegative && e.key === "-" && selectionStart === 0 && !curVal.includes("-")) {
        return;
      }

      // Allow decimal point if not already present
      if (e.key === ".") {
        const selectedText =
          selectionStart !== null && selectionEnd !== null
            ? curVal.substring(selectionStart, selectionEnd)
            : "";
        const willStillHaveDot = curVal.includes(".") && !selectedText.includes(".");
        if (willStillHaveDot) {
          e.preventDefault();
        }
        return;
      }

      // Block all non-digit characters (rejecting letters like 'a', 'b', etc.)
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (onPaste) onPaste(e);
      if (e.defaultPrevented) return;

      const pastedText = e.clipboardData.getData("text");
      if (!pastedText) return;

      // Reject malformed input clearly (e.g. "10abc20")
      if (!isValidMoneyString(pastedText, allowNegative)) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      const input = inputRef.current;
      if (!input) return;

      const { selectionStart = 0, selectionEnd = 0, value: curVal } = input;
      const start = selectionStart ?? 0;
      const end = selectionEnd ?? 0;

      const before = curVal.slice(0, start);
      const after = curVal.slice(end);

      // Clean pasted amount
      const cleanPasted = pastedText.trim().replace(/^[₹$€£]\s?/, "").replace(/,/g, "");
      const combined = (before + cleanPasted + after).replace(/,/g, "");

      // Ensure at most one dot
      const dotCount = (combined.match(/\./g) || []).length;
      if (dotCount > 1) {
        return;
      }

      let capped = combined;
      if (combined.includes(".")) {
        const [intP, decP] = combined.split(".");
        capped = intP + "." + (decP || "").slice(0, maxDecimals);
      }

      const formatted = formatAmountWithCommas(capped, maxDecimals);
      input.value = formatted;
      setDisplayValue(formatted);

      // Position cursor at end of pasted section
      const nonCommaTarget = stripCommas(before + cleanPasted).length;
      let newPos = formatted.length;
      let count = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] !== ",") count++;
        if (count === nonCommaTarget) {
          newPos = i + 1;
          break;
        }
      }
      input.setSelectionRange(newPos, newPos);
      notifyChange(capped);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const curPos = input.selectionStart || 0;
      const currentVal = input.value;

      // Reject malformed input clearly (e.g. from drag/drop or unusual IME like "10abc20")
      if (currentVal && !isValidMoneyString(currentVal, allowNegative)) {
        input.value = displayValue;
        return;
      }

      // Count non-comma characters to the left of the cursor
      const nonCommaBefore = stripCommas(currentVal.slice(0, curPos)).length;

      // Strip commas to get raw number
      let raw = stripCommas(currentVal);

      // Validate single decimal point
      const dotMatches = raw.match(/\./g);
      if (dotMatches && dotMatches.length > 1) {
        input.value = displayValue;
        return;
      }

      // Enforce maxDecimals
      if (raw.includes(".")) {
        const [intPart, decPart] = raw.split(".");
        if (decPart && decPart.length > maxDecimals) {
          raw = intPart + "." + decPart.slice(0, maxDecimals);
        }
      }

      const formatted = formatAmountWithCommas(raw, maxDecimals);

      // Restore cursor position matching nonCommaBefore
      let newCursor = formatted.length;
      let count = 0;
      if (nonCommaBefore === 0) {
        newCursor = 0;
      } else {
        for (let i = 0; i < formatted.length; i++) {
          if (formatted[i] !== ",") count++;
          if (count === nonCommaBefore) {
            newCursor = i + 1;
            break;
          }
        }
      }

      input.value = formatted;
      input.setSelectionRange(newCursor, newCursor);
      setDisplayValue(formatted);
      notifyChange(raw);
    };

    const rawCurrent = stripCommas(displayValue);

    return (
      <>
        {name && <input type="hidden" name={name} value={rawCurrent} disabled={disabled} />}
        <input
          {...restProps}
          ref={inputRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className={className}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          autoFocus={autoFocus}
        />
      </>
    );
  }
);

FormattedMoneyInput.displayName = "FormattedMoneyInput";

export default FormattedMoneyInput;
