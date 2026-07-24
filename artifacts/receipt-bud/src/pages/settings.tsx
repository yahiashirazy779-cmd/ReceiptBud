import { useGetMyProfile, useUpdateMyProfile } from "@workspace/api-client-react";
import { useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { LogOut, Moon, Sun, Bell, Globe, DollarSign, User as UserIcon, Check, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useRef } from "react";
import { CURRENCY_LIST, getCurrencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { data: profile, isLoading } = useGetMyProfile();
  const updateProfile = useUpdateMyProfile();
  const { signOut, openUserProfile } = useClerk();
  const { toast } = useToast();

  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem("notifications_enabled") !== "false";
  });
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCurrencyPicker(false);
        setCurrencySearch("");
      }
    };
    if (showCurrencyPicker) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCurrencyPicker]);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    setDarkMode(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (profile) {
      updateProfile.mutate({ data: { theme: isDark ? 'dark' : 'light' } });
    }
  };

  const handleCurrencySelect = (code: string) => {
    updateProfile.mutate(
      { data: { currency: code } },
      {
        onSuccess: () => {
          toast({ title: `Currency updated to ${code}` });
          setShowCurrencyPicker(false);
          setCurrencySearch("");
        },
        onError: () => {
          toast({ title: "Failed to update currency", variant: "destructive" });
        },
      }
    );
  };

  const handleLogout = () => {
    signOut({ redirectUrl: "/" });
  };

  const selectedCurrency = profile?.currency || "USD";
  const selectedSymbol = getCurrencySymbol(selectedCurrency);

  const filteredCurrencies = currencySearch
    ? CURRENCY_LIST.filter(c =>
        c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
        c.label.toLowerCase().includes(currencySearch.toLowerCase())
      )
    : CURRENCY_LIST;

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Settings</h1>
        <p className="text-slate-500">Manage your preferences and app behavior.</p>
      </header>

      <div className="space-y-6">
        
        {/* Profile Section */}
        <section className="glass-card rounded-3xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-emerald-500" /> Profile Information
            </h3>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 text-xl font-bold">
                {profile?.name?.charAt(0) || "U"}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-lg text-slate-900 dark:text-white truncate">{profile?.name || "User"}</h4>
                <p className="text-slate-500 text-sm truncate">{profile?.email || "No email provided"}</p>
              </div>
            </div>
            <Button variant="outline" className="rounded-xl" onClick={() => openUserProfile()}>Edit Profile</Button>
          </div>
        </section>

        {/* Preferences Section */}
        <section className="glass-card rounded-3xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" /> Preferences
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  {darkMode ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">Dark Mode</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Toggle app appearance</p>
                </div>
              </div>
              <Switch checked={darkMode} onCheckedChange={toggleTheme} />
            </div>

            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">Notifications</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Push notifications and alerts</p>
                </div>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={(v) => {
                  setNotificationsEnabled(v);
                  localStorage.setItem("notifications_enabled", String(v));
                  toast({ title: v ? "Notifications enabled" : "Notifications disabled" });
                }}
              />
            </div>

            {/* Currency Picker */}
            <div className="p-6" ref={pickerRef}>
              <button
                className="w-full flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 px-2 py-1 rounded-xl transition-colors"
                onClick={() => { setShowCurrencyPicker(v => !v); setCurrencySearch(""); }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-slate-900 dark:text-white">Currency</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isLoading ? "Loading..." : `${selectedCurrency} (${selectedSymbol}) — display currency`}
                    </p>
                  </div>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", showCurrencyPicker && "rotate-180")} />
              </button>

              {showCurrencyPicker && (
                <div className="mt-3 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-lg">
                  {/* Search */}
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                    <input
                      autoFocus
                      placeholder="Search currencies..."
                      value={currencySearch}
                      onChange={e => setCurrencySearch(e.target.value)}
                      className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  {/* List */}
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/50">
                    {filteredCurrencies.map(cur => (
                      <button
                        key={cur.code}
                        onClick={() => handleCurrencySelect(cur.code)}
                        disabled={updateProfile.isPending}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                          cur.code === selectedCurrency && "bg-emerald-50 dark:bg-emerald-500/10"
                        )}
                      >
                        <span className={cn(
                          "font-medium",
                          cur.code === selectedCurrency ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"
                        )}>
                          {cur.label}
                        </span>
                        {cur.code === selectedCurrency && (
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                      </button>
                    ))}
                    {filteredCurrencies.length === 0 && (
                      <p className="px-4 py-4 text-sm text-slate-500 text-center">No currencies found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 h-14 rounded-2xl text-lg font-medium"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-3" /> Log Out
          </Button>
        </section>

      </div>
    </div>
  );
}
