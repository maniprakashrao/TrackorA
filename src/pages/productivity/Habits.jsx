import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Calendar, Lock, BarChart3, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/supabaseClient.js';

export default function Habits() {
  const [habits, setHabits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Real-time System Date References
  const todayObj = new Date();
  const currentYear = todayObj.getFullYear();
  const todayStr = `${currentYear}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
  
  // Custom Confirmation Modal States
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // States matching layout constraints
  const [expandedMonthIdx, setExpandedMonthIdx] = useState(todayObj.getMonth());
  const [expandedWeekIdx, setExpandedWeekIdx] = useState(0);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitTarget, setNewHabitTarget] = useState(7); // Default target matches insert baseline specs

  const daysOfWeekLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // --- 🗓️ Month-to-Week Matrix Generator ---
  const getMonthWeeksMatrix = (monthIndex) => {
    const firstDayIndex = new Date(currentYear, monthIndex, 1).getDay();
    const seedDate = new Date(currentYear, monthIndex, 1);
    seedDate.setDate(seedDate.getDate() - firstDayIndex);

    const weeks = [];
    for (let w = 0; w < 4; w++) { 
      const currentWeek = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = `${seedDate.getFullYear()}-${String(seedDate.getMonth() + 1).padStart(2, '0')}-${String(seedDate.getDate()).padStart(2, '0')}`;
        currentWeek.push({
          dayNum: seedDate.getDate(),
          dateStr,
          label: daysOfWeekLabels[d],
          isCurrentMonth: seedDate.getMonth() === monthIndex,
          dateObj: new Date(seedDate)
        });
        seedDate.setDate(seedDate.getDate() + 1);
      }
      weeks.push(currentWeek);
    }
    return weeks;
  };

  // Sync data from Supabase
  const loadHabitWorkspace = async () => {
    try {
      setLoading(true);
      
      // 1. Resolve active authenticated user context
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // 2. Fetch routines matching your real database columns
      const { data: fetchedHabits, error: habitsErr } = await supabase
        .from('user_habits')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null); // Filters out soft deleted items natively

      if (habitsErr) throw habitsErr;

      // 3. Fetch logs linked cleanly to habit_logs schema columns
      const { data: fetchedLogs, error: logsErr } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', true);

      if (logsErr) throw logsErr;

      // Maps your accurate table columns (`name` and `target_per_week`) directly to frontend components
      const normalizedHabits = (fetchedHabits || []).map(h => ({
        id: h.id,
        name: h.name, 
        target_per_week: h.target_per_week || 7,
        created_at: h.created_at
      }));

      setHabits(normalizedHabits);
      setLogs(fetchedLogs || []);
    } catch (err) {
      console.error("Failed synchronizing habits schema:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHabitWorkspace();
  }, []);

  // Auto-focus matching week when shifting month headers
  useEffect(() => {
    const targetWeeks = getMonthWeeksMatrix(expandedMonthIdx);
    const matchingWeekIdx = targetWeeks.findIndex(week => week.some(d => d.dateStr === todayStr));
    setExpandedWeekIdx(matchingWeekIdx !== -1 ? matchingWeekIdx : 0);
  }, [expandedMonthIdx]);

  const handleCreateHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Inserts using your explicit column layout signatures
      const { error } = await supabase
        .from('user_habits')
        .insert([
          {
            name: newHabitName.trim(),
            target_per_week: parseInt(newHabitTarget, 10),
            user_id: user.id
          }
        ]);

      if (error) throw error;

      setNewHabitName('');
      setShowAddForm(false);
      await loadHabitWorkspace();
    } catch (err) {
      alert("Error logging habit registration parameter: " + err.message);
    }
  };

  const initiateDeleteRequest = (id, e) => {
    e.stopPropagation();
    setDeleteTargetId(id);
    setShowConfirmModal(true);
  };

  const executeConfirmedDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Soft deletes history markers securely from the frontend canvas matching your layout constraints
      const { error } = await supabase
        .from('user_habits')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteTargetId)
        .eq('user_id', user.id);

      if (error) throw error;

      setShowConfirmModal(false);
      setDeleteTargetId(null);
      await loadHabitWorkspace();
    } catch (err) {
      alert("Could not update habit row configuration.");
    }
  };

  const handleToggleDay = async (habitId, dateStr, isWritable) => {
    if (!isWritable) return;

    const matchedLog = logs.find(l => l.habit_id === habitId && l.log_date === dateStr);
    const isCurrentlyLogged = !!matchedLog;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isCurrentlyLogged) {
        // Deletes log record using matching primary keys
        const { error } = await supabase
          .from('habit_logs')
          .delete()
          .eq('id', matchedLog.id)
          .eq('user_id', user.id);

        if (error) throw error;
        setLogs(logs.filter(l => l.id !== matchedLog.id));
      } else {
        // Inserts a new complete metric log sheet
        const { data: newLogRow, error } = await supabase
          .from('habit_logs')
          .insert([
            {
              habit_id: habitId,
              log_date: dateStr,
              logged_date: todayStr, // Syncs timestamp field structures natively
              is_completed: true,
              user_id: user.id
            }
          ])
          .select()
          .single();

        if (error) throw error;
        if (newLogRow) setLogs([...logs, newLogRow]);
      }
    } catch (err) {
      alert("Error tracking day completion node: " + err.message);
    }
  };

  // --- 📈 TIME-AWARE LIFECYCLE FILTERS ---
  const getHabitsActiveInWeek = (weekDaysArr) => {
    const weekEnd = new Date(weekDaysArr[6].dateStr);
    weekEnd.setHours(23,59,59,999);

    return habits.filter(habit => {
      const createdDate = new Date(habit.created_at);
      createdDate.setHours(0,0,0,0);
      return createdDate <= weekEnd;
    });
  };

  const isHabitActiveOnDay = (habit, dayDateStr) => {
    const targetDate = new Date(dayDateStr);
    targetDate.setHours(0,0,0,0);

    const createdDate = new Date(habit.created_at);
    createdDate.setHours(0,0,0,0);
    return targetDate >= createdDate;
  };

  const calculateWeekStats = (habit, weekDaysArr) => {
    return logs.filter(l => 
      l.habit_id === habit.id && 
      weekDaysArr.some(td => td.dateStr === l.log_date && isHabitActiveOnDay(habit, td.dateStr))
    ).length;
  };

  const getWeekTargetLimit = (habit, weekDaysArr) => {
    const activeDaysCount = weekDaysArr.filter(td => isHabitActiveOnDay(habit, td.dateStr)).length;
    return Math.min(activeDaysCount, habit.target_per_week);
  };

  const getWeekCompletionAverage = (weekDaysArr) => {
    const activeHabits = getHabitsActiveInWeek(weekDaysArr);
    let totalCompleted = 0;
    let totalActiveDays = 0;

    activeHabits.forEach(h => {
      const activeDays = weekDaysArr.filter(td => isHabitActiveOnDay(h, td.dateStr)).length;
      totalActiveDays += activeDays;
      totalCompleted += calculateWeekStats(h, weekDaysArr);
    });

    if (totalActiveDays === 0) return 0;
    return Math.round((totalCompleted / totalActiveDays) * 100);
  };

  const getMonthCompletionPercentage = (monthIdx) => {
    const allWeeks = getMonthWeeksMatrix(monthIdx);
    let totalCompleted = 0;
    let totalPossibleSlots = 0;

    allWeeks.forEach(week => {
      const activeHabits = getHabitsActiveInWeek(week);
      activeHabits.forEach(h => {
        const activeDays = week.filter(td => isHabitActiveOnDay(h, td.dateStr)).length;
        totalPossibleSlots += activeDays;
        totalCompleted += calculateWeekStats(h, week);
      });
    });

    if (totalPossibleSlots === 0) return 0;
    return Math.round((totalCompleted / totalPossibleSlots) * 100);
  };

  const renderMiniDonut = (percentage, size = 32, strokeWidth = 3.5) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={radius} className="stroke-zinc-900" strokeWidth={strokeWidth} fill="transparent" />
          <circle 
            cx={size/2} cy={size/2} r={radius} 
            className="stroke-purple-500 transition-all duration-300" 
            strokeWidth={strokeWidth} fill="transparent"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-[8px] font-mono font-bold text-zinc-400">{percentage}%</span>
      </div>
    );
  };

  const getDayProgressPercentage = (dayDateStr) => {
    const aliveHabits = habits.filter(h => isHabitActiveOnDay(h, dayDateStr));
    if (aliveHabits.length === 0) return 0;

    const completedCount = aliveHabits.filter(h => 
      logs.some(l => l.habit_id === h.id && l.log_date === dayDateStr)
    ).length;

    return Math.round((completedCount / aliveHabits.length) * 100);
  };

  const currentMonthWeeks = getMonthWeeksMatrix(expandedMonthIdx);
  const activeHabitsRegistry = habits;

  return (
    <div className="p-0 text-zinc-100 font-sans h-[calc(100vh-8rem)] gap-5 max-w-[1600px] mx-auto relative flex overflow-hidden select-none selection:bg-purple-500/20">
      
      {/* GLOBAL DELETE MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0f0c1b] border border-zinc-800/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-scale-up text-left">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/10 rounded-xl text-red-400 shrink-0 border border-red-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white tracking-tight">Delete Habit Target</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Are you sure you want to delete this habit from this date onwards? Previous historical tracking metrics will be safely preserved.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                type="button" 
                onClick={() => { setShowConfirmModal(false); setDeleteTargetId(null); }}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-xs font-semibold"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={executeConfirmedDelete}
                className="px-5 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl transition-all shadow-lg"
              >
                Delete Habit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. LEFT PANEL: Registry Column */}
      <div className="w-72 bg-[#0f0c1b]/50 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-4 flex flex-col shrink-0 shadow-xl text-left">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Habits Registry</h3>
            <p className="text-[10px] text-zinc-600 mt-0.5">Core active tracking profiles</p>
          </div>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleCreateHabit} className="mb-4 p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3 text-left animate-fade-in">
            <input 
              type="text"
              placeholder="Habit name..."
              value={newHabitName}
              onChange={e => setNewHabitName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500 select-text"
              required
            />
            <div className="flex justify-between items-center gap-2">
              <label className="text-[9px] text-zinc-400 font-bold uppercase">Target/Wk</label>
              <input 
                type="number" min="1" max="7"
                value={newHabitTarget}
                onChange={e => setNewHabitTarget(e.target.value)}
                className="w-12 bg-zinc-950 border border-zinc-800 rounded-md p-1 text-center text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <button type="submit" className="w-full bg-purple-600 text-white text-[10px] font-bold uppercase py-2 rounded-lg">
              Save Profile
            </button>
          </form>
        )}

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/80 [&::-webkit-scrollbar-thumb]:rounded-full">
          {activeHabitsRegistry.map(h => (
            <div key={h.id} className="p-2.5 bg-zinc-900/20 border border-zinc-800/40 rounded-xl flex justify-between items-center group transition-all hover:border-zinc-800">
              <div className="truncate flex-1 pr-2">
                <h4 className="text-xs font-bold text-zinc-300 truncate">{h.name}</h4>
                <p className="text-[9px] font-medium text-zinc-600 mt-0.5">Frequency: {h.target_per_week}x / week</p>
              </div>
              <button 
                onClick={(e) => initiateDeleteRequest(h.id, e)}
                className="text-zinc-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                title="Delete from today onwards"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 2. RIGHT MASTER CANVAS AREA */}
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden text-left">
        
        {/* TOP ROW VIEWPORT LAYER */}
        <div className="w-full bg-[#0b0813]/60 border border-zinc-800/60 rounded-2xl p-2.5 flex items-stretch gap-2 shrink-0 overflow-x-auto min-h-[96px] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-zinc-800/80 [&::-webkit-scrollbar-thumb]:rounded-full">
          {monthNames.map((monthLabel, monthIdx) => {
            const isMonthExpanded = expandedMonthIdx === monthIdx;
            const isCurrentMonthActual = todayObj.getMonth() === monthIdx;
            const monthProgress = getMonthCompletionPercentage(monthIdx);

            if (!isMonthExpanded) {
              return (
                <div
                  key={monthIdx}
                  onClick={() => setExpandedMonthIdx(monthIdx)}
                  className={`w-14 bg-zinc-900/10 hover:bg-zinc-900/40 border rounded-xl flex flex-col items-center justify-center py-2 cursor-pointer transition-all duration-300 shrink-0 gap-1.5 group ${
                    isCurrentMonthActual ? 'border-purple-500/30 bg-purple-950/5' : 'border-zinc-800/40'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 group-hover:text-zinc-200">
                    {monthLabel.substring(0, 3)}
                  </span>
                  {renderMiniDonut(monthProgress, 28, 3)}
                </div>
              );
            }

            return (
              <div
                key={monthIdx}
                className="flex-1 min-w-[140px] bg-[#1a1235]/30 border border-purple-500/30 rounded-xl p-2 flex flex-col items-center justify-center shrink-0 transition-all duration-300"
              >
                <span className="text-xs font-extrabold text-purple-300 uppercase tracking-widest select-none">
                  {monthLabel}
                </span>
                
                <div className="flex items-center gap-1.5 mt-1.5 bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-500/10">
                  {renderMiniDonut(monthProgress, 24, 3)}
                  <span className="text-[9px] font-mono font-bold text-purple-300">Avg</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* BOTTOM ROW VIEWPORT LAYER */}
        <div className="flex-1 flex gap-3 items-stretch bg-[#06040a]/40 border border-zinc-800/40 rounded-2xl p-3 overflow-hidden">
          {currentMonthWeeks.map((weekDaysArr, weekIdx) => {
            const isWeekExpanded = expandedWeekIdx === weekIdx;
            const hasTodayNode = weekDaysArr.some(d => d.dateStr === todayStr);
            const weekProgress = getWeekCompletionAverage(weekDaysArr);
            
            const activeWeekHabits = getHabitsActiveInWeek(weekDaysArr);

            if (!isWeekExpanded) {
              return (
                <div 
                  key={weekIdx}
                  onClick={() => setExpandedWeekIdx(weekIdx)}
                  className={`w-14 bg-zinc-950/20 hover:bg-zinc-900/20 border rounded-xl flex flex-col items-center justify-between py-5 cursor-pointer transition-all duration-300 shrink-0 group ${
                    hasTodayNode ? 'border-purple-500/30 bg-purple-950/5' : 'border-zinc-800/40'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Calendar className={`w-4 h-4 ${hasTodayNode ? 'text-purple-400 animate-pulse' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                    <span className="writing-mode-vertical text-[10px] font-bold tracking-widest text-zinc-400 uppercase pt-2">
                      WEEK {weekIdx + 1}
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[8px] font-bold text-zinc-600 uppercase font-mono mb-1">Avg</span>
                    {renderMiniDonut(weekProgress, 32, 3.5)}
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={weekIdx}
                className="flex-1 min-w-[620px] bg-[#0f0c1b]/10 border border-purple-500/20 rounded-xl p-4 flex flex-col justify-between overflow-hidden transition-all duration-300 animate-fade-in text-left"
              >
                <div className="flex flex-col flex-1 overflow-hidden">
                  
                  {/* Expanded Grid Table Header Bar */}
                  <div className="grid grid-cols-12 gap-2 border-b border-zinc-800/60 pb-2.5 items-center text-[10px] font-bold text-zinc-500 shrink-0">
                    <div className="col-span-3 text-left pl-1 uppercase tracking-wider text-purple-400 flex items-center gap-1.5 font-black">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"/>
                      WEEK {weekIdx + 1} ACTIVE
                    </div>
                    
                    <div className="col-span-2 flex items-center gap-1.5 justify-center text-purple-400">
                      <BarChart3 className="w-3 h-3"/> 
                      {renderMiniDonut(weekProgress, 24, 2.5)}
                    </div>

                    <div className="col-span-7 grid grid-cols-7 gap-1 text-center">
                      {weekDaysArr.map((d, i) => (
                        <div key={i} className={`flex flex-col items-center py-0.5 rounded transition-all ${
                          d.dateStr === todayStr ? 'bg-purple-600 text-white font-extrabold px-1.5 rounded-md shadow' : ''
                        }`}>
                          <span className="text-[9px] font-bold">{d.label}</span>
                          <span className="text-[8px] font-mono opacity-60 mt-0.5">{d.dayNum}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Habit Task Rows Iterator Matrix */}
                  <div className="flex-1 overflow-y-auto space-y-1 py-2 border-b border-zinc-900/60 pr-0.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/80 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {activeWeekHabits.length === 0 ? (
                      <div className="text-center py-12 text-zinc-600 text-xs italic">No habits tracking inside this timeline scope.</div>
                    ) : (
                      activeWeekHabits.map((habit) => {
                        const score = calculateWeekStats(habit, weekDaysArr);
                        const adjustedTarget = getWeekTargetLimit(habit, weekDaysArr);

                        return (
                          <div key={habit.id} className="grid grid-cols-12 gap-2 items-center py-1 bg-zinc-900/10 rounded-lg border border-transparent hover:border-zinc-800/40 transition-all min-h-[36px]">
                            <div className="col-span-3 text-xs font-bold text-zinc-300 truncate pl-2">{habit.name}</div>
                            <div className="col-span-2 text-center text-xs font-mono font-bold text-purple-400/90">
                              {score} <span className="text-zinc-700 font-normal">/ {adjustedTarget}</span>
                            </div>

                            <div className="col-span-7 grid grid-cols-7 gap-1">
                              {weekDaysArr.map((day) => {
                                const isLogged = logs.some(l => l.habit_id === habit.id && l.log_date === day.dateStr);
                                const isAlive = isHabitActiveOnDay(habit, day.dateStr);
                                const isWritable = day.dateStr === todayStr && isAlive;

                                return (
                                  <div 
                                    key={day.dateStr}
                                    onClick={() => isWritable && handleToggleDay(habit.id, day.dateStr, isWritable)}
                                    className={`flex justify-center items-center py-1.5 rounded-md transition-all ${
                                      !isAlive
                                        ? 'bg-transparent cursor-default select-none opacity-20'
                                        : isWritable 
                                        ? 'cursor-pointer bg-purple-500/5 hover:bg-purple-500/15 border border-purple-500/10 scale-105' 
                                        : 'cursor-not-allowed opacity-35'
                                    }`}
                                  >
                                    {!isAlive ? (
                                      <span className="text-xs font-bold text-zinc-600 font-mono tracking-widest">-</span>
                                    ) : isLogged ? (
                                      <CheckCircle2 className="w-4.5 h-4.5 text-purple-500 filter drop-shadow-[0_0_4px_rgba(139,92,246,0.25)]" />
                                    ) : !isWritable ? (
                                      <Lock className="w-3.5 h-3.5 text-zinc-800" />
                                    ) : (
                                      <Circle className="w-4.5 h-4.5 text-purple-400/40 hover:text-purple-400 transition-colors" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* DAILY PROGRESS RING VIEWPORT ROW */}
                  <div className="grid grid-cols-12 gap-2 items-center py-3 text-center bg-[#0b0813]/20 border border-zinc-900 rounded-xl mt-2 shrink-0 select-none">
                    <div className="col-span-5 text-left pl-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Daily Ring Progress
                    </div>
                    <div className="col-span-7 grid grid-cols-7 gap-1 justify-items-center items-center">
                      {weekDaysArr.map((day) => {
                        const dayProgress = getDayProgressPercentage(day.dateStr);
                        return (
                          <div key={day.dateStr} className="flex flex-col items-center">
                            {renderMiniDonut(dayProgress, 26, 3)}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                <div className="pt-2 border-t border-zinc-900 flex justify-between items-center text-[10px] text-zinc-500 font-mono shrink-0 select-none">
                  <span>Segment Bounds:</span>
                  <span className="text-purple-400/70 font-semibold">
                    {weekDaysArr[0].dateObj.toLocaleDateString('en-US', {month:'short', day:'numeric'})} - {weekDaysArr[6].dateObj.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}