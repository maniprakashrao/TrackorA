import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Activity, Zap, Calendar, Briefcase, Target, Plus, Trophy, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../services/supabaseClient.js';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('User');

  // Core Aggregated Metric States
  const [studyHours, setStudyHours] = useState("0.0");
  const [habitRate, setHabitRate] = useState("0%");
  const [studyStreak, setStudyStreak] = useState("0");
  const [upcomingExamsCount, setUpcomingExamsCount] = useState("0");
  const [placementRate, setPlacementRate] = useState("0%");
  const [offersLabel, setOffersLabel] = useState("0 items remaining");
  const [activeGoalsCount, setActiveGoalsCount] = useState("0");

  // Detailed Array Panel States
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [activeGoals, setActiveGoals] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchDashboardSyncEngine();
  }, []);

  const fetchDashboardSyncEngine = async () => {
    try {
      setLoading(true);

      // 1. Resolve current active user session context
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // 2. Sync User Identity Row matching user context id
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();
        
      if (profile?.display_name) setDisplayName(profile.display_name);

      // 3. Sync Lifetime Study Hours & Recent Sessions Activity Feed
      const { data: sessions, error: studyError } = await supabase
        .from('study_sessions')
        .select('duration_seconds, logged_date, notes, study_topics(name, color_hex)')
        .eq('user_id', user.id)
        .order('logged_date', { ascending: false });

      if (studyError) console.error("Study hours sync failure:", studyError.message);

      if (sessions && sessions.length > 0) {
        const totalSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
        setStudyHours((totalSeconds / 3600).toFixed(1));

        const formattedActivity = sessions.slice(0, 3).map(s => ({
          topic: s.study_topics?.name || 'Study Session',
          color: s.study_topics?.color_hex || '#a855f7',
          date: s.logged_date ? new Date(s.logged_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recent',
          duration: `${Math.round(s.duration_seconds / 60)} mins`,
          notes: s.notes || ''
        }));
        setRecentActivity(formattedActivity);
      } else {
        setStudyHours("0.0");
        setRecentActivity([]);
      }

      // 4. Sync Active Study Sequence Day Streak
      let sequenceStreak = 0;
      if (sessions && sessions.length > 0) {
        const uniqueDates = new Set(sessions.map(s => s.logged_date));
        let checkDate = new Date();
        while (uniqueDates.has(checkDate.toISOString().substring(0, 10))) {
          sequenceStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
      setStudyStreak(String(sequenceStreak));

      // 5. Sync Habit Completion Rate for user
      const calendarRange = new Date();
      calendarRange.setDate(calendarRange.getDate() - 6);
      const startRangeStr = calendarRange.toISOString().substring(0, 10);

      const { data: habitsList, error: habitsTableError } = await supabase
        .from('user_habits')
        .select('id')
        .eq('user_id', user.id)
        .is('deleted_at', null);
        
      const { data: weeklyLogs, error: habitsLogError } = await supabase
        .from('habit_logs')
        .select('log_date, is_completed')
        .eq('user_id', user.id)
        .gte('log_date', startRangeStr);

      if (habitsTableError) console.error("Habits table master read fault:", habitsTableError.message);
      if (habitsLogError) console.error("Habits history tracker sync fault:", habitsLogError.message);

      const totalActiveHabitsCount = habitsList ? habitsList.length : 0;
      if (totalActiveHabitsCount > 0 && weeklyLogs) {
        const maxPossibleCompletions = totalActiveHabitsCount * 7;
        const actualCompletions = weeklyLogs.filter(l => l.is_completed === true).length;
        const ratePct = Math.min(100, Math.round((actualCompletions / maxPossibleCompletions) * 100));
        setHabitRate(`${ratePct}%`);
      } else {
        setHabitRate("0%");
      }

      // 6. Live Synchronized Exams Timeline Engine
      const todayStr = new Date().toISOString().substring(0, 10);
      const { data: examsData, error: examsError } = await supabase
        .from('user_exams') 
        .select('id, title, subject, exam_date, deleted_at')
        .eq('user_id', user.id)
        .gte('exam_date', todayStr)
        .order('exam_date', { ascending: true });

      if (examsError) console.error("Exams table synchronizer fault:", examsError.message);

      if (examsData) {
        const activeExams = examsData.filter(e => e.deleted_at === null);
        setUpcomingExamsCount(String(activeExams.length));
        setUpcomingExams(activeExams.slice(0, 2)); 
      } else {
        setUpcomingExamsCount("0");
        setUpcomingExams([]);
      }

      // 7. FIXED: Refactored Funnel Pipeline Rate to display Wishlist vs Remaining advanced stages
      const { data: placementApps, error: placementError } = await supabase
        .from('placement_applications')
        .select('pipeline_stage, deleted_at')
        .eq('user_id', user.id);

      if (placementError) console.error("Placement table synchronizer fault:", placementError.message);

      if (placementApps) {
        const activeApps = placementApps.filter(a => a.deleted_at === null);
        const totalActiveCount = activeApps.length;

        if (totalActiveCount > 0) {
          const wishlistCount = activeApps.filter(a => a.pipeline_stage?.toLowerCase() === 'wishlist').length;
          const remainingCount = totalActiveCount - wishlistCount; // Advanced stages (applied, interview, offer, rejected)

          // Rate represents the ratio of applications that progressed out of the wishlist phase
          const calculationRate = Math.round((remainingCount / totalActiveCount) * 100);

          setPlacementRate(`${calculationRate}%`);
          setOffersLabel(`${remainingCount} active / ${wishlistCount} in wishlist`);
        } else {
          setPlacementRate("0%");
          setOffersLabel("0 active tracks");
        }
      }

      // 8. Live Synchronized User Goals Engine With Subtopics Progress
      const { data: goalsData, error: goalsError } = await supabase
        .from('user_goals') 
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      const { data: subtopicsData, error: subtopicsError } = await supabase
        .from('goal_subtopics')
        .select('goal_id, is_done')
        .eq('user_id', user.id);

      if (goalsError) console.error("Goals synchronizer fault:", goalsError.message);
      if (subtopicsError) console.error("Subtopics synchronizer fault:", subtopicsError.message);

      if (goalsData) {
        const normalizedGoals = goalsData.map(g => {
          const targetSubtopics = subtopicsData ? subtopicsData.filter(s => s.goal_id === g.id) : [];
          
          let percentage = 0;
          if (targetSubtopics.length > 0) {
            const completedCount = targetSubtopics.filter(s => s.is_done === true).length;
            percentage = Math.round((completedCount / targetSubtopics.length) * 100);
          } else {
            percentage = g.is_completed ? 100 : 0;
          }

          return {
            ...g,
            calculatedProgress: percentage,
            isCompleted: percentage >= 100 || g.is_completed === true
          };
        });

        const activeGoalsList = normalizedGoals.filter(g => !g.isCompleted);
        setActiveGoalsCount(String(activeGoalsList.length));
        setActiveGoals(activeGoalsList.length > 0 ? activeGoalsList.slice(0, 3) : normalizedGoals.slice(0, 3));
      } else {
        setActiveGoalsCount("0");
        setActiveGoals([]);
      }

    } catch (err) {
      console.error("Dashboard core initialization sync engine critical fault:", err);
    } finally {
      setLoading(false);
    }
  };

  const metrics = [
    { title: "STUDY HOURS", value: studyHours, label: "lifetime statistics", icon: Clock, path: "/study-tracker" },
    { title: "HABIT RATE", value: habitRate, label: "last 7 days rate", icon: Activity, path: "/habits" },
    { title: "STUDY STREAK", value: studyStreak, label: "consecutive days", icon: Zap, path: "/study-tracker" },
    { title: "EXAMS", value: upcomingExamsCount, label: "upcoming scheduled", icon: Calendar, path: "/exams" },
    { title: "PLACEMENT", value: placementRate, label: offersLabel, icon: Briefcase, path: "/placement" },
    { title: "ACTIVE GOALS", value: activeGoalsCount, label: "milestones pending", icon: Target, path: "/goals" },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100 font-sans selection:bg-purple-500/20 select-none">
      
      {/* Header Profile Welcome Block */}
      <div className="space-y-1 text-left">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Welcome back, <span className="text-[#a855f7]">{displayName}</span>
        </h1>
        <p className="text-zinc-500 text-sm font-medium">Here's your live data ecosystem context at a glance.</p>
      </div>

      {/* Grid of Live Dashboard Tracker Widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((item, idx) => {
          const IconComponent = item.icon;
          return (
            <div 
              key={idx} 
              onClick={() => navigate(item.path)}
              className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-xl p-5 flex flex-col justify-between min-h-[125px] hover:border-purple-500/40 cursor-pointer transition-all duration-300 group shadow-lg"
            >
              <div className="flex justify-between items-start w-full">
                <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase group-hover:text-zinc-400 transition-colors">
                  {item.title}
                </span>
                <div className="w-7 h-7 rounded-lg bg-[#22183d]/50 flex items-center justify-center text-purple-400 border border-purple-500/10 group-hover:border-purple-500/30 transition-all">
                  <IconComponent className="w-3.5 h-3.5" />
                </div>
              </div>
              
              <div className="mt-2 flex flex-col items-start">
                <span className="text-2xl font-black text-white tracking-tight font-mono group-hover:text-purple-300 transition-colors">
                  {loading ? '...' : item.value}
                </span>
                {item.label && (
                  <span className="text-[10px] text-zinc-600 font-medium mt-0.5 tracking-normal block max-w-full truncate">
                    {item.label}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Split preview lists */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Upcoming Exams Card Preview Segment */}
        <div className="lg:col-span-7 bg-[#0f0c1b]/30 backdrop-blur-md border border-zinc-800/50 rounded-xl p-6 flex flex-col justify-between min-h-[260px] text-left">
          <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-purple-400" /> Upcoming exams
            </h3>
            <button onClick={() => navigate('/exams')} className="text-[10px] uppercase font-mono font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Manage Modules
            </button>
          </div>
          
          <div className="flex-1 flex flex-col justify-center mt-3">
            {loading ? (
              <p className="text-xs font-mono text-zinc-600 text-center py-6 animate-pulse">Syncing timeline elements...</p>
            ) : upcomingExams.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs font-medium text-zinc-500">No upcoming exam modules logged inside backend rows.</p>
                <button onClick={() => navigate('/exams')} className="text-xs text-purple-400 font-medium hover:text-purple-300 underline underline-offset-4 mt-2 transition-colors">
                  Schedule your first exam module →
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingExams.map((exam) => (
                  <div key={exam.id} className="p-3 bg-zinc-950/40 border border-zinc-900 rounded-xl flex justify-between items-center transition-colors hover:border-zinc-800">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200">{exam.title}</h4>
                      <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-tight block mt-0.5">Subject Stream: {exam.subject || 'Core'}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-950/30 border border-purple-500/20 px-2.5 py-1 rounded-lg">
                      {new Date(exam.exam_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Goals Tracking Progress Card Segment */}
        <div className="lg:col-span-5 bg-[#0f0c1b]/30 backdrop-blur-md border border-zinc-800/50 rounded-xl p-6 min-h-[260px] flex flex-col justify-between text-left">
          <div className="flex justify-between items-center mb-4 border-b border-zinc-900 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
              <Target className="w-4 h-4 text-purple-400" /> Key Target Goals
            </h3>
            <button onClick={() => navigate('/goals')} className="text-[10px] uppercase font-mono font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Adjust Goals
            </button>
          </div>
          
          <div className="flex-1 flex flex-col justify-center">
            {loading ? (
              <p className="text-xs font-mono text-zinc-600 text-center py-6 animate-pulse">Syncing key benchmarks...</p>
            ) : activeGoals.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs font-medium text-zinc-500">No milestone tracking targets found.</p>
                <button onClick={() => navigate('/goals')} className="text-xs text-purple-400 font-medium hover:text-purple-300 underline underline-offset-4 mt-2 transition-colors">
                  Generate target benchmark →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeGoals.map((goal) => {
                  const pct = goal.calculatedProgress ?? 0;
                  return (
                    <div key={goal.id} className="space-y-1.5 animate-fade-in">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-300 font-bold truncate max-w-[70%]">{goal.title}</span>
                        <span className="text-purple-400 font-mono font-bold">{pct}%</span>
                      </div>
                      <div className="w-full bg-[#1a162e] h-2 rounded-full overflow-hidden border border-zinc-900 shadow-inner">
                        <div 
                          className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${pct}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent History Activity Logs Feed Container */}
      <div className="bg-[#0f0c1b]/30 backdrop-blur-md border border-zinc-800/50 rounded-xl p-6 min-h-[200px] flex flex-col text-left">
        <div className="flex items-center gap-2 mb-4 border-b border-zinc-900 pb-3">
          <Trophy className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 font-mono">Recent Study History Pipeline Records</h3>
        </div>
        
        <div className="flex-1 flex flex-col justify-center select-text">
          {loading ? (
            <p className="text-xs font-mono text-zinc-600 text-center py-6 animate-pulse">Gathering history aggregates...</p>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-4 select-none">
              <p className="text-xs font-medium text-zinc-500">No session rows verified on your current profile instance yet.</p>
              <button onClick={() => navigate('/study-tracker')} className="text-xs text-purple-400 font-medium hover:text-purple-300 underline underline-offset-4 mt-2 transition-colors">
                Log your first study session track →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentActivity.map((act, idx) => (
                <div key={idx} className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl flex flex-col justify-between gap-2.5 transition-colors hover:border-zinc-800">
                  <div className="flex justify-between items-start gap-2 select-none">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: act.color }} />
                      <h4 className="text-xs font-black text-zinc-200 truncate">{act.topic}</h4>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-600 font-bold shrink-0 uppercase tracking-tight">{act.date}</span>
                  </div>
                  {act.notes && (
                    <p className="text-[11px] font-sans text-zinc-500 line-clamp-2 italic leading-relaxed">
                      "{act.notes}"
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-[9px] font-mono text-purple-400/90 font-black pt-1 select-none border-t border-zinc-900/50">
                    <CheckCircle2 className="w-3 h-3 text-purple-500"/> Completed: {act.duration}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}