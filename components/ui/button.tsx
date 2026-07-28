"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { buttonVariants, type ButtonVariantProps } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {
  loading?: boolean;
  loadingLabel?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, disabled, loading = false, loadingLabel, onClick, type, variant, size, ...props }, ref) => {
    const { pending: formPending } = useFormStatus();
    const [clickPending, setClickPending] = React.useState(false);
    const busy = loading || clickPending || (type !== "button" && formPending);

    function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
      const result = onClick?.(event) as unknown as PromiseLike<unknown> | undefined;
      if (result && typeof result.then === "function") {
        setClickPending(true);
        void Promise.resolve(result).then(
          () => setClickPending(false),
          () => setClickPending(false),
        );
      }
    }

    return (
      <button
        aria-busy={busy || undefined}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || busy}
        onClick={onClick ? handleClick : undefined}
        ref={ref}
        type={type}
        {...props}
      >
        {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" /> : null}
        {busy && loadingLabel ? loadingLabel : children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };
