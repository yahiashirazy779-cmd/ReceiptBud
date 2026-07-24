import React, { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import Layout from "@/components/layout";
import Splash from "@/pages/splash";
import Home from "@/pages/home";
import Scan from "@/pages/scan";
import History from "@/pages/history";
import ReceiptDetail from "@/pages/receipt-detail";
import Budgets from "@/pages/budgets";
import Analytics from "@/pages/analytics";
import Chat from "@/pages/chat";
import Achievements from "@/pages/achievements";
import Settings from "@/pages/settings";
import Subscriptions from "@/pages/subscriptions";
import ManualEntry from "@/pages/manual-entry";
import NotFound from "@/pages/not-found";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(151 83% 34%)",
    colorForeground: "hsl(218 17% 20%)",
    colorMutedForeground: "hsl(218 17% 45%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(0 0% 100%)",
    colorInputForeground: "hsl(218 17% 20%)",
    colorNeutral: "hsl(218 17% 90%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "1rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white dark:bg-slate-900 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-slate-100 dark:border-slate-800",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold text-slate-900 dark:text-white",
    headerSubtitle: "text-slate-500 dark:text-slate-400",
    socialButtonsBlockButtonText: "text-slate-700 dark:text-slate-300 font-medium",
    formFieldLabel: "text-slate-700 dark:text-slate-300 font-medium",
    footerActionLink: "text-emerald-600 hover:text-emerald-700 font-semibold",
    footerActionText: "text-slate-500 dark:text-slate-400",
    dividerText: "text-slate-400 dark:text-slate-500",
    identityPreviewEditButton: "text-emerald-600 hover:text-emerald-700",
    formFieldSuccessText: "text-emerald-600",
    alertText: "text-red-600 dark:text-red-400",
    logoBox: "flex justify-center mb-4",
    logoImage: "h-12 w-12",
    socialButtonsBlockButton: "border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
    formButtonPrimary: "bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all",
    formFieldInput: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg text-slate-900 dark:text-white",
    footerAction: "bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 py-4",
    dividerLine: "bg-slate-200 dark:bg-slate-700",
    alert: "bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800/50 rounded-lg",
    otpCodeFieldInput: "border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500",
    formFieldRow: "mb-4",
    main: "gap-6",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50/50 dark:bg-slate-950 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-emerald-500/5 dark:bg-emerald-500/10 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl mix-blend-multiply pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl mix-blend-multiply pointer-events-none" />
      <div className="z-10 w-full max-w-[440px]">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50/50 dark:bg-slate-950 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-emerald-500/5 dark:bg-emerald-500/10 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl mix-blend-multiply pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl mix-blend-multiply pointer-events-none" />
      <div className="z-10 w-full max-w-[440px]">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}

function HomeRedirect() {
  const isFirstVisit = localStorage.getItem('receiptbud_first_visit') !== 'false';
  
  return (
    <>
      <Show when="signed-in">
        <Layout>
          {isFirstVisit ? <Redirect to="/splash" /> : <Home />}
        </Layout>
      </Show>
      <Show when="signed-out">
        <Splash />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <Component />
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator({ queryClient }: { queryClient: QueryClient }) {
  const { addListener } = useClerk();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

const queryClient = new QueryClient();

function ClerkProviderWithRoutes() {
  const [location, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back to ReceiptBud",
            subtitle: "Sign in to keep tracking your spending",
          },
        },
        signUp: {
          start: {
            title: "Join ReceiptBud",
            subtitle: "Meet your AI financial assistant",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator queryClient={queryClient} />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/splash" component={Splash} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            
            <Route path="/scan" component={() => <ProtectedRoute component={Scan} />} />
            <Route path="/history" component={() => <ProtectedRoute component={History} />} />
            <Route path="/receipt/:id" component={() => <ProtectedRoute component={ReceiptDetail} />} />
            <Route path="/budgets" component={() => <ProtectedRoute component={Budgets} />} />
            <Route path="/analytics" component={() => <ProtectedRoute component={Analytics} />} />
            <Route path="/chat" component={() => <ProtectedRoute component={Chat} />} />
            <Route path="/achievements" component={() => <ProtectedRoute component={Achievements} />} />
            <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
            <Route path="/subscriptions" component={() => <ProtectedRoute component={Subscriptions} />} />
            <Route path="/manual-entry" component={() => <ProtectedRoute component={ManualEntry} />} />
            
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
