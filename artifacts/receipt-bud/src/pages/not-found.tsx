import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
        <span className="text-4xl font-bold text-slate-400">?</span>
      </div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Page Not Found</h1>
      <p className="text-slate-500 mb-8 max-w-sm">We couldn't find what you were looking for. It may have been moved or deleted.</p>
      <Link href="/">
        <button className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-emerald-500/20">
          Go Home
        </button>
      </Link>
    </div>
  );
}
