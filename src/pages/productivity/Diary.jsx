import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Save, AlertTriangle, Edit3 } from 'lucide-react';
import { supabase } from '../../services/supabaseClient.js';

export default function Diary() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Track currently selected entry for reading/editing on the right panel canvas
  const [activeEntry, setActiveEntry] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form Editor Fields
  const [editContent, setEditContent] = useState('');
  const [editMoods, setEditMoods] = useState(['Neutral']);

  // Real-time Automated Date Generator System
  const todayObj = new Date();
  const currentYear = todayObj.getFullYear();
  const todayStr = `${currentYear}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

  // Overlay Trigger State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Expanded Sentiment Matrix Deck
  const moodOptions = [
    { label: '😊 Happy', value: 'Happy', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { label: '⚡ Productive', value: 'Productive', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    { label: '❤️ Emotional', value: 'Emotional', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
    { label: '🎯 Motivated', value: 'Motivated', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
    { label: '😐 Neutral', value: 'Neutral', color: 'bg-zinc-800 text-zinc-400 border-zinc-700/60' },
    { label: '🥱 Tired', value: 'Tired', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { label: '😰 Anxious', value: 'Anxious', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { label: '😔 Lonely', value: 'Lonely', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' }
  ];

  const syncWorkspace = async () => {
    try {
      setLoading(true);

      // 1. Resolve current active user context
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // 2. Query public.user_diary table restricted tightly by user_id isolation checks
      const { data, error } = await supabase
        .from('user_diary')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('entry_date', { ascending: false });

      if (error) throw error;

      // Normalizing schema fields matching your exact table layout variables
      const normalizedEntries = (data || []).map(row => ({
        id: row.id,
        title: row.title || row.entry_date, 
        content: row.content || '',
        mood: row.mood || 'Neutral',
        entry_date: row.entry_date
      }));

      setEntries(normalizedEntries);
      
      if (normalizedEntries.length > 0) {
        if (!activeEntry || !normalizedEntries.some(e => e.id === activeEntry.id)) {
          handleSelectEntry(normalizedEntries[0]);
        }
      } else {
        setActiveEntry(null);
        setIsEditing(true);
      }
    } catch (err) {
      console.error("Failed loading diary logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncWorkspace();
  }, []);

  const handleSelectEntry = (entry) => {
    setActiveEntry(entry);
    setIsEditing(false);
    setEditContent(entry.content);
    setEditMoods(entry.mood ? entry.mood.split(',') : ['Neutral']);
  };

  const handleInitNewEntry = () => {
    setActiveEntry(null);
    setIsEditing(true);
    setEditContent('');
    setEditMoods(['Neutral']);
  };

  const handleToggleMoodSelection = (moodValue) => {
    if (editMoods.includes(moodValue)) {
      const updated = editMoods.filter(m => m !== moodValue);
      setEditMoods(updated.length === 0 ? ['Neutral'] : updated);
    } else {
      if (moodValue === 'Neutral') {
        setEditMoods(['Neutral']);
      } else {
        const cleaned = editMoods.filter(m => m !== 'Neutral');
        setEditMoods([...cleaned, moodValue]);
      }
    }
  };

  const handleSaveWorkspace = async (e) => {
    e.preventDefault();
    if (!editContent.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const joinedMoodsString = editMoods.join(',');

      if (activeEntry) {
        // Updates existing row inside public.user_diary (title stays locked to its date)
        const { error } = await supabase
          .from('user_diary')
          .update({
            content: editContent.trim(),
            mood: joinedMoodsString,
            updated_at: new Date().toISOString()
          })
          .eq('id', activeEntry.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // FIXED: Inserts a new record, strictly locking the title to today's date string
        const { error } = await supabase
          .from('user_diary')
          .insert([
            {
              title: todayStr, // 👈 Locked cleanly to the current calendar date
              content: editContent.trim(),
              mood: joinedMoodsString,
              entry_date: todayStr,
              user_id: user.id
            }
          ]);

        if (error) throw error;
      }
      
      setIsEditing(false);
      setActiveEntry(null); 
      await syncWorkspace();
    } catch (err) {
      alert("Error writing entry update layer: " + err.message);
    }
  };

  const openDeleteModal = (id, e) => {
    e.stopPropagation();
    setDeleteTargetId(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteEntry = async () => {
    if (!deleteTargetId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('user_diary')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteTargetId)
        .eq('user_id', user.id);

      if (error) throw error;

      if (activeEntry && activeEntry.id === deleteTargetId) {
        setActiveEntry(null);
      }
      setShowDeleteModal(false);
      setDeleteTargetId(null);
      await syncWorkspace();
    } catch (err) {
      alert("Could not update data registry rows.");
    }
  };

  const getMoodBadgeColor = (moodVal) => {
    const config = moodOptions.find(m => m.value === moodVal);
    return config ? config.color : 'bg-zinc-800 text-zinc-400';
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-5 max-w-[1600px] mx-auto text-zinc-100 font-sans relative selection:bg-purple-500/20 select-none">
      
      {/* GLOBAL DELETE MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0f0c1b] border border-zinc-800 w-full max-w-sm p-6 rounded-2xl shadow-2xl space-y-5 text-left">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white tracking-tight">Remove Journal Entry</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">Are you absolutely certain you want to soft-delete this log entry from active timeline records?</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => { setShowDeleteModal(false); setDeleteTargetId(null); }} className="px-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-xs font-semibold">Cancel</button>
              <button type="button" onClick={confirmDeleteEntry} className="px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-xl transition-all shadow-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDE PANEL: LOGS INDEX */}
      <div className="w-80 bg-[#0f0c1b]/50 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-4 flex flex-col shrink-0 shadow-xl overflow-hidden text-left">
        <div className="flex justify-between items-center mb-4 select-none">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Personal Diary</h3>
            <p className="text-[10px] text-zinc-600 mt-0.5">Timeline history deck</p>
          </div>
          <button 
            onClick={handleInitNewEntry}
            className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all"
            title="Compose new journal log entry"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/80 [&::-webkit-scrollbar-thumb]:rounded-full">
          {loading ? (
            <p className="text-xs text-purple-400/80 animate-pulse text-center py-8">Syncing timeline indices...</p>
          ) : entries.length === 0 ? (
            <p className="text-zinc-600 text-xs italic text-center py-12">No logs recorded.</p>
          ) : (
            entries.map((item) => {
              const isSelected = activeEntry && activeEntry.id === item.id;
              const itemMoodsArray = item.mood ? item.mood.split(',') : ['Neutral'];

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectEntry(item)}
                  className={`p-3.5 border rounded-xl cursor-pointer text-left transition-all relative overflow-hidden group flex flex-col justify-between min-h-[84px] ${
                    isSelected 
                      ? 'bg-[#1a1235]/30 border-purple-500/40 text-purple-300' 
                      : 'bg-zinc-900/10 border-zinc-800/60 text-zinc-400 hover:border-zinc-800'
                  }`}
                >
                  <div className="flex justify-between items-center gap-2 max-w-full">
                    <h4 className="text-xs font-bold text-zinc-200 truncate flex-1">{item.title}</h4>
                    <button
                      onClick={(e) => openDeleteModal(item.id, e)}
                      className="text-zinc-700 hover:text-red-400 p-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 pt-2 border-t border-zinc-900/40 mt-2 items-center">
                    <span className="flex items-center gap-1 text-[9px] font-mono text-zinc-600 mr-1"><Calendar className="w-3 h-3 text-zinc-700"/> {item.entry_date}</span>
                    {itemMoodsArray.map((mValue, idx) => (
                      <span 
                        key={idx} 
                        className={`px-1.5 py-0.2 rounded border text-[8px] font-sans font-bold tracking-tight shrink-0 ${getMoodBadgeColor(mValue)}`}
                      >
                        {mValue}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT SIDE PANEL: WRITING EDITOR */}
      <div className="flex-1 flex flex-col bg-[#06040a]/40 border border-zinc-800/40 rounded-2xl p-5 justify-between overflow-hidden shadow-inner text-left">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 text-xs italic">Syncing view layer elements...</div>
        ) : isEditing || !activeEntry ? (
          
          /* VIEW A: CREATE / EDIT SPACE */
          <form onSubmit={handleSaveWorkspace} className="flex-1 flex flex-col justify-between h-full space-y-4">
            <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
              
              {/* FIXED: Title column input is gone; locked straight to the local date token */}
              <div className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3 select-none text-xs text-zinc-400 font-mono font-bold w-full">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span>Diary Page Title & Date :</span>
                <span className="text-zinc-100 font-black">{activeEntry ? activeEntry.title : todayStr}</span>
              </div>

              <div className="space-y-1.5 select-none shrink-0">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">How's your current sentiment state?</span>
                <div className="flex flex-wrap gap-1.5">
                  {moodOptions.map(m => {
                    const isSelected = editMoods.includes(m.value);
                    return (
                      <button
                        key={m.value} type="button"
                        onClick={() => handleToggleMoodSelection(m.value)}
                        className={`text-[10px] py-1.5 px-3 border rounded-xl font-semibold transition-all ${
                          isSelected 
                            ? 'bg-purple-600 border-purple-500 text-white shadow shadow-purple-600/20' 
                            : 'bg-zinc-950/40 border-zinc-900/60 text-zinc-400 hover:border-zinc-800'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <textarea
                  placeholder="Write your thoughts, milestones, challenges or personal logs down..."
                  value={editContent} onChange={e => setEditContent(e.target.value)}
                  className="w-full flex-1 bg-zinc-950/20 border border-zinc-900 rounded-xl p-4 text-xs text-zinc-300 placeholder:text-zinc-700 leading-relaxed font-normal resize-none focus:outline-none focus:border-zinc-800 focus:bg-zinc-950/30 overflow-y-auto pr-1 select-text"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t border-zinc-900/60 pt-3 shrink-0 select-none">
              {activeEntry && (
                <button 
                  type="button" onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-400 text-xs font-semibold"
                >
                  Cancel
                </button>
              )}
              <button 
                type="submit"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-all shadow-lg flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" /> Save Entry log
              </button>
            </div>
          </form>
        ) : (
          
          /* VIEW B: STATIC SHEET VIEWMODE */
          <div className="flex-1 flex flex-col justify-between h-full animate-fade-in select-text">
            <div className="space-y-5 flex-1 flex flex-col overflow-hidden">
              <div className="flex justify-between items-start gap-4 border-b border-zinc-900 pb-3 select-none">
                <div className="space-y-1.5 truncate">
                  <h2 className="text-base font-black text-white tracking-tight truncate">{activeEntry.title}</h2>
                  
                  <div className="flex flex-wrap gap-1.5 items-center text-[10px] font-mono text-zinc-500 font-semibold">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-zinc-600" /> Date: {activeEntry.entry_date}</span>
                    <span>•</span>
                    {(activeEntry.mood ? activeEntry.mood.split(',') : ['Neutral']).map((mValue, idx) => (
                      <span 
                        key={idx} 
                        className={`px-2 py-0.5 border rounded-md text-[9px] font-sans font-bold ${getMoodBadgeColor(mValue)}`}
                      >
                        {mValue}
                      </span>
                    ))}
                  </div>
                </div>
                
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 shrink-0"
                >
                  <Edit3 className="w-3 h-3 text-purple-400" /> Edit Page
                </button>
              </div>

              <div className="flex-1 overflow-y-auto text-xs text-zinc-300 leading-relaxed font-normal whitespace-pre-wrap pr-1 bg-zinc-950/10 p-4 rounded-xl border border-zinc-900/30 font-sans select-text">
                {activeEntry.content}
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-900 select-none font-mono text-[9px] text-zinc-600 text-left">
              TrackorA Notebook Ledger Workspace Frame
            </div>
          </div>
        )}
      </div>

    </div>
  );
}