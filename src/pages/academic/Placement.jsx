import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Briefcase, DollarSign, FileText, AlertTriangle, ArrowRight, KanbanSquare, Link2, Calendar } from 'lucide-react';
import { supabase } from '../../services/supabaseClient.js';

export default function Placement() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStageFilter, setActiveStageFilter] = useState('wishlist');

  // Form Field States matching the exact reference layout fields
  const [showAddModal, setShowAddModal] = useState(false);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [packageDetails, setPackageDetails] = useState('');
  const [modalStage, setModalStage] = useState('wishlist'); 
  const [applicationLink, setApplicationLink] = useState('');
  const [lastDate, setLastDate] = useState('');
  const [notes, setNotes] = useState('');

  // Delete Overlay State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const pipelineStages = [
    { key: 'wishlist', label: 'Wishlist' },
    { key: 'applied', label: 'Applied' },
    { key: 'interview', label: 'Interview' },
    { key: 'offer', label: 'Offer' },
    { key: 'rejected', label: 'Rejected' }
  ];

  const syncWorkspace = async () => {
    try {
      setLoading(true);
      
      // 1. Resolve active user session context details
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // 2. Query placement rows restricted tightly to this unique authenticated user
      const { data, error } = await supabase
        .from('placement_applications')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApps(data || []);
    } catch (err) {
      console.error("Failed loading placement data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncWorkspace();
  }, []);

  const handleOpenModal = () => {
    setModalStage(activeStageFilter); 
    setShowAddModal(true);
  };

  const handleCreateApplication = async (e) => {
    e.preventDefault();
    if (!company.trim() || !role.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // FIXED: Switched from role_title to the actual table column key 'role_profile'
      const { error } = await supabase
        .from('placement_applications')
        .insert([
          {
            company_name: company.trim(),
            role_profile: role.trim(), // 👈 Fixed structural mapping
            package_details: packageDetails.trim() || null,
            pipeline_stage: modalStage,
            application_notes: notes.trim() || null,
            application_link: applicationLink.trim() || null,
            last_date_to_apply: lastDate || null,
            user_id: user.id
          }
        ]);

      if (error) throw error;

      setShowAddModal(false);
      setCompany('');
      setRole('');
      setPackageDetails('');
      setApplicationLink('');
      setLastDate('');
      setNotes('');
      await syncWorkspace();
    } catch (err) {
      alert("Error generating tracking pipeline card node: " + err.message);
    }
  };

  const handleAdvanceStage = async (id, currentStage) => {
    const stageSequence = ['wishlist', 'applied', 'interview', 'offer'];
    const currentIdx = stageSequence.indexOf(currentStage);
    if (currentIdx === -1 || currentIdx === stageSequence.length - 1) return;

    const nextStage = stageSequence[currentIdx + 1];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('placement_applications')
        .update({ pipeline_stage: nextStage })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      await syncWorkspace();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkRejected = async (id) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('placement_applications')
        .update({ pipeline_stage: 'rejected' })
        .eq('id', id)
        .eq('user_id', user.id);

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

  const confirmDeleteLog = async () => {
    if (!deleteTargetId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('placement_applications')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteTargetId)
        .eq('user_id', user.id);

      if (error) throw error;

      setShowDeleteModal(false);
      setDeleteTargetId(null);
      await syncWorkspace();
    } catch (err) {
      alert("Error handling database deletion event.");
    }
  };

  const formatDaysRemaining = (targetDateStr) => {
    if (!targetDateStr) return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(targetDateStr);
    target.setHours(0,0,0,0);
    
    const timeDelta = target.getTime() - today.getTime();
    const days = Math.ceil(timeDelta / (1000 * 3600 * 24));
    
    if (days === 0) return "Deadline Today";
    if (days < 0) return `Closed ${Math.abs(days)}d ago`;
    return `${days}d left to apply`;
  };

  const filteredApps = apps.filter(a => a.pipeline_stage === activeStageFilter);

  return (
    <div className="p-6 max-w-[1600px] mx-auto text-zinc-100 font-sans grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-7rem)] overflow-hidden select-none selection:bg-purple-500/20">
      
      {/* GLOBAL DELETE MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0f0c1b] border border-zinc-800 w-full max-w-sm p-5 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl"><AlertTriangle className="w-5 h-5"/></div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white tracking-tight">Purge Application Profile</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">Are you sure you want to completely erase this company tracking log node row profile?</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => { setShowDeleteModal(false); setDeleteTargetId(null); }} className="px-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-xs font-semibold">Cancel</button>
              <button type="button" onClick={confirmDeleteLog} className="px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-xl transition-all shadow-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* COMPOSITION FORM DIALOG */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
          <form onSubmit={handleCreateApplication} className="bg-[#0c0a14] border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 relative text-left">
            <button type="button" onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 text-sm">✕</button>
            <h3 className="text-sm font-bold text-white tracking-tight text-left">Add application</h3>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Company</label>
              <input type="text" value={company} onChange={e => setCompany(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors select-text" required />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Role</label>
              <input type="text" value={role} onChange={e => setRole(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors select-text" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Status</label>
                <select value={modalStage} onChange={e => setModalStage(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors capitalize">
                  {pipelineStages.map(stg => (
                    <option key={stg.key} value={stg.key} className="bg-[#0c0a14] capitalize">{stg.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Stipend / CTC</label>
                <input type="text" placeholder="e.g., 45k/m, 12 LPA" value={packageDetails} onChange={e => setPackageDetails(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors select-text" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Link</label>
                <input type="url" placeholder="https://jobs.company.com/..." value={applicationLink} onChange={e => setApplicationLink(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors font-mono select-text" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Last Date to Apply</label>
                <input type="date" value={lastDate} onChange={e => setLastDate(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors text-center font-mono" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full h-20 bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-300 focus:outline-none focus:border-purple-500 resize-none transition-colors select-text" />
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-purple-600/10">Save</button>
            </div>
          </form>
        </div>
      )}

      {/* LEFT SIDE STAGE FILTER SELECTOR */}
      <div className="lg:col-span-4 flex flex-col gap-5 min-h-0 text-left">
        <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-4 flex flex-col flex-1 min-h-0 shadow-xl overflow-hidden">
          <div className="flex justify-between items-center border-b border-zinc-900 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <KanbanSquare className="w-4 h-4 text-purple-400" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Funnel Pipeline</h3>
                <p className="text-[9px] text-zinc-600 mt-0.5 font-mono">Stage Category Matrices</p>
              </div>
            </div>
            <button onClick={handleOpenModal} className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all shadow"><Plus className="w-3.5 h-3.5"/></button>
          </div>

          <div className="space-y-1.5 mt-4 flex-1 overflow-y-auto pr-0.5">
            {pipelineStages.map((stage) => {
              const isSelected = activeStageFilter === stage.key;
              const countCount = apps.filter(a => a.pipeline_stage === stage.key).length;

              return (
                <div
                  key={stage.key}
                  onClick={() => setActiveStageFilter(stage.key)}
                  className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center justify-between font-sans text-xs font-bold ${
                    isSelected 
                      ? 'bg-[#1a1235]/30 border-purple-500/40 text-purple-300' 
                      : 'bg-zinc-900/10 border-zinc-900/40 text-zinc-500 hover:border-zinc-800/60 hover:text-zinc-300'
                  }`}
                >
                  <span className="capitalize">{stage.label}</span>
                  <span className="text-[10px] font-mono px-2 py-0.2 bg-zinc-950 border border-zinc-900 rounded-md text-zinc-400 font-bold">{countCount}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE JOB ENTRY DISPLAY CANVAS */}
      <div className="lg:col-span-8 flex flex-col gap-5 min-h-0 overflow-hidden text-left">
        <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-4 flex flex-col flex-1 min-h-0 shadow-xl overflow-hidden">
          <div className="flex justify-between items-center border-b border-zinc-900 pb-2.5 shrink-0 select-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              Active Stage Matrix: <span className="text-purple-400 capitalize px-1 font-black">{activeStageFilter}</span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 mt-3 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-600/60">
            {loading ? (
              <p className="text-xs text-purple-400/80 animate-pulse text-center py-12 font-mono">Syncing pipeline records...</p>
            ) : filteredApps.length === 0 ? (
              <div className="text-zinc-600 text-xs italic text-center py-16 border border-dashed border-zinc-900/40 rounded-2xl bg-zinc-950/5">
                No job applications mapped inside this pipeline phase column.
              </div>
            ) : (
              filteredApps.map((app) => {
                const deadlineLabel = formatDaysRemaining(app.last_date_to_apply);

                return (
                  <div 
                    key={app.id} 
                    className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl flex flex-col justify-between gap-3 text-left transition-colors hover:border-zinc-800 relative group animate-fade-in select-text"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex gap-3 items-start min-w-0">
                        <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-purple-400 shrink-0 select-none">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-black text-zinc-100 truncate">{app.company_name}</h4>
                            {app.application_link && (
                              <a href={app.application_link} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-purple-400 transition-colors shrink-0">
                                <Link2 className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          {/* FIXED: Read value dynamically from key 'role_profile' */}
                          <p className="text-[11px] font-medium text-zinc-400 truncate">{app.role_profile}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 select-none shrink-0 pl-2">
                        {deadlineLabel && (
                          <span className="text-[9px] font-mono font-bold bg-purple-950/20 border border-purple-500/10 px-2 py-0.5 rounded-md text-purple-400 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5"/> {deadlineLabel}
                          </span>
                        )}
                        {app.package_details && (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded-md flex items-center font-bold">
                            <DollarSign className="w-2.5 h-2.5 mr-0.5"/>{app.package_details}
                          </span>
                        )}
                        <button 
                          onClick={(e) => openDeleteModal(app.id, e)}
                          className="text-zinc-700 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {app.application_notes && (
                      <p className="text-[11px] leading-relaxed text-zinc-500 font-sans border-t border-zinc-900/60 pt-2 flex items-start gap-1.5">
                        <FileText className="w-3 h-3 text-zinc-700 shrink-0 mt-0.5" />
                        <span className="whitespace-pre-wrap flex-1">{app.application_notes}</span>
                      </p>
                    )}

                    {app.pipeline_stage !== 'rejected' && app.pipeline_stage !== 'offer' && (
                      <div className="flex gap-2 justify-end border-t border-zinc-900/40 pt-2 mt-0.5 select-none">
                        <button 
                          type="button" onClick={() => handleMarkRejected(app.id)}
                          className="text-[9px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-400 px-2 py-1 rounded hover:bg-rose-950/20 transition-all"
                        >
                          Dropped/Rejected
                        </button>
                        <button 
                          type="button" onClick={() => handleAdvanceStage(app.id, app.pipeline_stage)}
                          className="text-[9px] font-black uppercase tracking-wider text-purple-400 hover:text-purple-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-purple-950/20 transition-all"
                        >
                          Advance Stage <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-zinc-900 select-none font-mono text-[9px] text-zinc-600 text-left shrink-0">
            TrackorA Corporate Recruitment Pipeline Index Frame
          </div>
        </div>
      </div>

    </div>
  );
}