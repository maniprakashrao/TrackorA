import React, { useState, useEffect } from 'react';
import { Award, BookOpen, Flame, Trophy, Target, Sparkles, Lightbulb, CheckCircle2, ShieldCheck, Lock, HelpCircle } from 'lucide-react';
import { supabase } from '../../services/supabaseClient.js';

export default function Achievements() {
  const [loading, setLoading] = useState(true);
  const [hoveredBadgeId, setHoveredBadgeId] = useState(null);
  
  // Dynamic stats state object compiled from databases
  const [stats, setStats] = useState({
    totalStudySessions: 0,
    totalStudyHours: 0,
    studyStreak: 0,
    totalHabitsCreated: 0,
    totalHabitsLogs: 0,
    totalGoalsCreated: 0,
    totalProjectIdeas: 0
  });

  const syncGamificationMetrics = async () => {
    try {
      setLoading(true);

      // 1. Resolve current active user session content
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // 2. Fetch Study Session aggregates isolated to authenticated user
      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('duration_seconds')
        .eq('user_id', user.id);
      
      const studyCount = sessions ? sessions.length : 0;
      const studySeconds = sessions ? sessions.reduce((sum, s) => sum + s.duration_seconds, 0) : 0;
      const studyHours = parseFloat((studySeconds / 3600).toFixed(1));

      // 3. Fetch Active Streak Metric isolated to authenticated user
      let sequenceStreak = 0;
      const { data: streakFunc } = await supabase.rpc('get_user_study_streak');
      if (streakFunc !== null) {
        sequenceStreak = streakFunc;
      } else if (sessions && sessions.length > 0) {
        // Fallback calculations using local timezone mappings
        const uniqueDates = new Set(sessions.map(s => s.logged_date));
        let checkDate = new Date();
        while (uniqueDates.has(checkDate.toISOString().substring(0, 10))) {
          sequenceStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }

      // 4. Fetch Productivity & Academic metrics matching precise schema table keys
      const { count: habitsCount } = await supabase
        .from('user_habits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('deleted_at', null);

      const { count: logsCount } = await supabase
        .from('habit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { count: goalsCount } = await supabase
        .from('user_goals')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('deleted_at', null);

      const { count: ideasCount } = await supabase
        .from('project_ideas')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('deleted_at', null);

      setStats({
        totalStudySessions: studyCount,
        totalStudyHours: studyHours,
        studyStreak: sequenceStreak,
        totalHabitsCreated: habitsCount || 0,
        totalHabitsLogs: logsCount || 0,
        totalGoalsCreated: goalsCount || 0,
        totalProjectIdeas: ideasCount || 0
      });

    } catch (err) {
      console.error("Error gathering achievements:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncGamificationMetrics();
  }, []);

  const totalXP = (stats.totalStudySessions * 15) + 
                  Math.floor(stats.totalStudyHours * 50) + 
                  (stats.studyStreak * 30) + 
                  (stats.totalHabitsCreated * 20) + 
                  (stats.totalHabitsLogs * 10) + 
                  (stats.totalGoalsCreated * 25) + 
                  (stats.totalProjectIdeas * 40);
  
  const computeLevelMatrix = (xp) => {
    let level = 1;
    let xpForCurrentLevel = 0;
    let xpForNextLevel = 500;

    while (xp >= xpForNextLevel) {
      level++;
      xpForCurrentLevel = xpForNextLevel;
      xpForNextLevel += level * 500;
    }

    const levelProgressXP = xp - xpForCurrentLevel;
    const totalLevelRange = xpForNextLevel - xpForCurrentLevel;
    return {
      level,
      progressPct: Math.min(100, Math.round((levelProgressXP / totalLevelRange) * 100)),
      nextLevelRemaining: xpForNextLevel - xp
    };
  };

  const lvlMatrix = computeLevelMatrix(totalXP);

  // --- 🏆 REWARDS DECK CONFIGURATION ---
  const badgesDeck = [
    {
      id: "first_step",
      name: "First Step",
      description: "Logged your first study session",
      icon: BookOpen,
      isUnlocked: stats.totalStudySessions >= 1,
      accent: "text-purple-400 border-purple-500/20 bg-purple-500/10",
      glow: "shadow-[0_0_20px_rgba(139,92,246,0.15)] border-purple-500/40"
    },
    {
      id: "consistent",
      name: "Consistent",
      description: "Logged 10 study sessions",
      icon: Award,
      isUnlocked: stats.totalStudySessions >= 10,
      accent: "text-blue-400 border-blue-500/20 bg-blue-500/10",
      glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)] border-blue-500/40"
    },
    {
      id: "centurion",
      name: "Centurion",
      description: "100 hours of total study time",
      icon: Trophy,
      isUnlocked: stats.totalStudyHours >= 100,
      accent: "text-amber-400 border-amber-500/20 bg-amber-500/10",
      glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)] border-amber-500/40"
    },
    {
      id: "week_warrior",
      name: "Week Warrior",
      description: "7-day study streak",
      icon: Flame,
      isUnlocked: stats.studyStreak >= 7,
      accent: "text-orange-400 border-orange-500/20 bg-orange-500/10",
      glow: "shadow-[0_0_20px_rgba(249,115,22,0.15)] border-orange-500/40"
    },
    {
      id: "unstoppable",
      name: "Unstoppable",
      description: "30-day study streak",
      icon: Sparkles,
      isUnlocked: stats.studyStreak >= 30,
      accent: "text-rose-400 border-rose-500/20 bg-rose-500/10",
      glow: "shadow-[0_0_20px_rgba(244,63,94,0.15)] border-rose-500/40"
    },
    {
      id: "habit_builder",
      name: "Habit Builder",
      description: "Created your first habit row",
      icon: CheckCircle2,
      isUnlocked: stats.totalHabitsCreated >= 1,
      accent: "text-indigo-400 border-indigo-500/20 bg-indigo-500/10",
      glow: "shadow-[0_0_20px_rgba(99,102,241,0.15)] border-indigo-500/40"
    },
    {
      id: "goal_setter",
      name: "Goal Setter",
      description: "Created 5 target milestones",
      icon: Target,
      isUnlocked: stats.totalGoalsCreated >= 5,
      accent: "text-teal-400 border-teal-500/20 bg-teal-500/10",
      glow: "shadow-[0_0_20px_rgba(20,184,166,0.15)] border-teal-500/40"
    },
    {
      id: "secret_innovator",
      name: "Grand Architect",
      description: "Conceived 5 advanced framework project ideas",
      icon: Lightbulb,
      isUnlocked: stats.totalProjectIdeas >= 5,
      isSecret: true,
      accent: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
      glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)] border-emerald-500/40"
    },
    {
      id: "secret_grind",
      name: "Overdrive Protocol",
      description: "Logged 50 custom routine habit completion marks",
      icon: ShieldCheck,
      isUnlocked: stats.totalHabitsLogs >= 50,
      isSecret: true,
      accent: "text-cyan-400 border-cyan-500/20 bg-cyan-500/10",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)] border-cyan-500/40"
    }
  ];

  return (
    <div className="p-6 max-w-[1600px] mx-auto text-zinc-100 font-sans h-[calc(100vh-7rem)] overflow-y-auto pr-1 select-none [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-600/60">
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 text-purple-400 animate-pulse text-xs uppercase tracking-widest font-mono font-bold">
          Assembling Player Experience Matrix...
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* 🌟 USER PROFILE LEVEL HERO BANNER */}
          <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center gap-6 text-left relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 rounded-full filter blur-3xl -mr-20 -mt-20 pointer-events-none transition-all duration-500 group-hover:bg-purple-600/10" />
            
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-purple-600/30 shrink-0 select-none">
              {lvlMatrix.level}
            </div>

            <div className="flex-1 w-full space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 select-none">
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  Level {lvlMatrix.level} <span className="text-xs font-bold text-purple-400 px-2 py-0.5 bg-purple-950/40 border border-purple-500/20 rounded-md uppercase tracking-wider">Rank Active</span>
                </h2>
                <span className="text-[11px] font-mono font-bold text-zinc-500">
                  {totalXP} Total XP • <span className="text-purple-400">{lvlMatrix.nextLevelRemaining} XP</span> to next level
                </span>
              </div>

              <div className="w-full bg-zinc-950 rounded-full h-3 border border-zinc-900 overflow-hidden relative shadow-inner">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-700 ease-out" 
                  style={{ width: `${lvlMatrix.progressPct}%` }} 
                />
              </div>
            </div>
          </div>

          {/* 🏆 ACCOMPLISHMENTS REWARD GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
            {badgesDeck.map((badge) => {
              const IconComp = badge.isSecret && !badge.isUnlocked ? HelpCircle : badge.icon;
              const isCardUnlocked = badge.isUnlocked;
              const displayTitle = badge.isSecret && !badge.isUnlocked ? "????" : badge.name;
              const displayDesc = badge.isSecret && !badge.isUnlocked ? "Keep exploring and deploying projects to unlock this hidden protocol metric." : badge.description;

              return (
                <div 
                  key={badge.id}
                  onMouseEnter={() => setHoveredBadgeId(badge.id)}
                  onMouseLeave={() => setHoveredBadgeId(null)}
                  className={`p-5 border rounded-2xl flex flex-col items-center justify-between text-center transition-all duration-300 h-[185px] relative overflow-hidden group shadow-xl ${
                    isCardUnlocked 
                      ? `bg-[#130f26]/50 ${badge.glow}` 
                      : 'bg-zinc-900/10 border-zinc-900/60'
                  }`}
                >
                  {!isCardUnlocked && (
                    <div className="absolute top-3 right-3 text-zinc-700 select-none pointer-events-none group-hover:text-zinc-500 transition-colors">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className="space-y-3.5 flex flex-col items-center w-full">
                    <div className={`p-3 rounded-xl border flex items-center justify-center transition-transform duration-300 ${
                      isCardUnlocked 
                        ? `${badge.accent} border-purple-500/20 scale-105 group-hover:rotate-6` 
                        : 'bg-zinc-950 border-zinc-900 text-zinc-700'
                    }`}>
                      <IconComp className="w-5 h-5" />
                    </div>

                    <div className="space-y-1.5 w-full px-2">
                      <h4 className={`text-sm font-black tracking-tight truncate transition-colors ${
                        isCardUnlocked ? 'text-zinc-100' : 'text-zinc-500'
                      }`}>
                        {displayTitle}
                      </h4>
                      <p className={`text-xs leading-normal line-clamp-2 ${
                        isCardUnlocked ? 'text-zinc-400' : 'text-zinc-600 italic'
                      }`}>
                        {displayDesc}
                      </p>
                    </div>
                  </div>

                  <div className="text-[9px] font-mono font-black uppercase tracking-widest pt-1.5 border-t border-zinc-900/40 w-full select-none">
                    {isCardUnlocked ? (
                      <span className="text-purple-400 tracking-wider font-extrabold animate-pulse">✓ Unlocked</span>
                    ) : badge.isSecret ? (
                      <span className="text-zinc-700 tracking-wide font-bold">Classified Secret</span>
                    ) : (
                      <span className="text-zinc-600">Locked</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
}