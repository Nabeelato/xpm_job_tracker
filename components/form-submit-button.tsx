import { Button, type ButtonProps } from "@/components/ui/button";

type FormSubmitButtonProps = ButtonProps & {
  pendingLabel?: string;
};

export function FormSubmitButton({ children, disabled, pendingLabel = "Working...", ...props }: FormSubmitButtonProps) {
  return (
    <Button disabled={disabled} loadingLabel={pendingLabel} type="submit" {...props}>
      {children}
    </Button>
  );
}
