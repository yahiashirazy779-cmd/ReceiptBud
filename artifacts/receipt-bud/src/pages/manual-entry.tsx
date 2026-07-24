import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Plus, Trash2, PenLine, Check, X,
  Receipt, ShoppingBag, Package, ChevronDown, Image as ImageIcon,
  Loader2, CheckCircle2, Tag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCreateReceipt, useGetMyProfile } from "@workspace/api-client-react";
import { formatCurrency, CURRENCY_LIST } from "@/lib/currency";
import { cn } from "@/lib/utils";

// ── Constants ───────────────────────────────────────────────────────────────

const BUILT_IN_CATEGORIES = [
  "Groceries", "Restaurants", "Transport", "Shopping", "Entertainment",
  "Health", "Education", "Utilities", "Travel", "Electronics", "Home",
  "Pets", "Other",
];

const PAYMENT_METHODS = [
  "Cash", "Credit Card", "Debit Card", "Apple Pay",
  "Google Pay", "Bank Transfer", "Other",
];

const RECEIPT_TYPES = ["Physical", "Digital", "Email", "Manual"];

const DRAFT_KEY = "receiptbud_manual_draft";

// ── Types ────────────────────────────────────────────────────────────────────

interface Item {
  id: string;
  name: string;
  category: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  editing: boolean;
}

interface FormState {
  storeName: string;
  date: string;
  time: string;
  currency: string;
  paymentMethod: string;
  receiptType: string;
  category: string;
  customCategory: string;
  items: Item[];
  tax: string;
  discount: string;
  shipping: string;
  tip: string;
  notes: string;
  tags: string;
  imageBase64: string;
}

function newItem(): Item {
  return {
    id: crypto.randomUUID(),
    name: "", category: "Other",
    quantity: "1", unitPrice: "", totalPrice: "",
    editing: true,
  };
}

function calcItemTotal(qty: string, unit: string): string {
  const q = parseFloat(qty) || 0;
  const u = parseFloat(unit) || 0;
  return (q * u).toFixed(2);
}

function parseNum(s: string): number {
  return parseFloat(s) || 0;
}

// ── Select component (thin wrapper for consistent styling) ───────────────────

function Select({
  value, onChange, children, className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    </div>
  );
}

// ── FormField ────────────────────────────────────────────────────────────────

function FormField({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex gap-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── SectionCard ──────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-3xl p-5 space-y-4">
      <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ManualEntry() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createMutation = useCreateReceipt();
  const { data: profile } = useGetMyProfile();

  const defaultCurrency = profile?.currency || "USD";

  const [form, setForm] = useState<FormState>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {
      storeName: "", date: new Date().toISOString().split("T")[0],
      time: "", currency: defaultCurrency, paymentMethod: "",
      receiptType: "Manual", category: "Other", customCategory: "",
      items: [], tax: "", discount: "", shipping: "", tip: "",
      notes: "", tags: "", imageBase64: "",
    };
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saved, setSaved] = useState(false);
  const [customCatMode, setCustomCatMode] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Sync default currency when profile loads
  useEffect(() => {
    if (profile?.currency && !form.currency) {
      setForm(f => ({ ...f, currency: profile.currency! }));
    }
  }, [profile?.currency]);

  // Auto-save draft
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(t);
  }, [form]);

  // Helpers
  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  // Items
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, newItem()] }));

  const updateItem = (id: string, patch: Partial<Item>) =>
    setForm(f => ({
      ...f,
      items: f.items.map(it => {
        if (it.id !== id) return it;
        const merged = { ...it, ...patch };
        // auto-calc total when qty or unit changes
        if ("quantity" in patch || "unitPrice" in patch) {
          merged.totalPrice = calcItemTotal(merged.quantity, merged.unitPrice);
        }
        return merged;
      }),
    }));

  const removeItem = (id: string) =>
    setForm(f => ({ ...f, items: f.items.filter(it => it.id !== id) }));

  const finishItem = (id: string) => updateItem(id, { editing: false });
  const editItem = (id: string) => updateItem(id, { editing: true });

  // Derived totals
  const subtotal = form.items.reduce(
    (sum, it) => sum + (parseFloat(it.totalPrice) || parseFloat(calcItemTotal(it.quantity, it.unitPrice)) || 0),
    0,
  );
  const grandTotal =
    subtotal + parseNum(form.tax) - parseNum(form.discount) + parseNum(form.shipping) + parseNum(form.tip);

  // Image upload
  const handleImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      setField("imageBase64", result);
    };
    reader.readAsDataURL(file);
  }, []);

  // Validation
  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.storeName.trim()) e.storeName = "Store name is required";
    if (!form.date) e.date = "Date is required";
    const cat = customCatMode ? form.customCategory.trim() : form.category;
    if (!cat) e.category = "Category is required";
    if (form.items.length === 0 && grandTotal <= 0)
      e.items = "Add at least one item or enter a total manually";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Submit
  const handleSave = async () => {
    if (!validate()) {
      toast({ title: "Please fill in the required fields", variant: "destructive" });
      return;
    }

    const finalCategory = customCatMode ? form.customCategory.trim() : form.category;

    // Build notes (include optional metadata not in API schema)
    const metaParts: string[] = [];
    if (form.time) metaParts.push(`Time: ${form.time}`);
    if (form.receiptType !== "Manual") metaParts.push(`Type: ${form.receiptType}`);
    if (form.tags.trim()) metaParts.push(`Tags: ${form.tags.trim()}`);
    if (parseNum(form.shipping)) metaParts.push(`Shipping: ${formatCurrency(parseNum(form.shipping), form.currency)}`);
    if (parseNum(form.tip)) metaParts.push(`Tip: ${formatCurrency(parseNum(form.tip), form.currency)}`);
    const notesStr = [form.notes.trim(), ...metaParts].filter(Boolean).join("\n");

    const payload = {
      storeName: form.storeName.trim(),
      date: form.date,
      total: Math.max(grandTotal, 0),
      tax: parseNum(form.tax) || undefined,
      discount: parseNum(form.discount) || undefined,
      paymentMethod: form.paymentMethod || undefined,
      category: finalCategory,
      currency: form.currency,
      notes: notesStr || undefined,
      imageBase64: form.imageBase64 || undefined,
      items: form.items.map(it => ({
        name: it.name,
        price: parseFloat(it.totalPrice) || parseFloat(calcItemTotal(it.quantity, it.unitPrice)) || 0,
        quantity: parseFloat(it.quantity) || 1,
        category: it.category || undefined,
      })),
      aiInsight: "Manually entered receipt",
    };

    try {
      await createMutation.mutateAsync({ data: payload });
      setSaved(true);
      localStorage.removeItem(DRAFT_KEY);
      setTimeout(() => setLocation("/history"), 1800);
    } catch {
      toast({ title: "Failed to save receipt. Please try again.", variant: "destructive" });
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (saved) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="w-24 h-24 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center"
        >
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Receipt Saved!</h2>
          <p className="text-slate-500">Redirecting to your history…</p>
        </motion.div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          onClick={() => setLocation("/scan")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Add Receipt Manually</h1>
          <p className="text-xs text-slate-400">Draft auto-saved</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={createMutation.isPending}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-9 px-4 shadow-sm shadow-emerald-500/20"
        >
          {createMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</>
          ) : (
            <><Check className="w-4 h-4 mr-1.5" /> Save</>
          )}
        </Button>
      </header>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 md:pb-8">

        {/* ── Basic Info ── */}
        <SectionCard title="Basic Information" icon={<Receipt className="w-4 h-4" />}>
          <FormField label="Store Name" required error={errors.storeName}>
            <Input
              placeholder="e.g. Whole Foods, Amazon"
              value={form.storeName}
              onChange={e => setField("storeName", e.target.value)}
              className={cn("rounded-xl", errors.storeName && "border-red-400 focus:ring-red-400")}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date" required error={errors.date}>
              <Input
                type="date"
                value={form.date}
                onChange={e => setField("date", e.target.value)}
                className="rounded-xl"
              />
            </FormField>
            <FormField label="Time (optional)">
              <Input
                type="time"
                value={form.time}
                onChange={e => setField("time", e.target.value)}
                className="rounded-xl"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Currency">
              <Select value={form.currency} onChange={v => setField("currency", v)}>
                {CURRENCY_LIST.map(c => (
                  <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Payment Method">
              <Select value={form.paymentMethod} onChange={v => setField("paymentMethod", v)}>
                <option value="">Select…</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Receipt Type">
              <Select value={form.receiptType} onChange={v => setField("receiptType", v)}>
                {RECEIPT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FormField>
            <FormField label="Category" required error={errors.category}>
              {customCatMode ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Custom category"
                    value={form.customCategory}
                    onChange={e => setField("customCategory", e.target.value)}
                    className="rounded-xl flex-1"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl"
                    onClick={() => setCustomCatMode(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Select value={form.category} onChange={v => {
                  if (v === "__custom__") { setCustomCatMode(true); }
                  else setField("category", v);
                }}>
                  {BUILT_IN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">+ Custom category…</option>
                </Select>
              )}
            </FormField>
          </div>
        </SectionCard>

        {/* ── Items ── */}
        <SectionCard title="Items Purchased" icon={<ShoppingBag className="w-4 h-4" />}>
          {errors.items && (
            <p className="text-xs text-red-500 -mt-2">{errors.items}</p>
          )}

          <AnimatePresence initial={false}>
            {form.items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                {item.editing ? (
                  /* ── edit mode ── */
                  <div className="border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-4 space-y-3 bg-emerald-50/50 dark:bg-emerald-500/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                        Item {idx + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <Input
                          placeholder="Item name *"
                          value={item.name}
                          onChange={e => updateItem(item.id, { name: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                      <Select
                        value={item.category}
                        onChange={v => updateItem(item.id, { category: v })}
                      >
                        {BUILT_IN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                      <Input
                        placeholder="Qty"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, { quantity: e.target.value })}
                        className="rounded-xl"
                      />
                      <Input
                        placeholder="Unit price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={e => updateItem(item.id, { unitPrice: e.target.value })}
                        className="rounded-xl"
                      />
                      <Input
                        placeholder="Total price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.totalPrice}
                        onChange={e => updateItem(item.id, { totalPrice: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>

                    <Button
                      size="sm"
                      className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                      onClick={() => finishItem(item.id)}
                      disabled={!item.name.trim()}
                    >
                      <Check className="w-3.5 h-3.5 mr-1.5" /> Done
                    </Button>
                  </div>
                ) : (
                  /* ── view mode ── */
                  <div className="flex items-center gap-3 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 bg-white dark:bg-slate-900">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">
                        {item.category} · {item.quantity} × {formatCurrency(parseNum(item.unitPrice), form.currency)}
                      </p>
                    </div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex-shrink-0">
                      {formatCurrency(
                        parseNum(item.totalPrice) || parseFloat(calcItemTotal(item.quantity, item.unitPrice)) || 0,
                        form.currency,
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg" onClick={() => editItem(item.id)}>
                        <PenLine className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          <Button
            variant="outline"
            className="w-full rounded-xl border-dashed border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
            onClick={addItem}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Item
          </Button>
        </SectionCard>

        {/* ── Totals ── */}
        <SectionCard title="Receipt Totals" icon={<Receipt className="w-4 h-4" />}>
          {/* Live subtotal badge */}
          {form.items.length > 0 && (
            <div className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-2.5">
              <span className="text-slate-500">Subtotal (from items)</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formatCurrency(subtotal, form.currency)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tax">
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.tax}
                onChange={e => setField("tax", e.target.value)}
                className="rounded-xl"
              />
            </FormField>
            <FormField label="Discount">
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.discount}
                onChange={e => setField("discount", e.target.value)}
                className="rounded-xl"
              />
            </FormField>
            <FormField label="Shipping / Delivery (optional)">
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.shipping}
                onChange={e => setField("shipping", e.target.value)}
                className="rounded-xl"
              />
            </FormField>
            <FormField label="Tip (optional)">
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.tip}
                onChange={e => setField("tip", e.target.value)}
                className="rounded-xl"
              />
            </FormField>
          </div>

          {/* Grand Total */}
          <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl px-5 py-4">
            <span className="font-bold text-emerald-900 dark:text-emerald-100">Grand Total</span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(Math.max(grandTotal, 0), form.currency)}
            </span>
          </div>
        </SectionCard>

        {/* ── Extra Info ── */}
        <SectionCard title="Extra Information" icon={<Tag className="w-4 h-4" />}>
          <FormField label="Notes">
            <textarea
              value={form.notes}
              onChange={e => setField("notes", e.target.value)}
              placeholder="Any additional notes about this receipt…"
              rows={3}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </FormField>

          <FormField label="Tags (comma-separated)">
            <Input
              placeholder="e.g. work, family, reimbursable"
              value={form.tags}
              onChange={e => setField("tags", e.target.value)}
              className="rounded-xl"
            />
          </FormField>

          {/* Image attachment */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Receipt Image (optional)
            </label>
            {form.imageBase64 ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <img src={form.imageBase64} alt="Receipt" className="w-full max-h-48 object-cover" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-lg w-8 h-8 text-red-500 hover:text-red-600"
                  onClick={() => setField("imageBase64", "")}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 flex flex-col items-center gap-2 text-slate-400 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-500 transition-colors"
              >
                <ImageIcon className="w-7 h-7" />
                <span className="text-sm">Tap to attach an image</span>
              </button>
            )}
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          </div>
        </SectionCard>

        {/* Save button (bottom) */}
        <Button
          onClick={handleSave}
          disabled={createMutation.isPending}
          className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-base font-semibold shadow-lg shadow-emerald-500/20"
        >
          {createMutation.isPending ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving Receipt…</>
          ) : (
            <><CheckCircle2 className="w-5 h-5 mr-2" /> Save Receipt</>
          )}
        </Button>
      </div>
    </div>
  );
}
