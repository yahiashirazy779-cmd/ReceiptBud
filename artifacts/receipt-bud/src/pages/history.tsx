import React, { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useListReceipts } from "@workspace/api-client-react";
import {
  Search, Filter, SortDesc, Heart, FileText, ChevronRight,
  X, ChevronDown, Check, SlidersHorizontal,
} from "lucide-react";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { CURRENCY_LIST } from "@/lib/currency";

const CATEGORIES = [
  "Groceries", "Transport", "Entertainment", "Restaurants", "Bills",
  "Electronics", "Shopping", "Education", "Pets", "Travel", "Health",
  "Subscriptions", "Other",
];

const PAYMENT_METHODS = ["cash", "card", "credit", "debit", "mobile", "other"];

const SORT_OPTIONS = [
  { value: "newest",   label: "Newest First" },
  { value: "oldest",   label: "Oldest First" },
  { value: "highest",  label: "Highest Amount" },
  { value: "lowest",   label: "Lowest Amount" },
  { value: "storeAZ",  label: "Store Name (A–Z)" },
  { value: "storeZA",  label: "Store Name (Z–A)" },
];

type SortOption = typeof SORT_OPTIONS[number]["value"];

interface Filters {
  startDate: string;
  endDate: string;
  categories: string[];
  currencies: string[];
  paymentMethods: string[];
  minAmount: string;
  maxAmount: string;
}

const EMPTY_FILTERS: Filters = {
  startDate: "", endDate: "", categories: [], currencies: [],
  paymentMethods: [], minAmount: "", maxAmount: "",
};

function hasActiveFilters(f: Filters) {
  return (
    f.startDate || f.endDate || f.categories.length || f.currencies.length ||
    f.paymentMethods.length || f.minAmount || f.maxAmount
  );
}

function activeFilterCount(f: Filters) {
  let n = 0;
  if (f.startDate || f.endDate) n++;
  if (f.categories.length) n++;
  if (f.currencies.length) n++;
  if (f.paymentMethods.length) n++;
  if (f.minAmount || f.maxAmount) n++;
  return n;
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
        active
          ? "bg-emerald-500 border-emerald-500 text-white"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-400"
      )}
    >
      {label}
    </button>
  );
}

export default function History() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showSort, setShowSort] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const { data: receipts, isLoading } = useListReceipts({});

  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSort(false);
      }
    };
    if (showSort) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSort]);

  const toggle = <T extends string>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters(f => ({ ...f, [k]: v }));

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearch("");
  };

  // Available currencies from actual receipts
  const availableCurrencies = useMemo(() => {
    if (!receipts) return [];
    const codes = new Set(receipts.map(r => r.currency || "USD"));
    return CURRENCY_LIST.filter(c => codes.has(c.code));
  }, [receipts]);

  const processedReceipts = useMemo(() => {
    if (!receipts) return [];

    let list = [...receipts];

    // Text search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        r.storeName.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    }

    // Date range
    if (filters.startDate) {
      const start = startOfDay(parseISO(filters.startDate));
      list = list.filter(r => isAfter(new Date(r.date), start) || format(new Date(r.date), "yyyy-MM-dd") === filters.startDate);
    }
    if (filters.endDate) {
      const end = endOfDay(parseISO(filters.endDate));
      list = list.filter(r => isBefore(new Date(r.date), end) || format(new Date(r.date), "yyyy-MM-dd") === filters.endDate);
    }

    // Categories
    if (filters.categories.length) {
      list = list.filter(r => filters.categories.includes(r.category));
    }

    // Currencies
    if (filters.currencies.length) {
      list = list.filter(r => filters.currencies.includes(r.currency || "USD"));
    }

    // Payment methods
    if (filters.paymentMethods.length) {
      list = list.filter(r => r.paymentMethod && filters.paymentMethods.includes(r.paymentMethod));
    }

    // Amount range
    if (filters.minAmount !== "") {
      const min = parseFloat(filters.minAmount);
      if (!isNaN(min)) list = list.filter(r => r.total >= min);
    }
    if (filters.maxAmount !== "") {
      const max = parseFloat(filters.maxAmount);
      if (!isNaN(max)) list = list.filter(r => r.total <= max);
    }

    // Sort
    switch (sortBy) {
      case "newest":  list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); break;
      case "oldest":  list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); break;
      case "highest": list.sort((a, b) => b.total - a.total); break;
      case "lowest":  list.sort((a, b) => a.total - b.total); break;
      case "storeAZ": list.sort((a, b) => a.storeName.localeCompare(b.storeName)); break;
      case "storeZA": list.sort((a, b) => b.storeName.localeCompare(a.storeName)); break;
    }

    return list;
  }, [receipts, search, filters, sortBy]);

  const filterCount = activeFilterCount(filters);
  const isFiltered = !!hasActiveFilters(filters) || !!search.trim();
  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? "Sort";

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Receipt History</h1>
        <p className="text-slate-500">All your spending in one place.</p>
      </header>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            placeholder="Search stores, categories..."
            className="pl-10 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          {/* Filter button */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              "h-12 px-4 border rounded-xl flex items-center gap-2 text-sm font-medium transition-colors relative",
              showFilters || filterCount > 0
                ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filter</span>
            {filterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {filterCount}
              </span>
            )}
          </button>

          {/* Sort button */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setShowSort(v => !v)}
              className={cn(
                "h-12 px-4 border rounded-xl flex items-center gap-2 text-sm font-medium transition-colors",
                sortBy !== "newest"
                  ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <SortDesc className="w-4 h-4" />
              <span className="hidden sm:inline truncate max-w-[100px]">{currentSortLabel}</span>
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showSort && "rotate-180")} />
            </button>

            {showSort && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value as SortOption); setShowSort(false); }}
                    className={cn(
                      "w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                      opt.value === sortBy && "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium"
                    )}
                  >
                    {opt.label}
                    {opt.value === sortBy && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      {showFilters && (
        <div className="mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-4 shadow-sm">
          {/* Date range */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Date Range</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">From</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={e => setFilter("startDate", e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">To</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={e => setFilter("endDate", e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Amount range */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Amount Range</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Min</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={filters.minAmount}
                  onChange={e => setFilter("minAmount", e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Max</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Any"
                  value={filters.maxAmount}
                  onChange={e => setFilter("maxAmount", e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Category */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <ToggleChip
                  key={cat}
                  label={cat}
                  active={filters.categories.includes(cat)}
                  onClick={() => setFilter("categories", toggle(filters.categories, cat))}
                />
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Payment Method</p>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_METHODS.map(pm => (
                <ToggleChip
                  key={pm}
                  label={pm.charAt(0).toUpperCase() + pm.slice(1)}
                  active={filters.paymentMethods.includes(pm)}
                  onClick={() => setFilter("paymentMethods", toggle(filters.paymentMethods, pm))}
                />
              ))}
            </div>
          </div>

          {/* Currency — only show if receipts have more than one currency */}
          {availableCurrencies.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Currency</p>
              <div className="flex flex-wrap gap-1.5">
                {availableCurrencies.map(cur => (
                  <ToggleChip
                    key={cur.code}
                    label={cur.code}
                    active={filters.currencies.includes(cur.code)}
                    onClick={() => setFilter("currencies", toggle(filters.currencies, cur.code))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500">
              {processedReceipts.length} receipt{processedReceipts.length !== 1 ? "s" : ""} shown
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 rounded-lg text-xs"
            >
              <X className="w-3.5 h-3.5 mr-1" /> Clear All Filters
            </Button>
          </div>
        </div>
      )}

      {/* Active filter summary bar */}
      {isFiltered && !showFilters && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">
            Showing {processedReceipts.length} result{processedReceipts.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={clearFilters}
            className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        </div>
      )}

      {/* ── Receipt List ── */}
      <div className="flex-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4 p-2">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="w-32 h-5 mb-2" />
                  <Skeleton className="w-20 h-4" />
                </div>
                <Skeleton className="w-16 h-6" />
              </div>
            ))}
          </div>
        ) : processedReceipts.length > 0 ? (
          <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50 pb-nav">
            {processedReceipts.map(receipt => (
              <Link key={receipt.id} href={`/receipt/${receipt.id}`} className="block">
                <div className="p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shadow-inner shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{receipt.storeName}</span>
                      {receipt.isFavorite && <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500 shrink-0" />}
                    </h4>
                    <div className="flex items-center gap-1.5 text-slate-500 mt-0.5 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md font-medium text-xs whitespace-nowrap">
                        {receipt.category}
                      </span>
                      <span className="text-xs whitespace-nowrap">{format(new Date(receipt.date), "MMM d, yyyy")}</span>
                      {receipt.paymentMethod && (
                        <span className="text-xs whitespace-nowrap capitalize text-slate-400">{receipt.paymentMethod}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">
                      {formatCurrency(receipt.total, receipt.currency)}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Search className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No receipts found</h3>
            <p className="text-slate-500 mb-4">
              {isFiltered
                ? "Try adjusting your filters or search query."
                : "We couldn't find any receipts matching your search."}
            </p>
            {isFiltered && (
              <Button variant="outline" onClick={clearFilters} className="rounded-xl">
                Clear All Filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
