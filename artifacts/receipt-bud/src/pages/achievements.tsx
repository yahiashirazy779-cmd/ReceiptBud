import { useListAchievements, useGetMyProfile } from "@workspace/api-client-react";
import { Trophy, Star, Lock, Zap } from "lucide-react";
import { BudMascot } from "@/components/ui/bud-mascot";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export default function Achievements() {
  const { data: achievements, isLoading } = useListAchievements();
  const { data: profile } = useGetMyProfile();

  const totalXp = profile?.totalXp ?? 0;
  const currentLevel = profile?.level ?? 1;
  // XP needed grows with level: level * 500
  const nextLevelXp = currentLevel * 500;
  const progress = nextLevelXp > 0 ? Math.min(100, (totalXp / nextLevelXp) * 100) : 0;

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Achievements</h1>
        <p className="text-slate-500">Level up your financial habits.</p>
      </header>

      {/* Level Banner */}
      <div className="glass-card rounded-3xl p-6 md:p-8 mb-10 relative overflow-hidden flex flex-col md:flex-row items-center gap-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="flex-shrink-0 relative">
          <BudMascot size={120} emotion="celebrate" />
          <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-amber-400 to-orange-500 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shadow-lg border-2 border-white dark:border-slate-800">
            {currentLevel}
          </div>
        </div>
        
        <div className="flex-1 w-full relative z-10">
          <div className="flex justify-between items-end mb-2">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" /> Current Level
              </h2>
              <p className="text-slate-500 text-sm mt-1">Keep scanning to level up!</p>
            </div>
            <div className="text-right">
              <span className="font-bold text-lg text-emerald-600">{totalXp}</span>
              <span className="text-slate-400 text-sm"> / {nextLevelXp} XP</span>
            </div>
          </div>
          <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-3">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Badges</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="glass-card p-5 rounded-2xl flex items-start gap-4">
              <Skeleton className="w-14 h-14 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))
        ) : achievements && achievements.length > 0 ? (
          achievements.map((ach) => (
            <div 
              key={ach.id} 
              className={`p-5 rounded-2xl border transition-all ${
                ach.unlocked 
                  ? 'glass-card hover:-translate-y-1 hover:shadow-md' 
                  : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 opacity-60'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${
                  ach.unlocked 
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-500 shadow-inner' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                }`}>
                  {ach.unlocked ? <Star className="w-7 h-7 fill-current" /> : <Lock className="w-6 h-6" />}
                </div>
                <div>
                  <h4 className={`font-bold ${ach.unlocked ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                    {ach.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {ach.description}
                  </p>
                  <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-amber-500">
                    <Zap className="w-3 h-3 fill-current" /> +{ach.xp} XP
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-slate-500">
            No achievements found.
          </div>
        )}
      </div>
    </div>
  );
}
