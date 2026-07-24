import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useListBudgets, useCreateBudget, useDeleteBudget, useGetMyProfile } from "@workspace/api-client-react";
import { Plus, Trash2, Target, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

// ── Centered modal rendered into document.body via a portal ─────────────────
interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  newBudget: { category: string; limitAmount: string };
  setNewBudget: (v: { category: string; limitAmount: string }) => void;
}

function BudgetModal({ isOpen, onClose, onSave, isSaving, newBudget, setNewBudget }: BudgetModalProps) {
  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Close on Escape
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, handleKey]);

  if (!isOpen) return null;

  const modal = (
    // Overlay: fixed, covers full viewport, flex-centered
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          animation: "budgetFadeIn 160ms ease both",
        }}
      />

      {/* Modal panel — flex child, so it is naturally centered */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "440px",
          maxHeight: "calc(100dvh - 48px)",
          display: "flex",
          flexDirection: "column",
          animation: "budgetScaleIn 200ms cubic-bezier(0.34,1.56,0.64,1) both",
        }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        // Stop backdrop click from reaching the modal panel
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h2 id="budget-modal-title" className="text-xl font-bold text-slate-900 dark:text-white">
            Create New Budget
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="budget-category" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Category
            </label>
            <Input
              id="budget-category"
              placeholder="e.g. Groceries, Dining, Entertainment"
              value={newBudget.category}
              onChange={e => setNewBudget({ ...newBudget, category: e.target.value })}
              className="rounded-xl h-12"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="budget-limit" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Monthly Limit
            </label>
            <Input
              id="budget-limit"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={newBudget.limitAmount}
              onChange={e => setNewBudget({ ...newBudget, limitAmount: e.target.value })}
              className="rounded-xl h-12"
              onKeyDown={e => { if (e.key === "Enter") onSave(); }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={onSave}
            disabled={isSaving || !newBudget.category.trim() || !newBudget.limitAmount}
          >
            {isSaving ? "Saving…" : "Save Budget"}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function Budgets() {
  const { data: budgets, isLoading, refetch } = useListBudgets();
  const createMutation = useCreateBudget();
  const deleteMutation = useDeleteBudget();
  const { data: profile } = useGetMyProfile();
  const profileCurrency = profile?.currency || "USD";
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [newBudget, setNewBudget] = useState({ category: "", limitAmount: "" });

  const openModal = () => {
    setNewBudget({ category: "", limitAmount: "" });
    setIsOpen(true);
  };
  const closeModal = () => setIsOpen(false);

  const handleCreate = async () => {
    if (!newBudget.category.trim() || !newBudget.limitAmount) return;
    const amount = parseFloat(newBudget.limitAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({
        data: { category: newBudget.category.trim(), limitAmount: amount, period: "month" }
      });
      toast({ title: "Budget created" });
      closeModal();
      refetch();
    } catch {
      toast({ title: "Error creating budget", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this budget?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: "Budget deleted" });
      refetch();
    } catch {
      toast({ title: "Error deleting budget", variant: "destructive" });
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return "bg-red-500";
    if (percent >= 80) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <>
      {/* Keyframes injected once */}
      <style>{`
        @keyframes budgetFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes budgetScaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <BudgetModal
        isOpen={isOpen}
        onClose={closeModal}
        onSave={handleCreate}
        isSaving={createMutation.isPending}
        newBudget={newBudget}
        setNewBudget={setNewBudget}
      />

      <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Budgets</h1>
            <p className="text-slate-500">Set limits and let Bud keep you on track.</p>
          </div>
          <Button
            onClick={openModal}
            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-5 h-5 mr-2" /> New Budget
          </Button>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="glass-card p-6 rounded-3xl">
                <Skeleton className="h-6 w-24 mb-4" />
                <Skeleton className="h-10 w-32 mb-6" />
                <Skeleton className="h-2 w-full mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))
          ) : budgets && budgets.length > 0 ? (
            budgets.map(budget => {
              const percent = Math.min(100, (budget.spent / budget.limitAmount) * 100);
              const remaining = budget.limitAmount - budget.spent;
              const isOver = remaining < 0;

              return (
                <div key={budget.id} className="glass-card p-6 rounded-3xl relative overflow-hidden group">
                  {isOver && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                  )}

                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300">
                      {budget.category}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 -mt-2 -mr-2"
                      onClick={() => handleDelete(budget.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="mb-6">
                    <div className="text-sm text-slate-500 mb-1">Spent / Limit</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(budget.spent, profileCurrency)}
                      </span>
                      <span className="text-slate-400 font-medium">
                        / {formatCurrency(budget.limitAmount, profileCurrency)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(percent)} transition-all duration-1000`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      {isOver ? (
                        <span className="text-red-500 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Over by {formatCurrency(Math.abs(remaining), profileCurrency)}
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          {formatCurrency(remaining, profileCurrency)} remaining
                        </span>
                      )}
                      <span className="text-slate-400">{percent.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full flex items-center justify-center min-h-[360px]">
              <div className="flex flex-col items-center text-center px-4">
                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                  <Target className="w-10 h-10 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Budgets Set</h3>
                <p className="text-slate-500 max-w-sm mb-6">
                  Create a budget for categories like Groceries or Dining to track your spending limits.
                </p>
                <Button onClick={openModal} className="bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl">
                  Create First Budget
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
