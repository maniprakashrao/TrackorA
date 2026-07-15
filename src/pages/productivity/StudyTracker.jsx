import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Play, Pause, RotateCcw, Calendar, Clock, BookOpen, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../services/supabaseClient.js';

export default function StudyTracker() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopicId, setSelectedTopicId] = useState('');

  // --- ⏱️ MODE ENGINE STATES ---
  const [trackerMode, setTrackerMode] = useState('focus'); 
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  const [customMinutesSetting, setCustomMinutesSetting] = useState(25);
  const [secondsElapsed, setSecondsElapsed] = useState(0); 
  const [countdownSecondsLeft, setCountdownSecondsLeft] = useState(25 * 60); 

  const lastActiveTimestampRef = useRef(null);
  const loopRef = useRef(null);

  // --- 📅 HISTORICAL WEEK TRACKING STATE ---
  const [weekOffset, setWeekOffset] = useState(0);

  // Form Fields & Overlays
  const [newTopicName, setNewTopicName] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Helper utility to generate clean explicit YYYY-MM-DD based on local computer timezone clocks
  const getLocalTodayDateString = () => {
    const d = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const syncWorkspace = async () => {
    try {
      setLoading(true);
      
      // 1. Resolve current active user context
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // 2. Fetch topics restricted strictly to authenticated session user ID
      const { data: topicsData, error: topicsErr } = await supabase
        .from('study_topics')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (topicsErr) throw topicsErr;

      // 3. Fetch study sessions logs locked tightly to active session user ID
      const { data: sessionsData, error: sessionsErr } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.id);

      if (sessionsErr) throw sessionsErr;

      // 4. Compile relational maps natively inside application memory structures
      const compiledTopics = (topicsData || []).map(topic => {
        const associatedSessions = (sessionsData || [])
          .filter(s => s.topic_id === topic.id)
          .map(s => ({
            id: s.id,
            duration_seconds: s.duration_seconds,
            logged_date: s.logged_date,
            created_at: s.created_at
          }));

        return {
          id: topic.id,
          name: topic.name,
          color_hex: topic.color_hex || '#a855f7',
          study_sessions: associatedSessions
        };
      });

      setTopics(compiledTopics);
      
      if (compiledTopics.length > 0) {
        if (!selectedTopicId || !compiledTopics.some(t => t.id === selectedTopicId)) {
          setSelectedTopicId(compiledTopics[0].id);
        }
      } else {
        setSelectedTopicId('');
      }
    } catch (err) {
      console.error("Workspace ledger synchronization error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncWorkspace();
  }, []);

  useEffect(() => {
    if (!isTimerRunning && trackerMode === 'timer') {
      setCountdownSecondsLeft(customMinutesSetting * 60);
    }
  }, [customMinutesSetting, trackerMode]);

  // --- 🔒 BACKGROUND PERSISTENT TICK LOOP ---
  useEffect(() => {
    if (isTimerRunning) {
      lastActiveTimestampRef.current = performance.now();
      
      const tickLoop = () => {
        const rightNow = performance.now();
        const deltaSeconds = (rightNow - lastActiveTimestampRef.current) / 1000;
        
        if (deltaSeconds >= 1) {
          const wholeSecondsElapsed = Math.floor(deltaSeconds);
          lastActiveTimestampRef.current += wholeSecondsElapsed * 1000;

          if (trackerMode === 'focus') {
            setSecondsElapsed(prev => prev + wholeSecondsElapsed);
          } else {
            setCountdownSecondsLeft(prev => {
              if (prev <= wholeSecondsElapsed) {
                setIsTimerRunning(false);
                handleAutoLogSession(customMinutesSetting * 60);
                return customMinutesSetting * 60;
              }
              return prev - wholeSecondsElapsed;
            });
          }
        }
        loopRef.current = requestAnimationFrame(tickLoop);
      };
      
      loopRef.current = requestAnimationFrame(tickLoop);
    } else {
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    }

    return () => { if (loopRef.current) cancelAnimationFrame(loopRef.current); };
  }, [isTimerRunning, trackerMode]);

  const handleToggleTimer = () => {
    if (!selectedTopicId) {
      alert("Please select a target subject node column first.");
      return;
    }
    setIsTimerRunning(!isTimerRunning);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setSecondsElapsed(0);
    setCountdownSecondsLeft(customMinutesSetting * 60);
  };

  const handleSaveTimerLog = async () => {
    if (!selectedTopicId) return;
    
    let targetLoggedSeconds = 0;
    if (trackerMode === 'focus') {
      targetLoggedSeconds = secondsElapsed;
    } else {
      targetLoggedSeconds = (customMinutesSetting * 60) - countdownSecondsLeft;
    }

    if (targetLoggedSeconds <= 0) return;
    setIsTimerRunning(false);

    const currentDateKey = getLocalTodayDateString();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('study_sessions')
        .insert([
          {
            topic_id: selectedTopicId,
            duration_seconds: targetLoggedSeconds,
            logged_date: currentDateKey,
            user_id: user.id
          }
        ]);

      if (error) throw error;

      handleResetTimer();
      setWeekOffset(0); 
      await syncWorkspace();
    } catch (err) {
      alert("Failed storing precise interval log sheet: " + err.message);
    }
  };

  const handleAutoLogSession = async (totalSecs) => {
    const currentDateKey = getLocalTodayDateString();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('study_sessions')
        .insert([
          {
            topic_id: selectedTopicId,
            duration_seconds: totalSecs,
            logged_date: currentDateKey,
            user_id: user.id
          }
        ]);

      if (error) throw error;

      alert("Time target reached! Focus session logged successfully.");
      setWeekOffset(0);
      await syncWorkspace();
    } catch (err) {
      console.error("Auto tracking session execution trace anomaly:", err);
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    // Static clean generation array index selection configurations
    const generationColorsArray = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
    const assignedRandomColorHex = generationColorsArray[Math.floor(Math.random() * generationColorsArray.length)];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: savedRow, error } = await supabase
        .from('study_topics')
        .insert([
          {
            name: newTopicName.trim(),
            color_hex: assignedRandomColorHex,
            user_id: user.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setNewTopicName('');
      if (savedRow) setSelectedTopicId(savedRow.id);
      await syncWorkspace();
    } catch (err) {
      alert("Error building subject profile: " + err.message);
    }
  };

  const openDeleteModal = (id, e) => {
    e.stopPropagation();
    setDeleteTargetId(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteSubject = async () => {
    if (!deleteTargetId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('study_topics')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteTargetId)
        .eq('user_id', user.id);

      if (error) throw error;

      if (selectedTopicId === deleteTargetId) setSelectedTopicId('');
      setShowDeleteModal(false);
      setDeleteTargetId(null);
      await syncWorkspace();
    } catch (err) {
      alert("Error running deletion cascade operations.");
    }
  };

  const formatTimeTokenString = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatShortTimeDisplay = (totalSeconds) => {
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const getSummationSecondsForSubject = (topic) => {
    if (!topic.study_sessions) return 0;
    return topic.study_sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  };

  const getWeeklyGraphDataMatrix = () => {
    const daysArr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    const today = new Date();
    const currentDay = today.getDay(); 
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    
    const targetMonday = new Date(today);
    targetMonday.setDate(today.getDate() + distanceToMonday + (weekOffset * 7));
    targetMonday.setHours(0, 0, 0, 0);

    const targetSunday = new Date(targetMonday);
    targetSunday.setDate(targetMonday.getDate() + 6);
    targetSunday.setHours(23, 59, 59, 999);

    let weekGrandTotalSeconds = 0;

    const processedDays = daysArr.map((dayLabel, index) => {
      const daySessionsMap = [];
      let totalSecondsForDay = 0;

      const targetDayDate = new Date(targetMonday);
      targetDayDate.setDate(targetMonday.getDate() + index);
      
      const pad = (num) => String(num).padStart(2, '0');
      const targetDayStr = `${targetDayDate.getFullYear()}-${pad(targetDayDate.getMonth() + 1)}-${pad(targetDayDate.getDate())}`;

      topics.forEach(topic => {
        const matchingSessions = (topic.study_sessions || []).filter(s => {
          const cleanLogDate = s.logged_date ? s.logged_date.substring(0, 10) : '';
          return cleanLogDate === targetDayStr;
        });

        if (matchingSessions.length > 0) {
          const secs = matchingSessions.reduce((sum, s) => sum + s.duration_seconds, 0);
          totalSecondsForDay += secs;
          daySessionsMap.push({
            color: topic.color_hex,
            name: topic.name,
            seconds: secs
          });
        }
      });

      weekGrandTotalSeconds += totalSecondsForDay;
      return {
        label: dayLabel,
        totalSeconds: totalSecondsForDay,
        daySessionsMap
      };
    });

    const useHoursScale = weekGrandTotalSeconds >= 3600;

    const processedGraphData = processedDays.map(day => {
      const displayValue = useHoursScale 
        ? parseFloat((day.totalSeconds / 3600).toFixed(2))
        : Math.round(day.totalSeconds / 60);

      const segments = day.daySessionsMap.map(seg => ({
        ...seg,
        heightPct: (seg.seconds / (day.totalSeconds || 1)) * 100
      }));

      return {
        label: day.label,
        displayValue,
        totalSeconds: day.totalSeconds,
        segments
      };
    });

    const displayValuesArray = processedGraphData.map(d => d.displayValue);
    const maxDisplayVal = Math.max(...displayValuesArray, useHoursScale ? 4 : 60);

    const dateRangeLabel = `${targetMonday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${targetSunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

    return {
      unitLabel: useHoursScale ? 'Hours' : 'Minutes',
      maxDisplayVal,
      weekTotalString: formatTimeTokenString(weekGrandTotalSeconds),
      dateRangeLabel,
      days: processedGraphData
    };
  };

  const graphMatrix = getWeeklyGraphDataMatrix();
  const activeFocusSubjectObj = topics.find(t => t.id === selectedTopicId);
  const currentTimeDisplaySeconds = trackerMode === 'focus' ? secondsElapsed : countdownSecondsLeft;

  return (
    /* 🌟 FIXED: Added high-performance touch scroll limits container boundaries for overall wrapper alignment metrics */
    <div className="p-0 max-w-[1600px] mx-auto text-zinc-100 font-sans grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-7rem)] overflow-y-auto lg:overflow-hidden select-none selection:bg-purple-500/20">
      
      {/* DELETE DIALOG MODAL LAYOUT OVERLAY */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0f0c1b] border border-zinc-800 w-full max-w-sm p-5 rounded-2xl shadow-2xl space-y-4 text-left">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl"><AlertTriangle className="w-5 h-5"/></div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white tracking-tight">Drop Subject Profile</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">Are you absolutely sure you want to completely delete this subject row along with all logs?</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => { setShowDeleteModal(false); setDeleteTargetId(null); }} className="px-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-xs font-semibold">Cancel</button>
              <button type="button" onClick={confirmDeleteSubject} className="px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-xl transition-all shadow-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT COLUMN PANEL */}
      <div className="lg:col-span-4 flex flex-col gap-5 min-h-0 overflow-hidden">
        
        {/* TIMER MODE INTERFACE */}
        <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between shrink-0 relative">
          <div className="w-full bg-zinc-950 border border-zinc-900 p-1 rounded-xl flex items-stretch gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-4">
            <button
              type="button" disabled={isTimerRunning}
              onClick={() => setTrackerMode('focus')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${trackerMode === 'focus' ? 'bg-purple-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Focus Mode
            </button>
            <button
              type="button" disabled={isTimerRunning}
              onClick={() => setTrackerMode('timer')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${trackerMode === 'timer' ? 'bg-purple-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Timer Mode
            </button>
          </div>

          <div className="my-1 text-center select-text">
            <h1 className="text-4xl font-black font-mono tracking-tighter text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.1)] select-all">
              {formatTimeTokenString(currentTimeDisplaySeconds)}
            </h1>
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
              {isTimerRunning ? "Background Engine Engaged" : "Engine Standby"}
            </p>
          </div>

          {trackerMode === 'timer' && (
            <div className="w-full bg-zinc-950/40 border border-zinc-900 rounded-xl p-2.5 mt-3 flex items-center justify-between gap-3 text-xs">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Set Limit (Mins):</span>
              <input 
                type="number" min="1" max="180" disabled={isTimerRunning}
                value={customMinutesSetting}
                onChange={e => setCustomMinutesSetting(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-16 bg-zinc-950 border border-zinc-800 text-purple-400 font-bold font-mono text-center rounded-lg p-1 focus:outline-none focus:border-purple-500"
              />
            </div>
          )}

          <div className="flex items-center gap-2.5 mt-4 w-full">
            <button
              onClick={handleToggleTimer}
              className={`flex-1 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                isTimerRunning ? 'bg-amber-600 border-amber-500 text-white shadow' : 'bg-purple-600 border-purple-500 text-white shadow'
              }`}
            >
              {isTimerRunning ? <Pause className="w-3.5 h-3.5"/> : <Play className="w-3.5 h-3.5 ml-0.5"/>}
              {isTimerRunning ? "Pause" : "Start"}
            </button>
            
            {((trackerMode === 'focus' && secondsElapsed > 0) || (trackerMode === 'timer' && countdownSecondsLeft < customMinutesSetting * 60)) && (
              <button 
                onClick={handleSaveTimerLog}
                className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all active:scale-95"
              >
                Log
              </button>
            )}

            <button
              onClick={handleResetTimer}
              className="p-2 bg-zinc-950 border border-zinc-900 rounded-xl text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5"/>
            </button>
          </div>
        </div>

        {/* SUBJECT SELECTION PANEL */}
        <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-4 flex flex-col flex-1 min-h-[300px] lg:min-h-0 shadow-xl overflow-hidden text-left">
          <div className="flex justify-between items-center border-b border-zinc-900 pb-2.5 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Subject Folder Deck</span>
            <span className="text-[8px] font-mono font-bold text-zinc-600 bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded-md">{topics.length} Node</span>
          </div>

          <form onSubmit={handleCreateSubject} className="flex gap-1.5 bg-zinc-950/50 p-1 rounded-xl border border-zinc-900/60 my-2.5 shrink-0">
            <input
              type="text" placeholder="Add custom subject label node..."
              value={newTopicName} onChange={e => setNewTopicName(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none p-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:ring-0 select-text"
              required
            />
            <button type="submit" className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"><Plus className="w-3.5 h-3.5"/></button>
          </form>

          {/* 🌟 SCROLL LAYER FOR SUBJECTS ROW DECK */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-600/60">
            {topics.length === 0 ? (
              <p className="text-zinc-600 text-xs italic text-center py-10">No tracking subjects created.</p>
            ) : (
              topics.map((topic) => {
                const isSelected = selectedTopicId === topic.id;
                const totalSecondsSpent = getSummationSecondsForSubject(topic);

                return (
                  <div
                    key={topic.id}
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center justify-between group text-left ${
                      isSelected ? 'bg-[#1a1235]/30 border-purple-500/40' : 'bg-zinc-900/10 border-zinc-900 text-zinc-400 hover:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: topic.color_hex }} />
                      <h4 className="text-xs font-bold text-zinc-200 truncate flex-1">{topic.name}</h4>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0 text-right pl-2">
                      <div className="font-mono text-[10px]">
                        <span className="font-black text-zinc-300 block">{formatTimeTokenString(totalSecondsSpent)}</span>
                        <span className="text-[7px] text-zinc-600 font-bold font-sans uppercase block tracking-wider">Total Sum</span>
                      </div>
                      <button
                        onClick={(e) => openDeleteModal(topic.id, e)}
                        className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 p-0.5 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE CANVAS WEEKLY METRICS */}
      <div className="lg:col-span-8 flex flex-col gap-6 min-h-0 overflow-hidden text-left">
        
        {/* WEEKLY ALLOCATION BAR GRAPH */}
        <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-5 shadow-xl shrink-0 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-zinc-900 pb-3 select-none">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Weekly Performance Allocation</span>
              <div className="text-[11px] font-mono text-purple-400 font-black flex items-center gap-1.5">
                <span>Time Allotted This Week:</span>
                <span className="bg-purple-950/50 border border-purple-500/30 px-2 py-0.5 rounded text-white shadow-inner">{graphMatrix.weekTotalString}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-zinc-950/60 p-1 border border-zinc-900 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setWeekOffset(prev => prev - 1)}
                className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
                title="View Previous Week Data"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-mono font-bold px-2 text-zinc-300 min-w-[140px] text-center">
                {weekOffset === 0 ? 'Current Week' : graphMatrix.dateRangeLabel}
              </span>
              <button
                type="button"
                onClick={() => setWeekOffset(prev => Math.min(0, prev + 1))}
                disabled={weekOffset === 0}
                className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                title="View Next Week Data"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="h-64 w-full flex items-end justify-between pt-6 px-2 sm:px-4 relative overflow-x-auto select-none [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-zinc-800/40 [&::-webkit-scrollbar-thumb]:rounded-full">
            {graphMatrix.days.map((day, idx) => {
              const activeFullDayHeightPct = day.totalSeconds > 0 
                ? (day.displayValue / graphMatrix.maxDisplayVal) * 92 
                : 0;

              return (
                <div key={idx} className="flex flex-col items-center flex-1 min-w-[40px] sm:min-w-0 h-full group relative">
                  <div className="w-7 sm:w-10 bg-zinc-950/40 border border-zinc-900/60 rounded-t-lg h-[92%] flex flex-col-reverse overflow-hidden relative group-hover:border-zinc-700/80 transition-all shadow-inner">
                    {day.totalSeconds > 0 && (
                      <div 
                        className="w-full flex flex-col-reverse h-full"
                        style={{ height: `${Math.max(activeFullDayHeightPct, 3)}%` }}
                      >
                        {day.segments.map((seg, sIdx) => (
                          <div
                            key={sIdx}
                            className="w-full transition-all duration-300 border-t border-black/10 first:border-none"
                            style={{ 
                              height: `${seg.heightPct}%`, 
                              backgroundColor: seg.color 
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <span className="text-[9px] font-mono text-zinc-600 font-bold uppercase tracking-wider mt-2 block group-hover:text-purple-400 transition-colors">
                    {day.label}
                  </span>

                  {/* HOVER SUMMARY POPUP TOOLTIP */}
                  <div className="absolute bottom-[98%] left-1/2 transform -translate-x-1/2 bg-[#090711] border border-zinc-800 rounded-xl p-3 shadow-2xl shadow-black/90 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 w-44 space-y-2 scale-90 group-hover:scale-100">
                    <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                      <span className="text-[10px] font-black uppercase text-zinc-300">{day.label} Summary</span>
                      <span className="text-[9px] font-mono text-purple-400 font-black">{day.displayValue} {graphMatrix.unitLabel === 'Hours' ? 'h' : 'm'}</span>
                    </div>
                    
                    {day.totalSeconds === 0 ? (
                      <p className="text-[9px] text-zinc-600 italic text-center py-1">No focus logs logged.</p>
                    ) : (
                      <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5">
                        {day.segments.map((seg, sIdx) => (
                          <div key={sIdx} className="flex items-center justify-between text-[9px] gap-2">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                              <span className="text-zinc-400 truncate font-semibold">{seg.name}</span>
                            </div>
                            <span className="text-zinc-200 font-mono font-bold shrink-0">{formatShortTimeDisplay(seg.seconds)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DETAILED LOG RECORDS VIEWPORT */}
        <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-4 flex flex-col flex-1 min-h-[300px] lg:min-h-0 shadow-xl overflow-hidden text-left">
          <div className="flex justify-between items-center border-b border-zinc-900 pb-2.5 shrink-0 select-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-400" /> Log Details Matrix Viewport
            </span>
            <span className="text-[9px] font-bold font-mono text-purple-400 bg-purple-950/40 border border-purple-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
              {activeFocusSubjectObj ? activeFocusSubjectObj.name : "System Index"}
            </span>
          </div>

          {/* 🌟 SCROLL LAYER FOR LOG METRICS VIEWPORT CONTAINER */}
          <div className="flex-1 overflow-y-auto space-y-2 pt-3 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/85 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-600/60">
            {!activeFocusSubjectObj || !activeFocusSubjectObj.study_sessions || activeFocusSubjectObj.study_sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 text-xs italic py-12 select-none">
                No granular timer log sheets compiled inside this workspace node yet.
              </div>
            ) : (
              [...activeFocusSubjectObj.study_sessions]
                .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
                .map((session, sIdx) => (
                  <div 
                    key={session.id || sIdx}
                    className="p-3 bg-zinc-950/40 border border-zinc-900/60 hover:border-zinc-800 rounded-xl flex items-center justify-between text-left transition-colors select-text animate-fade-in"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-zinc-900 text-zinc-500 select-none">
                        <BookOpen className="w-3.5 h-3.5" style={{ color: activeFocusSubjectObj.color_hex }} />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-bold text-zinc-300">Precise Timer Interval Track</span>
                        <div className="flex items-center gap-2 text-[9px] text-zinc-500 font-mono font-bold select-none">
                          <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5"/> {session.logged_date}</span>
                          <span>•</span>
                          <span>ID: #{String(session.id).slice(0,5)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-xs font-black text-zinc-200 block">
                        +{formatTimeTokenString(session.duration_seconds)}
                      </span>
                      <span className="text-[8px] text-zinc-600 uppercase tracking-widest font-bold font-sans block">
                        Duration Spent
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}