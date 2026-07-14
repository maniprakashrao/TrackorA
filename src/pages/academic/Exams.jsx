import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, AlertTriangle, CheckSquare, Square, GraduationCap } from 'lucide-react';
import { supabase } from '../../services/supabaseClient.js';

export default function Exams() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExamId, setSelectedExamId] = useState('');

  // Form Field States
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState('');
  const [newSubtopicName, setNewSubtopicName] = useState('');

  // Overlay Trigger State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const syncWorkspace = async () => {
    try {
      setLoading(true);
      
      // 1. Resolve active user session context
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // 2. Query exams restricted tightly to this unique authenticated user
      const { data: examsData, error: examsErr } = await supabase
        .from('user_exams')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('exam_date', { ascending: true });

      if (examsErr) throw examsErr;

      // 3. FIXED: Query from the correct 'exam_subtopics' table (removed non-existent user_id filter)
      const { data: subtopicsData, error: subtopicsErr } = await supabase
        .from('exam_subtopics')
        .select('*');

      if (subtopicsErr) throw subtopicsErr;

      // 4. Combine rows back together inside memory matching your schema's column labels
      const compiledExams = (examsData || []).map(exam => {
        const associatedSubtopics = (subtopicsData || [])
          .filter(sub => sub.exam_id === exam.id) // 👉 Links using correct exam_id field key
          .map(sub => ({
            id: sub.id,
            subtopic_name: sub.subtopic_name, // 👉 Maps schema column name field
            is_completed: sub.is_completed //   👉 Maps schema column is_completed flag
          }));

        return {
          ...exam,
          exam_subtopics: associatedSubtopics
        };
      });

      setExams(compiledExams);

      // Handle baseline selected state configurations safely
      if (compiledExams.length > 0) {
        if (!selectedExamId || !compiledExams.some(e => e.id === selectedExamId)) {
          setSelectedExamId(compiledExams[0].id);
        }
      } else {
        setSelectedExamId('');
      }
    } catch (err) {
      console.error("Failed sync exams tracker:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncWorkspace();
  }, []);

  const handleInitializeExam = async (e) => {
    e.preventDefault();
    if (!title.trim() || !subject.trim() || !examDate) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: savedExam, error } = await supabase
        .from('user_exams')
        .insert([
          {
            title: title.trim(),
            subject: subject.trim(),
            exam_date: examDate,
            exam_time: examTime || null,
            user_id: user.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setShowAddModal(false);
      setTitle('');
      setSubject('');
      setExamDate('');
      setExamTime('');
      if (savedExam) setSelectedExamId(savedExam.id);
      await syncWorkspace();
    } catch (err) {
      alert("Error initializing exam target profile: " + err.message);
    }
  };

  const handleAddSyllabusNode = async (e) => {
    e.preventDefault();
    if (!newSubtopicName.trim() || !selectedExamId) return;

    try {
      // FIXED: Storing data in 'exam_subtopics' with correct database column mappings
      const { error } = await supabase
        .from('exam_subtopics')
        .insert([
          {
            exam_id: selectedExamId,
            subtopic_name: newSubtopicName.trim(),
            is_completed: false
          }
        ]);

      if (error) throw error;

      setNewSubtopicName('');
      await syncWorkspace();
    } catch (err) {
      alert("Could not append syllabus subtopic module: " + err.message);
    }
  };

  const handleToggleCheckbox = async (subtopicId, currentState) => {
    try {
      // FIXED: Updates exact 'exam_subtopics' table parameters (removed non-existent user_id filter)
      const { error } = await supabase
        .from('exam_subtopics')
        .update({ is_completed: !currentState })
        .eq('id', subtopicId);

      if (error) throw error;
      await syncWorkspace();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveSubtopic = async (subtopicId) => {
    try {
      // FIXED: Runs explicit clean purge operations on 'exam_subtopics' table entries
      const { error } = await supabase
        .from('exam_subtopics')
        .delete()
        .eq('id', subtopicId);

      if (error) throw error;
      await syncWorkspace();
    } catch (err) {
      console.error(err);
    }
  };

  const openDeleteModal = (id, e) => {
    e.stopPropagation();
    setDeleteTargetId(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteExam = async () => {
    if (!deleteTargetId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('user_exams')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteTargetId)
        .eq('user_id', user.id);

      if (error) throw error;

      if (selectedExamId === deleteTargetId) setSelectedExamId('');
      setShowDeleteModal(false);
      setDeleteTargetId(null);
      await syncWorkspace();
    } catch (err) {
      alert("Error processing deletion updates.");
    }
  };

  const getExamSyllabusMetrics = (exam) => {
    const subtopicsList = exam?.exam_subtopics || [];
    if (subtopicsList.length === 0) return { pct: 0, completed: 0, total: 0 };
    
    const completedCount = subtopicsList.filter(s => s.is_completed).length;
    return {
      pct: Math.round((completedCount / subtopicsList.length) * 100),
      completed: completedCount,
      total: subtopicsList.length
    };
  };

  const calculateDaysRemaining = (targetDateStr) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(targetDateStr);
    target.setHours(0,0,0,0);
    
    const timeDelta = target.getTime() - today.getTime();
    return Math.ceil(timeDelta / (1000 * 3600 * 24));
  };

  const formatCountdownLabel = (days) => {
    if (days === 0) return { text: "Exam Today", style: "text-rose-400 font-black animate-pulse" };
    if (days < 0) return { text: `Ended ${Math.abs(days)} days ago`, style: "text-zinc-600 font-medium" };
    if (days === 1) return { text: "1 Day Left", style: "text-amber-400 font-black" };
    return { text: `${days} Days Remaining`, style: "text-purple-400 font-bold" };
  };

  const activeExamObj = exams.find(e => e.id === selectedExamId);
  const metrics = getExamSyllabusMetrics(activeExamObj);

  const donutSize = 120;
  const strokeWidth = 8;
  const radius = (donutSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (metrics.pct / 100) * circumference;

  return (
    <div className="p-6 max-w-[1600px] mx-auto text-zinc-100 font-sans grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-7rem)] overflow-hidden select-none selection:bg-purple-500/20">
      
      {/* GLOBAL DELETE MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0f0c1b] border border-zinc-800 w-full max-w-sm p-5 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl"><AlertTriangle className="w-5 h-5"/></div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white tracking-tight">Drop Exam Profile</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">Are you absolutely sure you want to delete this upcoming exam schedule card?</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => { setShowDeleteModal(false); setDeleteTargetId(null); }} className="px-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-xs font-semibold">Cancel</button>
              <button type="button" onClick={confirmDeleteExam} className="px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-xl transition-all shadow-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY MODAL: INITIALIZE NEW CARD */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <form onSubmit={handleInitializeExam} className="bg-[#0f0c1b] border border-zinc-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-scale-up">
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 pb-2 border-b border-zinc-900">Initialize Exam Profile</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Exam Header Title</label>
                <input type="text" placeholder="e.g., DBMS End Sem" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-purple-500 select-text" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Subject Domain</label>
                <input type="text" placeholder="e.g., CSE Core" value={subject} onChange={e => setSubject(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-purple-500 select-text" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Target Exam Date</label>
                <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-purple-500 text-center" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Exam Time (Optional)</label>
                <input type="time" value={examTime} onChange={e => setExamTime(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-purple-500 text-center" />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-400 text-xs font-semibold">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-lg uppercase tracking-wider text-[10px]">Create Profile</button>
            </div>
          </form>
        </div>
      )}

      {/* LEFT SIDE TIMELINE SLIDER SUMMARY */}
      <div className="lg:col-span-5 flex flex-col gap-5 min-h-0">
        <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-4 flex flex-col flex-1 min-h-0 shadow-xl overflow-hidden text-left">
          <div className="flex justify-between items-center border-b border-zinc-900 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-purple-400" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Exam Assessment Deck</h3>
                <p className="text-[9px] text-zinc-600 mt-0.5 font-mono">Academic Deadline Schedule</p>
              </div>
            </div>
            <button onClick={() => setShowAddModal(true)} className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all shadow"><Plus className="w-3.5 h-3.5"/></button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 mt-4 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-600/60">
            {loading ? (
              <p className="text-xs text-purple-400/80 animate-pulse text-center py-10 font-mono">Syncing exam registers...</p>
            ) : exams.length === 0 ? (
              <p className="text-zinc-600 text-xs italic text-center py-12">No evaluation logs found.</p>
            ) : (
              exams.map((exam) => {
                const isSelected = selectedExamId === exam.id;
                const daysLeft = calculateDaysRemaining(exam.exam_date);
                const countdown = formatCountdownLabel(daysLeft);
                const currentProgress = getExamSyllabusMetrics(exam).pct;

                return (
                  <div
                    key={exam.id}
                    onClick={() => setSelectedExamId(exam.id)}
                    className={`p-3.5 border rounded-xl cursor-pointer transition-all flex flex-col justify-between group min-h-[96px] text-left relative overflow-hidden ${
                      isSelected ? 'bg-[#1a1235]/30 border-purple-500/40' : 'bg-zinc-900/10 border-zinc-900/60 text-zinc-400 hover:border-zinc-800'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="truncate flex-1">
                        <span className="text-[8px] font-bold uppercase font-sans tracking-wide text-zinc-500 bg-zinc-950/80 border border-zinc-900 px-1.5 py-0.5 rounded inline-block mb-1">{exam.subject}</span>
                        <h4 className="text-xs font-bold text-zinc-200 truncate">{exam.title}</h4>
                      </div>
                      <button onClick={(e) => openDeleteModal(exam.id, e)} className="text-zinc-800 hover:text-red-400 opacity-0 group-hover:opacity-100 p-0.5 transition-opacity shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>

                    <div className="flex justify-between items-center border-t border-zinc-900/50 pt-2.5 mt-2 select-none">
                      <span className="flex items-center gap-1 font-mono text-[9px] text-zinc-500"><Calendar className="w-3 h-3 text-zinc-600"/> {exam.exam_date}</span>
                      <span className={`text-[9px] font-mono uppercase tracking-tight ${countdown.style}`}>{countdown.text}</span>
                    </div>

                    <div className="w-full bg-zinc-950 rounded-full h-1 mt-2.5 overflow-hidden">
                      <div className="bg-purple-500 h-full transition-all duration-500" style={{ width: `${currentProgress}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE DYNAMIC SUBTOPICS WORKSPACE */}
      <div className="lg:col-span-7 flex flex-col gap-5 min-h-0 overflow-hidden">
        <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-5 flex flex-col flex-1 min-h-0 shadow-xl overflow-hidden text-left">
          {!activeExamObj ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 text-xs italic select-none">
              Initialize or focus an exam milestone profile card on the left panel to configure syllabus components.
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between h-full overflow-hidden select-text animate-fade-in">
              <div className="space-y-5 flex-1 flex flex-col overflow-hidden">
                
                {/* Header Profile Info Split Layout containing Donut Chart */}
                <div className="flex items-center justify-between gap-4 border-b border-zinc-900 pb-4 select-none shrink-0">
                  <div className="space-y-1.5 truncate flex-1">
                    <span className="text-[9px] font-black tracking-widest text-purple-400 uppercase font-mono px-2 py-0.5 border border-purple-500/10 bg-purple-950/20 rounded-md">{activeExamObj.subject}</span>
                    <h2 className="text-base font-black text-white tracking-tight truncate mt-1">{activeExamObj.title}</h2>
                    
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-zinc-500 font-bold pt-0.5">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-zinc-700" /> {activeExamObj.exam_date}</span>
                      {activeExamObj.exam_time && (
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-zinc-700" /> {activeExamObj.exam_time}</span>
                      )}
                    </div>
                  </div>

                  {/* PROGRESS DONUT ACCENT */}
                  <div className="relative flex items-center justify-center shrink-0 bg-zinc-950/30 p-1 border border-zinc-900/60 rounded-full" style={{ width: donutSize, height: donutSize }}>
                    <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${donutSize} ${donutSize}`}>
                      <circle cx={donutSize/2} cy={donutSize/2} r={radius} className="stroke-zinc-900" strokeWidth={strokeWidth} fill="transparent" />
                      <circle 
                        cx={donutSize/2} cy={donutSize/2} r={radius} 
                        className="stroke-purple-500 transition-all duration-300 ease-out" 
                        strokeWidth={strokeWidth} fill="transparent"
                        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        style={{ filter: metrics.pct > 0 ? 'drop-shadow(0 0 5px rgba(139,92,246,0.4))' : 'none' }}
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center font-mono">
                      <span className="text-base font-black text-white tracking-tight">{metrics.pct}%</span>
                      <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                        {metrics.completed}/{metrics.total} Units
                      </span>
                    </div>
                  </div>
                </div>

                {/* Subtopic Inline Input Form bar */}
                <form onSubmit={handleAddSyllabusNode} className="flex gap-2 bg-zinc-950/50 p-1 rounded-xl border border-zinc-900 shrink-0 select-none">
                  <input
                    type="text" placeholder="Add custom syllabus chapter / subtopic to track (e.g., Module 1, Unit 2 test)..."
                    value={newSubtopicName} onChange={e => setNewSubtopicName(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none p-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:ring-0 select-text"
                    required
                  />
                  <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all shadow">
                    Add Unit
                  </button>
                </form>

                {/* Interactive Checkbox List Element */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-600/60">
                  {(!activeExamObj.exam_subtopics || activeExamObj.exam_subtopics.length === 0) ? (
                    <p className="text-zinc-600 text-xs italic text-center py-12">No syllabus breakdown items configured yet.</p>
                  ) : (
                    activeExamObj.exam_subtopics.map((subtopic) => (
                      <div
                        key={subtopic.id}
                        className="p-3 bg-zinc-950/30 border border-zinc-900 rounded-xl flex items-center justify-between group transition-all"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleCheckbox(subtopic.id, subtopic.is_completed)}
                          className="flex items-center gap-3 text-left flex-1 min-w-0"
                        >
                          <div className="text-purple-400 shrink-0 transition-transform active:scale-90">
                            {subtopic.is_completed ? (
                              <CheckSquare className="w-4 h-4 fill-purple-500/10" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </div>
                          <span className={`text-xs font-medium truncate ${subtopic.is_completed ? 'line-through text-zinc-600 font-normal' : 'text-zinc-200'}`}>
                            {subtopic.subtopic_name}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveSubtopic(subtopic.id)}
                          className="text-zinc-800 hover:text-red-400 opacity-0 group-hover:opacity-100 p-1 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

              </div>

              <div className="pt-3.5 border-t border-zinc-900 select-none font-mono text-[9px] text-zinc-600 text-left shrink-0 mt-4">
                TrackorA Academic Assessment Ledger Profile Window
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}