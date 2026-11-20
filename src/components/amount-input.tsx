"use client";

import { useLayoutEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { caretAfter, formatAmountInput, significantBefore } from "@/lib/money-input";

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (text: string) => void;
  currency: string;
};

/**
 * An amount field that groups the digits while you type: 8000 -> "8 000", 8000000 -> "8 000 000".
 * It keeps the caret where it was, so editing in the middle of a number works as expected.
 */
export function AmountInput({ value, onValueChange, currency, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  // After React has written the new text, put the caret back after the same digit.
  useLayoutEffect(() => {
    if (caret.current !== null && ref.current && document.activeElement === ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
    }
    caret.current = null;
  });

  return (
    <Input
      {...props}
      ref={ref}
      value={value}
      inputMode="decimal"
      autoComplete="off"
      onChange={(e) => {
        const raw = e.target.value;
        const formatted = formatAmountInput(raw, currency);
        caret.current = caretAfter(formatted, significantBefore(raw, e.target.selectionStart ?? raw.length));
        onValueChange(formatted);
      }}
    />
  );
}
