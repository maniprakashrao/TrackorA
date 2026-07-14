import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Check, X, AlertTriangle, ArrowLeft, Square, CheckSquare, Target, Lock } from 'lucide-react';
import { supabase } from '../../services/supabaseClient.js';

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Default starting tab set to 'in-progress'
  const [activeMenuTab, setActiveMenuTab] = useState('in-progress');

  // Drill-down View State
  const [activeGoalDetails, setActiveGoalDetails] = useState(null);

  // Overlay Trigger States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');

  // Inline Detail Sub-topic Append State
  const [newSubtopicTitle, setNewSubtopicTitle] = useState('');

  const syncWorkspace = async () => {
    try {
      setLoading(true);
      
      // 1. Resolve current user context
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // 2. Query workspace data isolated entirely to active session user id
      const { data: goalsData, error: goalsErr } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (goalsErr) throw goalsErr;

      // 3. Fetch subtopics linked to this user's workspace
      const { data: subtopicsData, error: subtopicsErr } = await supabase
        .from('goal_subtopics')
        .select('*')
        .eq('user_id', user.id);

      if (subtopicsErr) throw subtopicsErr;

      // 4. Combine goals and subtopics together in-memory
      const compiledGoals = (goalsData || []).map(g => {
        const associatedSubtopics = (subtopicsData || [])
          .filter(sub => sub.goal_id === g.id)
          .map(sub => ({
            id: sub.id,
            title: sub.title,
            is_done: sub.is_done
          }));

        return {
          id: g.id,
          title: g.title,
          is_completed: g.is_completed,
          created_at: g.created_at,
          target_date: g.target_date || 'No Date',
          goal_subtopics: associatedSubtopics
        };
      });

      setGoals(compiledGoals);
      
      if (activeGoalDetails) {
        const updatedCurrent = compiledGoals.find(g => g.id === activeGoalDetails.id);
        if (updatedCurrent) setActiveGoalDetails(updatedCurrent);
      }
    } catch (err) {
      console.error("Failed loading goal structures:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncWorkspace();
  }, []);

  const handleInitializeGoal = async (e) => {
    e.preventDefault();
    if (!title.trim() || !targetDate) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_goals')
        .insert([
          {
            title: title.trim(),
            target_date: targetDate,
            is_completed: false,
            user_id: user.id
          }
        ]);

      if (error) throw error;

      setTitle('');
      setTargetDate('');
      setShowAddModal(false);
      await syncWorkspace();
    } catch (err) {
      alert("Error building goal model card: " + err.message);
    }
  };

  const handleAddInlineSubtopic = async (e) => {
    e.preventDefault();
    if (!newSubtopicTitle.trim() || !activeGoalDetails) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('goal_subtopics')
        .insert([
          {
            goal_id: activeGoalDetails.id,
            title: newSubtopicTitle.trim(),
            is_done: false,
            user_id: user.id
          }
        ]);

      if (error) throw error;

      setNewSubtopicTitle('');
      await syncWorkspace(); 
    } catch (err) {
      console.error("Error inserting subtopic row:", err);
    }
  };

  const handleToggleSubtopic = async (goalId, subId, currentStatus) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: subtopicErr } = await supabase
        .from('goal_subtopics')
        .update({ is_done: !currentStatus })
        .eq('id', subId)
        .eq('user_id', user.id);

      if (subtopicErr) throw subtopicErr;
      
      const currentGoal = goals.find(g => g.id === goalId);
      if (!currentGoal) return;

      const modifiedSubs = currentGoal.goal_subtopics.map(s => 
        s.id === subId ? { ...s, is_done: !s.is_done } : s
      );

      const totalCount = modifiedSubs.length;
      const doneCount = modifiedSubs.filter(s => s.is_done).length;
      const autoCheckComplete = totalCount > 0 && doneCount === totalCount;
      
      const { error: goalErr } = await supabase
        .from('user_goals')
        .update({ is_completed: autoCheckComplete })
        .eq('id', goalId)
        .eq('user_id', user.id);

      if (goalErr) throw goalErr;

      await syncWorkspace();
    } catch (err) {
      alert("Could not switch checklist status: " + err.message);
    }
  };

  const handleToggleGoalCardComplete = async (goalId, currentStatus) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_goals')
        .update({ is_completed: !currentStatus })
        .eq('id', goalId)
        .eq('user_id', user.id);

      if (error) throw error;

      await syncWorkspace();
    } catch (err) {
      alert("Error marking card status: " + err.message);
    }
  };

  const openDeleteModal = (id, e) => {
    e.stopPropagation();
    setDeleteTargetId(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteCard = async () => {
    if (!deleteTargetId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_goals')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteTargetId)
        .eq('user_id', user.id);

      if (error) throw error;

      if (activeGoalDetails && activeGoalDetails.id === deleteTargetId) {
        setActiveGoalDetails(null);
      }
      setShowDeleteModal(false);
      setDeleteTargetId(null);
      await syncWorkspace();
    } catch (err) {
      alert("Could not remove goal card matrix: " + err.message);
    }
  };

  const getGoalProgress = (goal) => {
    const subs = goal.goal_subtopics || [];
    if (subs.length === 0) return goal.is_completed ? 100 : 0;
    const doneCount = subs.filter(s => s.is_done).length;
    return Math.round((doneCount / subs.length) * 100);
  };

  const renderInteractiveDonut = (percentage, size = 80, strokeWidth = 7) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center shrink-0 group" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90 select-none" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={radius} className="stroke-zinc-900" strokeWidth={strokeWidth} fill="transparent" />
          <circle 
            cx={size/2} cy={size/2} r={radius} 
            className="stroke-purple-500 transition-all duration-500 ease-out" 
            strokeWidth={strokeWidth} fill="transparent"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ filter: percentage > 0 ? 'drop-shadow(0 0 6px rgba(139,92,246,0.5))' : 'none' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-xs font-black font-mono tracking-tighter text-zinc-100">{percentage}%</span>
        </div>
      </div>
    );
  };

  const filteredAndSortedGoals = (() => {
    let list = [...goals];
    if (activeMenuTab === 'in-progress') {
      list = list.filter(g => !g.is_completed);
    } else if (activeMenuTab === 'completed') {
      list = list.filter(g => g.is_completed);
    }

    return list.sort((a, b) => {
      if (a.is_completed && !b.is_completed) return 1;
      if (!a.is_completed && b.is_completed) return -1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  })();

  const globalCompletionRate = (() => {
    if (goals.length === 0) return 0;
    const completedCards = goals.filter(g => g.is_completed).length;
    return Math.round((completedCards / goals.length) * 100);
  })();

  const totalGoals = goals.length;
  const inProgressCount = goals.filter(g => !g.is_completed).length;
  const completedCount = goals.filter(g => g.is_completed).length;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-5 max-w-[1600px] mx-auto text-zinc-100 font-sans relative selection:bg-purple-500/20 select-none">
      
      {/* GLOBAL CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0f0c1b] border border-zinc-800 w-full max-w-sm p-6 rounded-2xl shadow-2xl space-y-5 text-left">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white tracking-tight">Remove Goal Milestone</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">Are you absolutely sure you want to delete this goal and its associated sub-topic checklist matrices?</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => { setShowDeleteModal(false); setDeleteTargetId(null); }} className="px-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-xs font-semibold">Cancel</button>
              <button type="button" onClick={confirmDeleteCard} className="px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-xl transition-all shadow-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDE PANEL */}
      <div className="w-72 bg-[#0f0c1b]/50 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-4 flex flex-col shrink-0 shadow-xl justify-between text-left">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Goals Menu</h3>
              <p className="text-[10px] text-zinc-600 mt-0.5">Objective Filter Deck</p>
            </div>
            {!activeGoalDetails && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-2 pt-2">
            {[
              { id: 'in-progress', label: 'In Progress', count: inProgressCount, pct: totalGoals > 0 ? Math.round((inProgressCount/totalGoals)*100) : 0 },
              { id: 'all', label: 'All Goals', count: totalGoals, pct: globalCompletionRate },
              { id: 'completed', label: 'Completed Goals', count: completedCount, pct: globalCompletionRate }
            ].map((tab) => {
              const isActive = activeMenuTab === tab.id;
              return (
                <button
                  key={tab.id}
                  disabled={!!activeGoalDetails}
                  onClick={() => setActiveMenuTab(tab.id)}
                  className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between group/btn ${
                    activeGoalDetails
                      ? 'opacity-40 cursor-not-allowed border-zinc-900'
                      : isActive
                      ? 'bg-[#1a1235]/40 border-purple-500/40 text-purple-300 shadow-md'
                      : 'bg-zinc-900/10 border-zinc-800/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800'
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-wider">{tab.label}</span>
                  <div className="relative flex items-center justify-center w-7 h-7">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" className="stroke-zinc-800" strokeWidth="2.5" fill="transparent" />
                      <circle cx="12" cy="12" r="10" className="stroke-purple-500" strokeWidth="2.5" fill="transparent" strokeDasharray={2*Math.PI*10} strokeDashoffset={2*Math.PI*10 - (tab.pct/100)*2*Math.PI*10} />
                    </svg>
                    <span className="absolute text-[8px] font-mono font-bold text-zinc-400">{tab.count}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 bg-purple-950/10 border border-purple-500/10 rounded-xl flex items-center gap-3">
          <Target className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="truncate">
            <span className="text-[10px] font-bold text-zinc-400 block uppercase tracking-wider">Completion rate</span>
            <span className="text-[11px] font-mono text-purple-300 font-bold">{globalCompletionRate}% Done</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL WORKSPACE CANVAS */}
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
        
        {loading ? (
          <p className="text-xs text-purple-400/80 animate-pulse py-12 text-center">Loading objective matrices...</p>
        ) : activeGoalDetails ? (
          
          /* DETAILED ROUTING MODULE VIEW */
          (() => {
            const currentProgressPct = getGoalProgress(activeGoalDetails);
            const isVerificationUnlocked = currentProgressPct === 100;

            return (
              <div className="w-full bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-6 shadow-2xl space-y-6 animate-fade-in overflow-y-auto max-h-full flex flex-col justify-between text-left">
                
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                    <button 
                      onClick={() => setActiveGoalDetails(null)}
                      className="text-zinc-400 hover:text-purple-400 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Catalog
                    </button>
                    <button 
                      onClick={(e) => openDeleteModal(activeGoalDetails.id, e)}
                      className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 bg-zinc-950/30 border border-zinc-900/40 rounded-2xl">
                    {renderInteractiveDonut(currentProgressPct, 96, 8)}
                    <div className="text-center sm:text-left space-y-1">
                      <h2 className="text-xl font-black text-white tracking-tight">
                        {activeGoalDetails.title}
                      </h2>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
                        Roadmap Status Profile Workspace
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleAddInlineSubtopic} className="flex gap-2 bg-zinc-950/40 p-1.5 rounded-xl border border-zinc-900/60">
                    <input 
                      type="text" 
                      placeholder="Add next subtopic segment item (e.g., Arrays, Strings)..."
                      value={newSubtopicTitle}
                      onChange={e => setNewSubtopicTitle(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none p-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:ring-0 select-text"
                      required
                    />
                    <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all">
                      Append Line
                    </button>
                  </form>

                  <div className="space-y-2">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block pb-1">Sub-Topics Roadmap Matrix</span>
                    
                    {(!activeGoalDetails.goal_subtopics || activeGoalDetails.goal_subtopics.length === 0) ? (
                      <p className="text-xs text-zinc-600 italic py-6 text-center border border-dashed border-zinc-900/50 rounded-xl bg-zinc-950/10">No tracking items appended yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {activeGoalDetails.goal_subtopics.map((sub) => (
                          <div
                            key={sub.id}
                            onClick={() => handleToggleSubtopic(activeGoalDetails.id, sub.id, sub.is_done)}
                            className="w-full flex items-center justify-between p-3 bg-zinc-900/10 border border-zinc-900 hover:border-zinc-800/80 rounded-xl text-left cursor-pointer transition-all hover:bg-zinc-900/20"
                          >
                            <div className="flex items-center gap-3 truncate">
                              {sub.is_done ? (
                                <CheckSquare className="w-4 h-4 text-purple-500 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-zinc-700 shrink-0" />
                              )}
                              <span className={`text-xs font-semibold ${sub.is_done ? 'text-zinc-500 line-through font-normal' : 'text-zinc-200'}`}>
                                {sub.title}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-zinc-900/60 pt-4 font-mono text-[10px] text-zinc-500 select-none mt-4">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Target Date: {activeGoalDetails.target_date}</span>
                  
                  <button
                    disabled={!isVerificationUnlocked}
                    onClick={() => handleToggleGoalCardComplete(activeGoalDetails.id, activeGoalDetails.is_completed)}
                    className={`px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      activeGoalDetails.is_completed
                        ? 'bg-purple-600 border-purple-500 text-white shadow shadow-purple-600/20 cursor-pointer'
                        : isVerificationUnlocked 
                        ? 'bg-zinc-950 border-purple-500/40 text-purple-400 hover:bg-purple-600 hover:text-white cursor-pointer hover:scale-[1.02] shadow-lg' 
                        : 'bg-zinc-950/20 border-zinc-900 text-zinc-700 cursor-not-allowed opacity-50'
                    }`}
                    title={!isVerificationUnlocked ? "Complete all sub-topics first to unlock button activation." : "Mark complete"}
                  >
                    {activeGoalDetails.is_completed ? <Check className="w-3.5 h-3.5" /> : !isVerificationUnlocked ? <Lock className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    {activeGoalDetails.is_completed ? "Completed" : "Complete"}
                  </button>
                </div>

              </div>
            );
          })()
        ) : filteredAndSortedGoals.length === 0 ? (
          <div className="text-zinc-500 text-xs italic text-center py-20 border border-dashed border-zinc-800/40 rounded-2xl bg-zinc-950/10">
            No goal profiles found matching this menu bracket selection mode.
          </div>
        ) : (
          
          /* MAIN GRID DISPLAY LOG PANEL */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start overflow-y-auto pr-1 text-left">
            {filteredAndSortedGoals.map((goal) => {
              const percentage = getGoalProgress(goal);
              return (
                <div
                  key={goal.id}
                  onClick={() => setActiveGoalDetails(goal)}
                  className={`bg-[#0f0c1b]/40 backdrop-blur-md border rounded-2xl p-5 shadow-lg cursor-pointer transition-all duration-300 hover:border-zinc-700 hover:scale-[1.01] group relative overflow-hidden flex flex-col justify-between min-h-[148px] ${
                    goal.is_completed ? 'border-purple-500/20 bg-purple-950/5' : 'border-zinc-800/60'
                  }`}
                >
                  {goal.is_completed && (
                    <div className="absolute top-0 right-0 bg-purple-500/10 border-b border-l border-purple-500/20 px-2 py-0.5 rounded-bl-lg text-[8px] font-mono tracking-wider text-purple-400 font-bold uppercase">
                      Done
                    </div>
                  )}

                  <div className="flex justify-between items-start gap-3 flex-1">
                    <div className="space-y-1 truncate flex-1 pr-1">
                      <h3 className={`text-sm font-bold text-white tracking-tight truncate group-hover:text-purple-300 transition-colors ${
                        goal.is_completed ? 'text-purple-400/60 opacity-40 line-through' : ''
                      }`}>
                        {goal.title}
                      </h3>
                      <span className="text-[8px] tracking-wider font-bold uppercase text-purple-400 bg-purple-950/30 px-1.5 py-0.5 rounded border border-purple-500/10 inline-block mt-1">
                        {goal.goal_subtopics?.length || 0} Subtopics
                      </span>
                    </div>

                    {renderInteractiveDonut(percentage, 52, 4.5)}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-zinc-900/60 text-[9px] font-mono text-zinc-500 mt-4">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> Due {goal.target_date}</span>
                    <button 
                      onClick={(e) => openDeleteModal(goal.id, e)}
                      className="text-zinc-600 hover:text-red-400 p-1 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* OVERLAY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <form 
            onSubmit={handleInitializeGoal}
            className="bg-[#0f0c1b] border border-zinc-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-scale-up text-left"
          >
            <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400">Initialize Goal Card</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4"/></button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Goal Heading Title</label>
              <input 
                type="text" placeholder="e.g., DSA Core Framework, Web Development Master"
                value={title} onChange={e => setTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-purple-500 select-text"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Target Deadline Date</label>
              <input 
                type="date"
                value={targetDate} onChange={e => setTargetDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-purple-500 text-center font-mono"
                required
              />
            </div>

            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2.5 rounded-xl uppercase tracking-widest transition-all mt-2 shadow-lg">
              Generate Goal Node
            </button>
          </form>
        </div>
      )}

    </div>
  );
}