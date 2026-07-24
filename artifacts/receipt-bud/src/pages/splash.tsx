import { BudMascot } from "@/components/ui/bud-mascot";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Camera, Target, MessageSquare, Trophy, ArrowRight } from "lucide-react";

export default function Splash() {
  const [step, setStep] = useState(0);

  const STEPS = [
    {
      title: "Meet Bud 🤖",
      desc: "Your AI-powered financial assistant that makes tracking money actually fun.",
      icon: null
    },
    {
      title: "Snap & Go",
      desc: "Just take a picture of your receipt. Bud's AI extracts everything instantly.",
      icon: <Camera className="w-12 h-12 text-emerald-500 mb-6" />
    },
    {
      title: "Smart Budgets",
      desc: "Set limits for categories and Bud will warn you before you overspend.",
      icon: <Target className="w-12 h-12 text-emerald-500 mb-6" />
    },
    {
      title: "Chat with Bud",
      desc: "Ask questions like 'Where did my money go this month?' and get real answers.",
      icon: <MessageSquare className="w-12 h-12 text-emerald-500 mb-6" />
    },
    {
      title: "Level Up",
      desc: "Earn XP and achievements for healthy financial habits. Money is a game now.",
      icon: <Trophy className="w-12 h-12 text-emerald-500 mb-6" />
    }
  ];

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      localStorage.setItem('receiptbud_first_visit', 'false');
      window.location.href = "/sign-up";
    }
  };

  const handleSkip = () => {
    localStorage.setItem('receiptbud_first_visit', 'false');
    window.location.href = "/sign-up";
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-950 items-center justify-center p-6 relative overflow-hidden">
      
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl mix-blend-multiply" />
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-teal-400/20 rounded-full blur-3xl mix-blend-multiply" />
      </div>

      <div className="flex-1 w-full max-w-md flex flex-col items-center justify-center relative z-10">
        
        <div className="h-64 flex items-center justify-center w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center text-center"
            >
              {step === 0 ? (
                <BudMascot size={180} emotion="wave" />
              ) : (
                STEPS[step].icon
              )}
              <h1 className="text-3xl font-bold mt-8 text-slate-900 dark:text-white">
                {STEPS[step].title}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-[280px] text-lg">
                {STEPS[step].desc}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mt-12 mb-8">
          {STEPS.map((_, i) => (
            <div 
              key={i} 
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? "w-8 bg-emerald-500" : "w-2 bg-slate-300 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>

        <div className="w-full flex flex-col gap-3 mt-auto mb-8">
          <Button 
            onClick={handleNext} 
            size="lg" 
            className="w-full text-lg h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
          >
            {step === STEPS.length - 1 ? "Get Started" : "Continue"}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <Button 
            onClick={handleSkip} 
            variant="ghost" 
            size="lg" 
            className="w-full text-slate-500"
          >
            Skip
          </Button>
        </div>
      </div>
      
      {/* Sign in link if already have account */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-10">
        <span className="text-slate-500">Already have an account? </span>
        <Link href="/sign-in">
          <span className="text-emerald-600 font-semibold cursor-pointer">Sign in</span>
        </Link>
      </div>

    </div>
  );
}
