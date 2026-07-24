import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, AlertCircle, CheckCircle, PauseCircle, XCircle, RefreshCw, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, differenceInDays, parseISO } from "date-fns";
import { useGetMyProfile } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/currency";

// ── API helpers ────────────────────────────────────────────────────────────
async function subsFetch(method: string, path: string, body?: unknown) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export type Subscription = {
  id: number;
  name: string;
  icon: string | null;
  billingCycle: string;
  price: number;
  currency: string;
  renewalDate: string;
  category: string;
  notes: string | null;
  status: string;
};

const CURRENCIES = ["USD", "EUR", "GBP", "EGP", "SAR", "AED", "KWD", "QAR", "BHD", "OMR", "TRY", "JPY", "CNY", "KRW", "INR", "CAD", "AUD", "CHF", "SEK", "NOK", "DKK", "PLN", "MXN", "BRL"];
const CATEGORIES = ["Subscriptions", "Entertainment", "Productivity", "Health", "Education", "News", "Music", "Gaming", "Cloud", "Other"];

const STATUS_CONFIG = {
  active:    { label: "Active",    icon: CheckCircle,  color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" },
  paused:    { label: "Paused",    icon: PauseCircle,  color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10" },
  cancelled: { label: "Cancelled", icon: XCircle,      color: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
};

const BLANK: Omit<Subscription, "id"> = {
  name: "", icon: "", billingCycle: "monthly", price: 0,
  currency: "USD", renewalDate: new Date().toISOString().split("T")[0],
  category: "Subscriptions", notes: "", status: "active",
};

function daysUntil(dateStr: string) {
  return differenceInDays(parseISO(dateStr), new Date());
}

function renewalLabel(dateStr: string) {
  const d = daysUntil(dateStr);
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, urgent: true };
  if (d === 0) return { text: "Today!", urgent: true };
  if (d === 1) return { text: "Tomorrow", urgent: true };
  if (d <= 7) return { text: `${d} days`, urgent: true };
  return { text: `${d} days`, urgent: false };
}

// ── Form ───────────────────────────────────────────────────────────────────
function SubForm({ initial, onSave, onCancel, saving }: {
  initial: Omit<Subscription, "id">;
  onSave: (data: Omit<Subscription, "id">) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide";
  const inputCls = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSave(form); }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Service Name *</label>
          <input required className={inputCls} placeholder="Netflix, Spotify…" value={form.name} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Icon (emoji)</label>
          <input className={inputCls} placeholder="🎬" value={form.icon ?? ""} onChange={e => set("icon", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={form.category} onChange={e => set("category", e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Price *</label>
          <input required type="number" min="0.01" step="0.01" className={inputCls} value={form.price || ""} onChange={e => set("price", parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className={labelCls}>Currency</label>
          <select className={inputCls} value={form.currency} onChange={e => set("currency", e.target.value)}>
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Billing Cycle</label>
          <select className={inputCls} value={form.billingCycle} onChange={e => set("billingCycle", e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Next Renewal *</label>
          <input required type="date" className={inputCls} value={form.renewalDate} onChange={e => set("renewalDate", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={form.status} onChange={e => set("status", e.target.value)}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Notes</label>
          <textarea rows={2} className={cn(inputCls, "resize-none")} placeholder="Optional notes…" value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Subscriptions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile } = useGetMyProfile();
  const [dialog, setDialog] = useState<null | "add" | Subscription>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: subs = [], isLoading } = useQuery<Subscription[]>({
    queryKey: ["subscriptions"],
    queryFn: () => subsFetch("GET", "/subscriptions"),
  });

  const createMut = useMutation({
    mutationFn: (data: Omit<Subscription, "id">) => subsFetch("POST", "/subscriptions", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscriptions"] }); setDialog(null); toast({ title: "Subscription added!" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Subscription> }) => subsFetch("PATCH", `/subscriptions/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscriptions"] }); setDialog(null); toast({ title: "Updated!" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => subsFetch("DELETE", `/subscriptions/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscriptions"] }); setDeleteId(null); toast({ title: "Deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activeSubs = useMemo(() => subs.filter(s => s.status === "active"), [subs]);
  const upcoming = useMemo(() => activeSubs.filter(s => daysUntil(s.renewalDate) <= 7), [activeSubs]);

  const monthlyTotal = useMemo(() =>
    activeSubs.reduce((sum, s) => sum + (s.billingCycle === "yearly" ? s.price / 12 : s.price), 0),
    [activeSubs]
  );
  const yearlyTotal = useMemo(() =>
    activeSubs.reduce((sum, s) => sum + (s.billingCycle === "yearly" ? s.price : s.price * 12), 0),
    [activeSubs]
  );

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-8 pb-nav md:pb-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Subscriptions</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Track recurring payments</p>
        </div>
        <Button
          onClick={() => setDialog("add")}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl gap-2 flex items-center justify-center"
        >
          <Plus className="w-4 h-4" /> Add
        </Button>
      </header>

      {/* Stats */}
      {activeSubs.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Monthly", value: formatCurrency(monthlyTotal, profile?.currency || "USD"), color: "text-emerald-600" },
            { label: "Yearly", value: formatCurrency(yearlyTotal, profile?.currency || "USD"), color: "text-blue-600" },
            { label: "Active", value: String(activeSubs.length), color: "text-slate-900 dark:text-white" },
          ].map(s => (
            <div key={s.label} className="glass-panel rounded-2xl p-4 text-center">
              <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming renewals warning */}
      <AnimatePresence>
        {upcoming.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 mb-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {upcoming.length} renewal{upcoming.length > 1 ? "s" : ""} coming up
              </p>
            </div>
            <div className="space-y-1.5">
              {upcoming.map(s => {
                const { text } = renewalLabel(s.renewalDate);
                return (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-amber-800 dark:text-amber-300 font-medium">
                      {s.icon || "📦"} {s.name}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      {s.currency} {s.price.toFixed(2)} · {text}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subscription list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-panel rounded-2xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-slate-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : subs.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-4">
            <RefreshCw className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="font-semibold text-slate-900 dark:text-white mb-1">No subscriptions yet</p>
          <p className="text-sm text-slate-500 mb-5">Add Netflix, Spotify, or any recurring payment</p>
          <Button onClick={() => setDialog("add")} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl gap-2 flex items-center justify-center">
            <Plus className="w-4 h-4" /> Add First Subscription
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map(sub => {
            const statusCfg = STATUS_CONFIG[sub.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active;
            const StatusIcon = statusCfg.icon;
            const rl = renewalLabel(sub.renewalDate);
            return (
              <motion.div
                key={sub.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "glass-panel rounded-2xl p-4 flex items-center gap-3",
                  rl.urgent && sub.status === "active" && "border border-amber-200 dark:border-amber-500/30"
                )}
              >
                {/* Icon */}
                <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-xl flex-shrink-0">
                  {sub.icon || sub.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{sub.name}</p>
                    <span className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", statusCfg.color)}>
                      <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {sub.currency} {sub.price.toFixed(2)}/{sub.billingCycle === "yearly" ? "yr" : "mo"}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className={cn("text-xs", rl.urgent && sub.status === "active" ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-500")}>
                      Renews {format(parseISO(sub.renewalDate), "MMM d")} · {rl.text}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setDialog(sub)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(sub.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add/Edit dialog */}
      <AnimatePresence>
        {dialog && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setDialog(null); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.96 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5">
                {dialog === "add" ? "Add Subscription" : `Edit ${(dialog as Subscription).name}`}
              </h2>
              <SubForm
                initial={dialog === "add" ? BLANK : { ...(dialog as Subscription) }}
                saving={createMut.isPending || updateMut.isPending}
                onCancel={() => setDialog(null)}
                onSave={data => {
                  if (dialog === "add") {
                    createMut.mutate(data);
                  } else {
                    updateMut.mutate({ id: (dialog as Subscription).id, data });
                  }
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setDeleteId(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 w-full max-w-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Delete subscription?</p>
                  <p className="text-sm text-slate-500">This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteId(null)}>Cancel</Button>
                <Button
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl"
                  onClick={() => deleteMut.mutate(deleteId!)}
                  disabled={deleteMut.isPending}
                >
                  {deleteMut.isPending ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
