import { useState, useEffect } from "react";

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const toast = (props: ToastProps) => {
    setToasts((prev) => [...prev, props]);
    // In a real app we would clear them or use shadcn's full toaster
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 3000);
  };

  return { toast, toasts };
}
