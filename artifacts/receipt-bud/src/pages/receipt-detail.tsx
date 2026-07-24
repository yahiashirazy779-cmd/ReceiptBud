import { useRoute, Link, useLocation } from "wouter";
import { useGetReceipt, useDeleteReceipt, useToggleReceiptFavorite } from "@workspace/api-client-react";
import { ArrowLeft, Trash2, Heart, Download, Share2, Tag, Calendar, CreditCard, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { BudMascot } from "@/components/ui/bud-mascot";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

export default function ReceiptDetail() {
  const [, params] = useRoute("/receipt/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const id = params?.id ? parseInt(params.id, 10) : 0;
  
  const { data: receipt, isLoading } = useGetReceipt(id, { 
    query: { enabled: !!id, queryKey: ['getReceipt', id] } 
  });
  
  const deleteMutation = useDeleteReceipt();
  const toggleFavMutation = useToggleReceiptFavorite();

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this receipt?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        toast({ title: "Receipt deleted" });
        setLocation("/history");
      } catch (err) {
        toast({ title: "Failed to delete", variant: "destructive" });
      }
    }
  };

  const handleToggleFav = async () => {
    try {
      await toggleFavMutation.mutateAsync({ id });
    } catch (err) {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (!receipt) return;
    const text = `${receipt.storeName} — ${formatCurrency(receipt.total, receipt.currency)} on ${format(new Date(receipt.date), "MMM d, yyyy")}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Receipt from ReceiptBud", text });
      } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard" });
      } catch (_) {
        toast({ title: "Share not supported on this device", variant: "destructive" });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-3xl mx-auto w-full">
        <Skeleton className="h-8 w-24 mb-8" />
        <div className="glass-card p-8 rounded-3xl">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-32 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-xl font-bold mb-4">Receipt not found</h2>
        <Link href="/history">
          <Button variant="outline">Go Back</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto p-4 md:p-8 overflow-y-auto">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/history">
          <Button variant="ghost" className="text-slate-500 hover:text-slate-900 dark:hover:text-white -ml-4">
            <ArrowLeft className="w-5 h-5 mr-2" /> Back
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleToggleFav}
            className={receipt.isFavorite ? "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" : "text-slate-400 hover:text-slate-600"}
          >
            <Heart className={`w-5 h-5 ${receipt.isFavorite ? "fill-current" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600" onClick={handleShare}>
            <Share2 className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDelete} className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="glass-card rounded-3xl overflow-hidden shadow-sm relative">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />
        
        {/* Receipt Header */}
        <div className="p-5 sm:p-8 border-b border-dashed border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap gap-3 items-start justify-between mb-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white break-words">{receipt.storeName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-slate-500">
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <Calendar className="w-4 h-4 shrink-0" />
                  {format(new Date(receipt.date), 'MMM d, yyyy')}
                </div>
                <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-md font-medium whitespace-nowrap">
                  <Tag className="w-3.5 h-3.5 shrink-0" />
                  {receipt.category}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl sm:text-4xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
                {formatCurrency(receipt.total, receipt.currency)}
              </div>
              {receipt.paymentMethod && (
                <div className="flex items-center justify-end gap-1 mt-2 text-sm text-slate-500">
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span className="capitalize">{receipt.paymentMethod}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="p-5 sm:p-8">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Purchased Items</h3>
          <div className="space-y-3 mb-8">
            {receipt.items && receipt.items.length > 0 ? (
              receipt.items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 group">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-medium text-slate-500 shrink-0 mt-0.5">
                    {item.quantity || 1}x
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white break-words">{item.name}</p>
                    {item.category && <p className="text-xs text-slate-500 mt-0.5">{item.category}</p>}
                  </div>
                  <div className="font-medium text-slate-900 dark:text-white shrink-0 ml-2">
                    {formatCurrency(item.price, receipt.currency)}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 italic">No line items extracted.</p>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2 text-sm">
            {receipt.tax != null && (
              <div className="flex justify-between text-slate-500">
                <span>Tax</span>
                <span>{formatCurrency(receipt.tax, receipt.currency)}</span>
              </div>
            )}
            {receipt.discount != null && receipt.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>-{formatCurrency(receipt.discount, receipt.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-2">
              <span>Total</span>
              <span>{formatCurrency(receipt.total, receipt.currency)}</span>
            </div>
          </div>
        </div>

        {/* AI Insight */}
        {receipt.aiInsight && (
          <div className="m-8 p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-100 dark:border-emerald-800/50">
            <div className="flex items-start gap-4">
              <div className="hidden sm:block">
                <BudMascot size={60} emotion="happy" floating={false} />
              </div>
              <div>
                <h4 className="font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  Bud's Take
                </h4>
                <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed text-sm">
                  {receipt.aiInsight}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Image Attachment (Placeholder visual if base64 absent) */}
        {receipt.imageBase64 && (
          <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Original Image</h3>
            <img src={`data:image/jpeg;base64,${receipt.imageBase64}`} alt="Receipt scan" className="w-full max-w-sm rounded-xl border border-slate-200 shadow-sm" />
          </div>
        )}
      </div>
    </div>
  );
}
