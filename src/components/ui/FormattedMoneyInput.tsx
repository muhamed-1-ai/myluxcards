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
 * Strips formatting commas, returning a canonical numeric string ready for API/calculations.
 */
export function stripCommas(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/,/g, "").trim();
}

/**
 * Strips currency symbols (₹, $, €, £) and formatting commas.
 */
export function cleanRawAmount(
  value: string | number | null | undefined,
  allowNegative: boolean = false
): string {
  if (value === null || value === undefined) return "";
  let clean = String(value).trim().replace(/^[₹$€£]\s?/, "");
  clean = clean.replace(/,/g, "").trim();
  if (!allowNegative) {
    clean = clean.replace(/-/g, "");
  }
  return clean;
}

/**
 * Checks whether an unformatted string is a valid raw monetary string in progress.
 * Valid examples: "", "-", ".", "-.", "100", "100.5", "100.50".
 * Invalid examples: "10abc20", "10.5.5", "abc".
 */
export function isValidRawMoney(raw: string, allowNegative: boolean = false): boolean {
  if (!raw) return true;
  if (raw === "." || (allowNegative && (raw === "-" || raw === "-."))) return true;
  const regex = allowNegative ? /^-?\d*(\.\d*)?$/ : /^\d*(\.\d*)?$/;
  return regex.test(raw);
}

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
    let digitsOnly = intRaw.replace(/\D/g, "");
    // Normalize leading zeroes if integer has more than 1 digit (e.g. "05" -> "5", "00" -> "0")
    if (digitsOnly.length > 1 && digitsOnly.startsWith("0")) {
      digitsOnly = digitsOnly.replace(/^0+(?=\d)/, "");
    }
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
 * Calculates new cursor position in a formatted string based on non-comma character count.
 */
export function calculateNewCursor(
  formatted: string,
  nonCommaBefore: number,
  rawCandidate: string = ""
): number {
  if (rawCandidate === ".") return 2; // after "0."
  if (rawCandidate === "-.") return 3; // after "-0."

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
  return newCursor;
}

/**
 * Checks whether a string is a valid static money format (clean or grouped).
 * Preserved for backwards compatibility with tests and static format checks.
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
      maxLength,
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
          : cleanRawAmount(value, allowNegative)
        : defaultValue !== undefined
        ? cleanRawAmount(defaultValue, allowNegative)
        : "";

    const [displayValue, setDisplayValue] = useState(() =>
      formatAmountWithCommas(initialRaw, maxDecimals)
    );

    // Sync external value updates when controlled
    useEffect(() => {
      if (value === undefined) return;
      const incomingRaw = value === null ? "" : cleanRawAmount(value, allowNegative);
      if (inputRef.current) {
        const currentRaw = cleanRawAmount(inputRef.current.value, allowNegative);
        // Only update DOM if the canonical value actually differs (prevents cursor jumps & state loops)
        if (currentRaw !== incomingRaw) {
          const nextFormatted = formatAmountWithCommas(incomingRaw, maxDecimals);
          inputRef.current.value = nextFormatted;
          setDisplayValue(nextFormatted);
        }
      } else {
        setDisplayValue(formatAmountWithCommas(incomingRaw, maxDecimals));
      }
    }, [value, maxDecimals, allowNegative]);

    // Handle form reset event when uncontrolled
    useEffect(() => {
      const input = inputRef.current;
      if (!input || !input.form) return;
      const form = input.form;
      const handleReset = () => {
        const resetRaw = defaultValue !== undefined ? cleanRawAmount(defaultValue, allowNegative) : "";
        const formatted = formatAmountWithCommas(resetRaw, maxDecimals);
        input.value = formatted;
        setDisplayValue(formatted);
      };
      form.addEventListener("reset", handleReset);
      return () => form.removeEventListener("reset", handleReset);
    }, [defaultValue, maxDecimals, allowNegative]);

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
            const newRaw = cleanRawAmount(before + after, allowNegative);
            const newFormatted = formatAmountWithCommas(newRaw, maxDecimals);

            // Count non-comma characters before selectionStart - 2
            const nonCommaBefore = stripCommas(before).length;
            input.value = newFormatted;
            setDisplayValue(newFormatted);

            const newPos = calculateNewCursor(newFormatted, nonCommaBefore, newRaw);
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
            const newRaw = cleanRawAmount(before + after, allowNegative);
            const newFormatted = formatAmountWithCommas(newRaw, maxDecimals);

            const nonCommaBefore = stripCommas(before).length;
            input.value = newFormatted;
            setDisplayValue(newFormatted);

            const newPos = calculateNewCursor(newFormatted, nonCommaBefore, newRaw);
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
        e.key === "End" ||
        e.key === "PageUp" ||
        e.key === "PageDown";

      const isModifierShortcut =
        (e.ctrlKey || e.metaKey) &&
        ["a", "c", "v", "x", "z", "y"].includes(e.key.toLowerCase());

      if (isControlKey || isModifierShortcut) {
        return;
      }

      // Allow mobile / Android virtual keyboards (often sent as "Unidentified" or keyCode 229)
      if (e.key === "Unidentified" || e.key === "Process" || e.key.length > 1) {
        return;
      }

      // Allow negative sign if enabled and at start
      if (allowNegative && e.key === "-" && selectionStart === 0 && !curVal.includes("-")) {
        return;
      }

      // Allow decimal point if maxDecimals > 0 and not already present
      if (e.key === ".") {
        if (maxDecimals <= 0) {
          e.preventDefault();
          return;
        }
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

      // Check decimal precision cap if cursor is after decimal dot
      if (/^\d$/.test(e.key)) {
        if (
          selectionStart !== null &&
          selectionEnd !== null &&
          selectionStart === selectionEnd
        ) {
          const dotIdx = curVal.indexOf(".");
          if (dotIdx !== -1 && selectionStart > dotIdx) {
            const decPart = curVal.slice(dotIdx + 1);
            if (decPart.length >= maxDecimals) {
              e.preventDefault();
              return;
            }
          }
        }
        return;
      }

      // Block all non-digit, non-system keys
      e.preventDefault();
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (onPaste) onPaste(e);
      if (e.defaultPrevented) return;

      const pastedText = e.clipboardData.getData("text");
      if (!pastedText) return;

      // Clean pasted text of currency signs, commas, and whitespace
      const cleanPasted = cleanRawAmount(pastedText, allowNegative);
      if (!cleanPasted || !isValidRawMoney(cleanPasted, allowNegative)) {
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

      const combinedRaw = (
        cleanRawAmount(before, allowNegative) +
        cleanPasted +
        cleanRawAmount(after, allowNegative)
      ).trim();

      // Ensure at most one decimal dot
      const dotMatches = combinedRaw.match(/\./g);
      if (dotMatches && dotMatches.length > 1) {
        return;
      }

      let capped = combinedRaw;
      if (combinedRaw.includes(".")) {
        const [intP, decP] = combinedRaw.split(".");
        capped = intP + "." + (decP || "").slice(0, maxDecimals);
      }

      if (maxLength !== undefined && stripCommas(capped).length > maxLength) {
        capped = stripCommas(capped).slice(0, maxLength);
      }

      const formatted = formatAmountWithCommas(capped, maxDecimals);
      input.value = formatted;
      setDisplayValue(formatted);

      // Target cursor position: after the pasted section
      const nonCommaTarget = (cleanRawAmount(before, allowNegative) + cleanPasted).length;
      const newPos = calculateNewCursor(formatted, nonCommaTarget, capped);

      input.setSelectionRange(newPos, newPos);
      notifyChange(capped);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const curPos = input.selectionStart || 0;
      const currentVal = input.value;

      // Extract raw digits & decimal dot, ignoring any formatting commas or currency symbols
      const rawCandidate = cleanRawAmount(currentVal, allowNegative);

      // If the resulting raw string is invalid (e.g. letters from drag-drop or non-sanitized input), reject
      if (!isValidRawMoney(rawCandidate, allowNegative)) {
        input.value = displayValue;
        return;
      }

      // Count non-comma characters to the left of the cursor before re-formatting
      const nonCommaBefore = stripCommas(currentVal.slice(0, curPos)).length;

      // Enforce maxDecimals
      let raw = rawCandidate;
      if (raw.includes(".")) {
        const [intPart, decPart] = raw.split(".");
        if (decPart && decPart.length > maxDecimals) {
          raw = intPart + "." + decPart.slice(0, maxDecimals);
        }
      }

      // Enforce maxLength against raw digits if provided
      if (maxLength !== undefined && stripCommas(raw).length > maxLength) {
        raw = stripCommas(raw).slice(0, maxLength);
      }

      const formatted = formatAmountWithCommas(raw, maxDecimals);
      const newCursor = calculateNewCursor(formatted, nonCommaBefore, rawCandidate);

      input.value = formatted;
      input.setSelectionRange(newCursor, newCursor);
      setDisplayValue(formatted);
      notifyChange(raw);
    };

    const rawCurrent = cleanRawAmount(displayValue, allowNegative);

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
