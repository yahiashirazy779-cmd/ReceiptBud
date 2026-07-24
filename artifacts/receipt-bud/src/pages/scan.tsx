import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Camera, Upload, X, FileText, CheckCircle2, AlertTriangle,
  RefreshCw, Globe, DollarSign, Zap, Star, AlertCircle, Info, PenLine,
} from "lucide-react";
import { useScanReceipt, useCreateReceipt } from "@workspace/api-client-react";
import { BudMascot } from "@/components/ui/bud-mascot";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Bud's scanning messages — cycles during AI processing
const BUD_MESSAGES = [
  "Reading your receipt...",
  "Finding your purchases...",
  "Detecting the language...",
  "Translating item names...",
  "Analyzing your spending...",
  "Calculating totals...",
  "Finding smart insights...",
  "Almost done...",
];

// Compress an image to reduce upload size (target ~800px max dimension, 0.8 quality)
async function compressImage(dataUrl: string, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl); // fallback: use original
    img.src = dataUrl;
  });
}

// Accuracy color
function accuracyColor(score: number) {
  if (score >= 85) return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30";
  if (score >= 60) return "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30";
  return "text-red-600 bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30";
}

export default function Scan() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [budMessageIdx, setBudMessageIdx] = useState(0);
  const [scannedData, setScannedData] = useState<any | null>(null);
  const [scanError, setScanError] = useState<"blurry" | "partial" | "failed" | "ratelimit" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scanMutation = useScanReceipt();
  const createMutation = useCreateReceipt();

  // Cycle Bud messages while scanning
  const startMessageCycle = useCallback(() => {
    setBudMessageIdx(0);
    messageTimerRef.current = setInterval(() => {
      setBudMessageIdx((i) => (i + 1) % BUD_MESSAGES.length);
    }, 2200);
  }, []);

  const stopMessageCycle = useCallback(() => {
    if (messageTimerRef.current) {
      clearInterval(messageTimerRef.current);
      messageTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopMessageCycle(), [stopMessageCycle]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", description: "Please upload an image (JPG, PNG, WebP).", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const raw = event.target?.result as string;
      // Compress before display + upload
      const compressed = await compressImage(raw);
      setImagePreview(compressed);
      setScanError(null);
      startScanning(compressed);
    };
    reader.readAsDataURL(file);
  };

  const startScanning = async (base64: string) => {
    startMessageCycle();
    try {
      const base64Data = base64.split(",")[1];
      const result = await scanMutation.mutateAsync({ data: { imageBase64: base64Data, mimeType: "image/jpeg" } });
      stopMessageCycle();

      const data = result as any;

      // Handle blurry / unreadable
      if (data.isBlurry && !data.items?.length) {
        setScanError("blurry");
        setImagePreview(null);
        return;
      }
      if (data.partiallyReadable) {
        setScanError("partial");
      }

      setScannedData(data);
      toast({ title: "Scan complete!", description: "Bud extracted the receipt details." });
    } catch (err: any) {
      stopMessageCycle();
      setImagePreview(null);

      // Extract error detail from Orval/fetch error
      const body = err?.response ? await err.response.json().catch(() => null) : null;
      const code = body?.code;
      const message = body?.error;

      if (code === "RATE_LIMIT") {
        setScanError("ratelimit");
        toast({ title: "AI quota exceeded", description: message ?? "Please wait a moment and try again.", variant: "destructive" });
      } else if (code === "MODEL_UNAVAILABLE") {
        setScanError("failed");
        toast({ title: "AI unavailable", description: message ?? "Please try again shortly.", variant: "destructive" });
      } else {
        setScanError("failed");
        toast({ title: "Scan failed", description: message ?? "Could not read receipt. Try a clearer image.", variant: "destructive" });
      }
    }
  };

  const handleSave = async () => {
    if (!scannedData) return;
    try {
      const receiptInput = {
        storeName: scannedData.storeName || "Unknown Store",
        date: scannedData.date || new Date().toISOString().split("T")[0],
        total: scannedData.total || 0,
        ...(scannedData.tax != null ? { tax: scannedData.tax } : {}),
        ...(scannedData.discount != null && scannedData.discount > 0 ? { discount: scannedData.discount } : {}),
        ...(scannedData.paymentMethod ? { paymentMethod: scannedData.paymentMethod } : {}),
        category: scannedData.category || "Other",
        items: (scannedData.items || []).map((it: any) => ({
          name: it.name,
          price: it.price,
          ...(it.quantity != null ? { quantity: it.quantity } : {}),
          ...(it.category ? { category: it.category } : {}),
        })),
        ...(scannedData.currency ? { currency: scannedData.currency } : {}),
        ...(scannedData.aiInsight ? { aiInsight: scannedData.aiInsight } : {}),
        ...(imagePreview ? { imageBase64: imagePreview.split(",")[1] } : {}),
      };
      const res = await createMutation.mutateAsync({ data: receiptInput });
      toast({ title: "Receipt saved!" });
      setLocation(`/receipt/${res.id}`);
    } catch {
      toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
    }
  };

  const reset = () => {
    setImagePreview(null);
    setScannedData(null);
    setScanError(null);
    stopMessageCycle();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex-1 w-full max-w-2xl mx-auto p-4 md:p-8 flex flex-col min-h-full">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Scan Receipt</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          Supports receipts in 11+ languages — Bud auto-detects and translates.
        </p>
      </header>

      <AnimatePresence mode="wait">
        {/* ─── UPLOAD STATE ─── */}
        {!imagePreview && !scanError && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col gap-4"
          >
            {/* Drop zone */}
            <div
              className={cn(
                "flex-1 min-h-[340px] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-8 transition-all",
                "bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm",
                isDragging
                  ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-500/10 scale-[1.01]"
                  : "border-slate-300 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) processFile(file);
              }}
            >
              <motion.div
                animate={{ scale: isDragging ? 1.1 : 1 }}
                className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mb-6 shadow-inner"
              >
                <Camera className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </motion.div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2 text-center">
                Scan any receipt
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-center max-w-xs mb-4 text-sm leading-relaxed">
                Drag & drop, take a photo, or upload. Works with printed receipts, screenshots, and email receipts.
              </p>

              {/* Language badges */}
              <div className="flex flex-wrap justify-center gap-1.5 mb-8 max-w-xs">
                {["EN", "AR", "FR", "ES", "DE", "IT", "PT", "TR", "HI", "ZH", "JA"].map((lang) => (
                  <span key={lang} className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md border border-slate-200 dark:border-slate-700">
                    {lang}
                  </span>
                ))}
                <span className="px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 rounded-md">+more</span>
              </div>

              <div className="flex gap-3 w-full max-w-xs">
                <Button
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-12 shadow-md shadow-emerald-500/20"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute("capture");
                      fileInputRef.current.click();
                    }
                  }}
                >
                  <Upload className="w-4 h-4 mr-2" /> Upload
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl h-12 border-slate-300 dark:border-slate-600"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.setAttribute("capture", "environment");
                      fileInputRef.current.click();
                    }
                  }}
                >
                  <Camera className="w-4 h-4 mr-2" /> Camera
                </Button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              {/* Divider */}
              <div className="flex items-center gap-3 w-full max-w-xs">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-400 font-medium">or</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              {/* Manual entry */}
              <Button
                variant="outline"
                className="w-full max-w-xs rounded-xl h-12 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                onClick={() => setLocation("/manual-entry")}
              >
                <PenLine className="w-4 h-4 mr-2" /> Add Receipt Manually
              </Button>
            </div>

            {/* Tips */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-4 text-sm text-slate-500 dark:text-slate-400 space-y-1.5">
              <p className="font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-500" /> Tips for best results
              </p>
              <p>• Printed receipt: lay flat on a contrasting surface</p>
              <p>• Screenshot: crop tightly around the receipt text</p>
              <p>• Email receipt: save as image and upload</p>
              <p>• Avoid glare and shadows — natural light works best</p>
              <p>• Images are compressed automatically before upload</p>
            </div>
          </motion.div>
        )}

        {/* ─── SCANNING STATE ─── */}
        {imagePreview && scanMutation.isPending && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-8"
          >
            <BudMascot size={100} emotion="think" />

            <AnimatePresence mode="wait">
              <motion.div
                key={budMessageIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                  {BUD_MESSAGES[budMessageIdx]}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">AI is analyzing every detail</p>
              </motion.div>
            </AnimatePresence>

            {/* Receipt preview with scanning laser */}
            <div className="w-full max-w-sm h-64 relative rounded-2xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-700">
              <img src={imagePreview} alt="Receipt" className="w-full h-full object-cover opacity-40 grayscale" />

              {/* Scanning laser */}
              <motion.div
                className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_20px_6px_rgba(16,185,129,0.6)] z-10"
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
              />
              {/* Corner brackets */}
              {[
                "top-2 left-2 border-t-2 border-l-2 rounded-tl-lg",
                "top-2 right-2 border-t-2 border-r-2 rounded-tr-lg",
                "bottom-2 left-2 border-b-2 border-l-2 rounded-bl-lg",
                "bottom-2 right-2 border-b-2 border-r-2 rounded-br-lg",
              ].map((cls, i) => (
                <div key={i} className={cn("absolute w-5 h-5 border-emerald-400 z-20", cls)} />
              ))}
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-emerald-500/10 pointer-events-none" />
            </div>

            {/* Progress dots */}
            <div className="flex gap-1.5">
              {BUD_MESSAGES.map((_, i) => (
                <motion.div
                  key={i}
                  className={cn("h-1.5 rounded-full", i <= budMessageIdx ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700")}
                  animate={{ width: i === budMessageIdx ? 24 : 6 }}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── ERROR STATES ─── */}
        {scanError && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-6 text-center"
          >
            <BudMascot size={90} emotion="sad" />
            {scanError === "blurry" && (
              <>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Receipt is too blurry</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-xs">
                    Bud couldn't read the text clearly. Please retake the photo with better lighting and a steady hand.
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300 max-w-sm space-y-1">
                  <p className="font-medium">Tips for a better photo:</p>
                  <p>• Hold phone steady and tap to focus</p>
                  <p>• Use natural or bright light</p>
                  <p>• Lay receipt flat without wrinkles</p>
                </div>
              </>
            )}
            {scanError === "failed" && (
              <>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Scan failed</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-xs">
                    Something went wrong. Please try again with a clearer image.
                  </p>
                </div>
              </>
            )}
            {scanError === "ratelimit" && (
              <>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">AI quota exceeded</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-xs">
                    Too many requests in a short time. Please wait about a minute and try again.
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-4 text-sm text-blue-700 dark:text-blue-300 max-w-sm text-center">
                  Bud will be ready again shortly ⏳
                </div>
              </>
            )}
            <Button
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-12 px-8 shadow-md shadow-emerald-500/20"
              onClick={reset}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </motion.div>
        )}

        {/* ─── RESULT STATE ─── */}
        {scannedData && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-5"
          >
            {/* Success header */}
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-500/30">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-emerald-900 dark:text-emerald-100">Scan Successful!</h3>
                  <p className="text-emerald-700 dark:text-emerald-300 text-xs">Review and save below.</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={reset} className="text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-xl">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Partial/uncertain warning */}
            {(scanError === "partial" || scannedData.uncertainItems?.length > 0) && (
              <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    {scanError === "partial" ? "Partially readable receipt" : "Some items have low confidence"}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">
                    Please review the highlighted items below and correct any errors before saving.
                  </p>
                  {scannedData.uncertainItems?.length > 0 && (
                    <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">
                      Uncertain: {scannedData.uncertainItems.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Scan metadata strip */}
            <div className="grid grid-cols-3 gap-3">
              {/* Confidence */}
              <div className={cn("rounded-2xl border p-3 text-center", accuracyColor(scannedData.confidenceScore ?? 90))}>
                <Zap className="w-4 h-4 mx-auto mb-1" />
                <div className="text-lg font-bold leading-none">{scannedData.confidenceScore ?? "—"}%</div>
                <div className="text-xs mt-0.5 opacity-80">Confidence</div>
              </div>
              {/* Language */}
              <div className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-3 text-center text-blue-600 dark:text-blue-400">
                <Globe className="w-4 h-4 mx-auto mb-1" />
                <div className="text-sm font-bold leading-tight">{scannedData.detectedLanguage ?? "Auto"}</div>
                <div className="text-xs mt-0.5 opacity-80">Language</div>
              </div>
              {/* Currency */}
              <div className="rounded-2xl border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 p-3 text-center text-purple-600 dark:text-purple-400">
                <DollarSign className="w-4 h-4 mx-auto mb-1" />
                <div className="text-sm font-bold leading-tight">{scannedData.currency ?? "USD"}</div>
                <div className="text-xs mt-0.5 opacity-80">Currency</div>
              </div>
            </div>

            {/* Receipt summary card */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-md overflow-hidden">
              {/* Store + total header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">
                    {scannedData.category}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">{scannedData.storeName}</h2>
                  <div className="text-slate-500 text-sm mt-0.5 flex items-center gap-2">
                    {scannedData.date}
                    {scannedData.time && <span>· {scannedData.time}</span>}
                    {scannedData.paymentMethod && (
                      <span className="capitalize px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">
                        {scannedData.paymentMethod}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {scannedData.total?.toFixed(2)}
                    <span className="text-sm font-normal text-slate-400 ml-1">{scannedData.currency ?? "USD"}</span>
                  </div>
                  {scannedData.tax != null && (
                    <div className="text-xs text-slate-400 mt-0.5">Tax: {scannedData.tax?.toFixed(2)}</div>
                  )}
                  {scannedData.discount != null && scannedData.discount > 0 && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Savings: {scannedData.discount?.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              {/* Items list */}
              {scannedData.items?.length > 0 && (
                <div className="p-5">
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" /> Items ({scannedData.items.length})
                  </h4>
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {scannedData.items.map((item: any, i: number) => {
                      const uncertain = item.uncertain || scannedData.uncertainItems?.includes(item.name);
                      return (
                        <div key={i} className={cn(
                          "flex justify-between items-start text-sm rounded-xl px-3 py-2",
                          uncertain
                            ? "bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20"
                            : "bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                        )}>
                          <div className="flex gap-2 min-w-0">
                            <span className="text-slate-400 flex-shrink-0">{item.quantity ?? 1}×</span>
                            <div className="min-w-0">
                              <span className={cn("font-medium truncate block", uncertain ? "text-amber-700 dark:text-amber-300" : "text-slate-700 dark:text-slate-300")}>
                                {item.name}
                              </span>
                              {item.originalName && item.originalName !== item.name && (
                                <div className="text-xs text-slate-400 mt-0.5 truncate">{item.originalName}</div>
                              )}
                            </div>
                            {uncertain && <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />}
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-white flex-shrink-0 ml-3">
                            {item.price != null ? item.price.toFixed(2) : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* OCR accuracy bar */}
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <Star className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>OCR Accuracy</span>
                    <span className="font-medium">{scannedData.ocrAccuracy ?? "High"}</span>
                  </div>
                  <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className={cn("h-full rounded-full", (scannedData.confidenceScore ?? 90) >= 85 ? "bg-emerald-500" : (scannedData.confidenceScore ?? 90) >= 60 ? "bg-amber-400" : "bg-red-400")}
                      initial={{ width: 0 }}
                      animate={{ width: `${scannedData.confidenceScore ?? 90}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                    />
                  </div>
                </div>
              </div>

              {/* AI insight */}
              {scannedData.aiInsight && (
                <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-3">
                    <BudMascot size={36} floating={false} emotion="happy" />
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">Bud's Insight</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 italic leading-relaxed">
                        "{scannedData.aiInsight}"
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pb-8">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-12 border-slate-300 dark:border-slate-600"
                onClick={reset}
              >
                Discard
              </Button>
              <Button
                className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-12 shadow-lg shadow-emerald-500/20"
                onClick={handleSave}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  "Save Receipt"
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
