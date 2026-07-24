import { useToast } from "@/hooks/use-toast";

export function Toaster() {
  const { toasts } = useToast();
  
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t, i) => (
        <div key={i} className={`p-4 rounded-xl shadow-lg border text-sm font-medium ${t.variant === 'destructive' ? 'bg-red-500 text-white border-red-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'}`}>
          {t.title}
          {t.description && <p className="text-xs opacity-80 mt-1">{t.description}</p>}
        </div>
      ))}
    </div>
  );
}
