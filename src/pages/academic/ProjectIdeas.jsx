import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Link2, Calendar, Lightbulb, Code, GitBranch, Edit2, Check } from 'lucide-react';
import { supabase } from '../../services/supabaseClient.js';

export default function ProjectIdeas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Inline expansion tracking states
  const [expandedIdeaId, setExpandedIdeaId] = useState(null);
  const [editingIdeaId, setEditingIdeaId] = useState(null);

  // Search & Filter state layers
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Form Field States for Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [classification, setClassification] = useState('College Ideas');
  const [priority, setPriority] = useState('Medium');
  const [completeIdea, setCompleteIdea] = useState('');
  const [existingSolutions, setExistingSolutions] = useState('');
  const [improvedSolutions, setImprovedSolutions] = useState('');
  const [techTagsInput, setTechTagsInput] = useState('');
  const [hashTagsInput, setHashTagsInput] = useState('');
  const [linkRows, setLinkRows] = useState([
    { name: 'GitHub Repo', url: '' },
    { name: 'Published Link', url: '' }
  ]);

  // Inline Editing Form Field States
  const [editTitle, setEditTitle] = useState('');
  const [editClassification, setEditClassification] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editCompleteIdea, setEditCompleteIdea] = useState('');
  const [editExistingSolutions, setEditExistingSolutions] = useState('');
  const [editImprovedSolutions, setEditImprovedSolutions] = useState('');
  const [editTechTags, setEditTechTags] = useState('');
  const [editHashTags, setEditHashTags] = useState('');
  const [editLinks, setEditLinks] = useState([]);

  useEffect(() => {
    syncWorkspace();
  }, []);

  const syncWorkspace = async () => {
    try {
      setLoading(true);
      
      // 1. Resolve current user context
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // 2. Query workspace data isolated entirely to active session user id
      const { data, error } = await supabase
        .from('project_ideas')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // FIXED: Normalized maps to match your actual schema columns precisely
      const mappedData = (data || []).map(row => ({
        id: row.id,
        title: row.title,
        classification: row.classification || 'Personal Project',
        status: row.status || 'idea',
        priority: row.priority || 'Medium',
        complete_idea: row.complete_idea || '', // 👈 Targets true database column
        existing_solutions: row.existing_solutions || '',
        improved_solutions: row.improved_solutions || '',
        tech_tags: row.tech_tags || [],       // 👈 Targets true database column
        search_hash_tags: row.search_hash_tags || [],
        links: row.links || [],
        created_at: row.created_at
      }));

      setIdeas(mappedData);
    } catch (err) {
      console.error("Failed loading project ecosystem logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const addLinkRow = () => setLinkRows([...linkRows, { name: '', url: '' }]);
  const removeLinkRow = (index) => setLinkRows(linkRows.filter((_, i) => i !== index));
  const updateLinkRow = (index, field, value) => {
    const updated = [...linkRows];
    updated[index][field] = value;
    setLinkRows(updated);
  };

  const addEditLinkRow = () => setEditLinks([...editLinks, { name: '', url: '' }]);
  const removeEditLinkRow = (index) => setEditLinks(editLinks.filter((_, i) => i !== index));
  const updateEditLinkRow = (index, field, value) => {
    const updated = [...editLinks];
    updated[index][field] = value;
    setEditLinks(updated);
  };

  const handleCreateIdea = async (e) => {
    e.preventDefault();
    if (!title.trim() || !completeIdea.trim()) return;

    const parsedTechTags = techTagsInput.split(',').map(t => t.trim()).filter(Boolean);
    const parsedHashTags = hashTagsInput.split(',').map(t => t.trim()).map(t => t.startsWith('#') ? t : `#${t}`).filter(Boolean);
    const validLinks = linkRows.filter(l => l.name.trim() && l.url.trim());

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // FIXED: Remapped keys to complete_idea and tech_tags to align with the table layout
      const { error } = await supabase
        .from('project_ideas')
        .insert([
          {
            title: title.trim(),
            classification: classification,
            status: 'idea',
            priority: priority,
            complete_idea: completeIdea.trim(), // 👈 Correct target parameter
            existing_solutions: existingSolutions.trim() || null,
            improved_solutions: improvedSolutions.trim() || null,
            tech_tags: parsedTechTags,           // 👈 Correct target parameter
            search_hash_tags: parsedHashTags,
            links: validLinks,
            user_id: user.id
          }
        ]);

      if (error) throw error;

      setShowAddModal(false);
      resetForm();
      await syncWorkspace();
    } catch (err) {
      alert("Error generating project card node: " + err.message);
    }
  };

  const resetForm = () => {
    setTitle('');
    setCompleteIdea('');
    setExistingSolutions('');
    setImprovedSolutions('');
    setTechTagsInput('');
    setHashTagsInput('');
    setLinkRows([
      { name: 'GitHub Repo', url: '' },
      { name: 'Published Link', url: '' }
    ]);
  };

  const handleCardClick = (idea) => {
    if (editingIdeaId) return; 
    setExpandedIdeaId(expandedIdeaId === idea.id ? null : idea.id);
  };

  const startInlineEditing = (idea, e) => {
    e.stopPropagation();
    setEditingIdeaId(idea.id);
    setExpandedIdeaId(idea.id);
    
    setEditTitle(idea.title);
    setEditClassification(idea.classification);
    setEditPriority(idea.priority);
    setEditCompleteIdea(idea.complete_idea);
    setEditExistingSolutions(idea.existing_solutions || '');
    setEditImprovedSolutions(idea.improved_solutions || '');
    setEditTechTags(idea.tech_tags.join(', '));
    setEditHashTags(idea.search_hash_tags.join(', '));
    setEditLinks(Array.isArray(idea.links) ? [...idea.links] : []);
  };

  const saveInlineEditing = async (id, e) => {
    autoFocus: false;
    e.stopPropagation();
    if (!editTitle.trim() || !editCompleteIdea.trim()) return;

    const parsedTechTags = editTechTags.split(',').map(t => t.trim()).filter(Boolean);
    const parsedHashTags = editHashTags.split(',').map(t => t.trim()).map(t => t.startsWith('#') ? t : `#${t}`).filter(Boolean);
    const validLinks = editLinks.filter(l => l.name.trim() && l.url.trim());

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // FIXED: Aligned update parameters to match exact target columns
      const { error } = await supabase
        .from('project_ideas')
        .update({
          title: editTitle.trim(),
          classification: editClassification,
          priority: editPriority,
          complete_idea: editCompleteIdea.trim(), // 👈 Correct column target layout
          existing_solutions: editExistingSolutions.trim() || null,
          improved_solutions: editImprovedSolutions.trim() || null,
          tech_tags: parsedTechTags,              // 👈 Correct column target layout
          search_hash_tags: parsedHashTags,
          links: validLinks
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setEditingIdeaId(null);
      await syncWorkspace();
    } catch (err) {
      alert("Failed saving modified framework specifications: " + err.message);
    }
  };

  const handleStatusChange = async (id, nextStatus, e) => {
    if (e) e.stopPropagation();
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('project_ideas')
        .update({ status: nextStatus })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setIdeas(prev => prev.map(i => i.id === id ? { ...i, status: nextStatus } : i));
    } catch (err) {
      console.error("Error setting project milestone index state:", err);
    }
  };

  const handleDeleteIdea = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this idea entry?")) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('project_ideas')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      if (expandedIdeaId === id) setExpandedIdeaId(null);
      if (editingIdeaId === id) setEditingIdeaId(null);
      await syncWorkspace();
    } catch (err) {
      console.error("Deletion update context processing anomaly:", err);
    }
  };

  const totalCount = ideas.length;
  const hackathonCount = ideas.filter(i => i.classification === 'Hackathon').length;
  const inProgressCount = ideas.filter(i => i.status === 'in-progress').length;
  const completedCount = ideas.filter(i => i.status === 'completed').length;

  const filteredIdeas = ideas.filter(idea => {
    const matchSearch = idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        idea.tech_tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        idea.search_hash_tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCategory = categoryFilter === 'All' || idea.classification === categoryFilter;
    const matchStatus = statusFilter === 'All' || idea.status === statusFilter;
    return matchSearch && matchCategory && matchStatus;
  });

  return (
    <div className="text-zinc-100 font-sans h-[calc(100vh-7rem)] overflow-hidden flex flex-col relative select-none">
      
      {/* SUMMARY COUNTERS TOP ROW GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 shrink-0">
        {[
          { label: 'TOTAL IDEAS', count: totalCount },
          { label: 'HACKATHON', count: hackathonCount },
          { label: 'IN PROGRESS', count: inProgressCount },
          { label: 'COMPLETED', count: completedCount }
        ].map((c, i) => (
          <div key={i} className="bg-[#0f0c1b]/30 backdrop-blur-md border border-zinc-800/60 p-4 rounded-xl flex flex-col justify-between text-left min-h-[75px]">
            <span className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase font-mono">{c.label}</span>
            <span className="text-xl font-black text-purple-400 font-mono mt-1">{c.count}</span>
          </div>
        ))}
      </div>

      {/* SEARCH AND FILTER CONTROL UTILITIES */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0 bg-[#0f0c1b]/20 border border-zinc-900 p-2.5 rounded-xl">
        <div className="flex flex-1 items-center gap-2 max-w-md bg-zinc-950/60 border border-zinc-900 rounded-xl px-3 py-1.5">
          <Search className="w-4 h-4 text-zinc-600 shrink-0" />
          <input 
            type="text" placeholder="Search ideas, tech, tags..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs text-zinc-200 placeholder:text-zinc-600 focus:ring-0 select-text"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-zinc-950 border border-zinc-800 p-2 rounded-xl text-zinc-400 focus:outline-none focus:border-purple-500 text-xs">
            <option value="All">All categories</option>
            <option value="College Ideas">College Ideas</option>
            <option value="Hackathon">Hackathon</option>
            <option value="Personal Project">Personal Project</option>
            <option value="Research">Research</option>
          </select>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-zinc-950 border border-zinc-800 p-2 rounded-xl text-zinc-400 focus:outline-none focus:border-purple-500 text-xs">
            <option value="All">All statuses</option>
            <option value="idea">Idea Stage</option>
            <option value="in-progress">In-Progress</option>
            <option value="completed">Completed</option>
          </select>

          <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-wider transition-all shadow-md">
            <Plus className="w-3.5 h-3.5" /> New idea
          </button>
        </div>
      </div>

      {/* WORKSPACE DECK DISPLAY LIST */}
      <div className="flex-1 overflow-y-auto pr-1 pb-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-600/60">
        {loading ? (
          <p className="text-xs font-mono font-bold text-center py-20 text-purple-400/80 animate-pulse">Syncing pipeline frameworks...</p>
        ) : filteredIdeas.length === 0 ? (
          <div className="text-zinc-600 text-xs italic text-center py-20 border border-dashed border-zinc-900/60 rounded-2xl bg-zinc-950/5">
            No active concepts found matching selected filter scope conditions.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {filteredIdeas.map((idea) => {
              const isExpanded = expandedIdeaId === idea.id;
              const isEditing = editingIdeaId === idea.id;
              const cleanDate = new Date(idea.created_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric'
              });

              return (
                <div
                  key={idea.id}
                  onClick={() => handleCardClick(idea)}
                  className={`p-5 border rounded-2xl transition-all flex flex-col justify-between text-left group gap-4 relative overflow-hidden h-auto ${
                    isExpanded ? 'bg-[#120e24]/40 border-purple-500/40 shadow-xl md:col-span-2' : 'bg-[#0f0c1b]/20 border-zinc-900 hover:border-zinc-800 cursor-pointer'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1.5 min-w-0 flex-1 select-text">
                      {isEditing ? (
                        <div className="grid grid-cols-3 gap-2" onClick={e => e.stopPropagation()}>
                          <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="bg-zinc-950 border border-zinc-800 p-2 rounded-xl text-xs text-white col-span-1" placeholder="Title" />
                          <select value={editClassification} onChange={e => setEditClassification(e.target.value)} className="bg-zinc-950 border border-zinc-800 p-2 rounded-xl text-xs text-zinc-400">
                            <option value="College Ideas">College Ideas</option>
                            <option value="Hackathon">Hackathon</option>
                            <option value="Personal Project">Personal Project</option>
                            <option value="Research">Research</option>
                          </select>
                          <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="bg-zinc-950 border border-zinc-800 p-2 rounded-xl text-xs text-zinc-400">
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-base font-black text-zinc-100 tracking-tight">{idea.title}</h3>
                          <div className="flex flex-wrap gap-1.5 items-center pt-0.5 text-[8px] font-bold font-mono">
                            <span className="px-2 py-0.5 bg-purple-950/40 border border-purple-500/20 text-purple-400 rounded-md uppercase tracking-wider">{idea.classification}</span>
                            <span className={`px-2 py-0.5 border rounded-md uppercase tracking-wider ${idea.priority === 'High' ? 'bg-rose-950/30 border-rose-500/20 text-rose-400' : idea.priority === 'Medium' ? 'bg-amber-950/30 border-amber-500/20 text-amber-400' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}>{idea.priority}</span>
                            <span className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 text-zinc-500 rounded-md capitalize font-sans">{idea.status}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pl-2 select-none" onClick={e => e.stopPropagation()}>
                      {isEditing ? (
                        <button onClick={(e) => saveInlineEditing(idea.id, e)} className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider"><Check className="w-3.5 h-3.5" /> Save</button>
                      ) : (
                        <button onClick={(e) => startInlineEditing(idea, e)} className="text-zinc-500 hover:text-purple-400 p-1.5 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={(e) => handleDeleteIdea(idea.id, e)} className="text-zinc-800 hover:text-red-400 p-1.5 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  {!isExpanded && (
                    <p className="text-xs text-zinc-400 line-clamp-1 truncate select-text bg-[#110f1c]/40 p-3 rounded-xl border border-zinc-900/60 max-w-full font-sans">
                      {idea.complete_idea}
                    </p>
                  )}

                  {isExpanded && (
                    <div className="space-y-4 pt-1 select-text border-t border-zinc-900/60 animate-fade-in" onClick={e => e.stopPropagation()}>
                      <div className="space-y-3.5 text-xs">
                        <div>
                          <span className="text-[9px] text-purple-400 font-mono font-bold uppercase tracking-wider block mb-1 select-none flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> Complete Architectural Idea</span>
                          {isEditing ? (
                            <textarea value={editCompleteIdea} onChange={e => setEditCompleteIdea(e.target.value)} className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 resize-none" />
                          ) : (
                            <div className="text-zinc-300 whitespace-pre-wrap bg-zinc-950/30 p-3.5 border border-zinc-900 rounded-xl font-sans">{idea.complete_idea}</div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="text-[9px] text-amber-500 font-mono font-bold uppercase tracking-wider block mb-1 select-none flex items-center gap-1"><Code className="w-3.5 h-3.5" /> Existing Benchmark Solutions</span>
                            {isEditing ? (
                              <textarea value={editExistingSolutions} onChange={e => setEditExistingSolutions(e.target.value)} className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 resize-none" />
                            ) : (
                              <div className="text-zinc-400 whitespace-pre-wrap pl-3.5 border-l-2 border-zinc-800 min-h-[30px]">{idea.existing_solutions || 'No baseline benchmark products logged.'}</div>
                            )}
                          </div>
                          
                          <div>
                            <span className="text-[9px] text-emerald-500 font-mono font-bold uppercase tracking-wider block mb-1 select-none flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" /> Improved Implementation Blueprint</span>
                            {isEditing ? (
                              <textarea value={editImprovedSolutions} onChange={e => setEditImprovedSolutions(e.target.value)} className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 resize-none" />
                            ) : (
                              <div className="text-zinc-400 whitespace-pre-wrap pl-3.5 border-l-2 border-zinc-800 min-h-[30px]">{idea.improved_solutions || 'No technical enhancements specified.'}</div>
                            )}
                          </div>
                        </div>

                        {isEditing && (
                          <div className="grid grid-cols-2 gap-4 select-none">
                            <div className="space-y-1">
                              <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Tech Tags (Comma separated)</label>
                              <input type="text" value={editTechTags} onChange={e => setEditTechTags(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-white" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Hash Tags (Comma separated)</label>
                              <input type="text" value={editHashTags} onChange={e => setEditHashTags(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-white" />
                            </div>
                          </div>
                        )}

                        {isEditing && (
                          <div className="space-y-2 pt-2 border-t border-zinc-900 select-none">
                            <div className="flex justify-between items-center">
                              <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Resource Reference Links</label>
                              <button type="button" onClick={addEditLinkRow} className="text-[9px] text-purple-400 font-bold uppercase">+ Add Custom Link Row</button>
                            </div>
                            <div className="space-y-2 max-h-28 overflow-y-auto">
                              {editLinks.map((row, rowIdx) => (
                                <div key={rowIdx} className="flex gap-2 items-center">
                                  <input type="text" value={row.name} onChange={e => updateEditLinkRow(rowIdx, 'name', e.target.value)} className="w-1/3 bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-white" placeholder="Label" />
                                  <input type="url" value={row.url} onChange={e => updateEditLinkRow(rowIdx, 'url', e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-white font-mono" placeholder="https://..." />
                                  <button type="button" onClick={() => removeEditLinkRow(rowIdx)} className="text-zinc-600 hover:text-red-400 text-xs px-1">✕</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!isEditing && idea.tech_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 select-none text-[8px] font-bold uppercase font-mono">
                      {idea.tech_tags.map((tag, tIdx) => (
                        <span key={tIdx} className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-md">{tag}</span>
                      ))}
                    </div>
                  )}

                  {!isEditing && (
                    <div className="flex flex-wrap justify-between items-center border-t border-zinc-900/50 pt-3 select-none text-[9px] text-zinc-600 font-mono gap-3" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1 font-bold text-zinc-500"><Calendar className="w-3 h-3 text-zinc-700"/> Logged: {cleanDate}</span>
                        <div className="flex flex-wrap gap-1.5 font-bold tracking-tight text-zinc-500">
                          {idea.search_hash_tags.map((h, hIdx) => (
                            <span key={hIdx} className="hover:text-purple-400/50">{h}</span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 font-sans">
                        <select 
                          value={idea.status} 
                          onChange={e => handleStatusChange(idea.id, e.target.value, e)}
                          className="bg-zinc-950 border border-zinc-900 rounded-lg p-1 text-[9px] font-bold text-zinc-400 focus:outline-none focus:border-purple-500 capitalize cursor-pointer"
                        >
                          <option value="idea">idea</option>
                          <option value="in-progress">in-progress</option>
                          <option value="completed">completed</option>
                        </select>

                        {idea.links && idea.links.length > 0 && (
                          <div className="flex flex-wrap gap-3 select-none">
                            {idea.links.map((link, lIdx) => (
                              <a key={lIdx} href={link.url} target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-0.5 transition-colors">
                                {link.name || 'Link'} <Link2 className="w-2.5 h-2.5" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATION MODAL FORM OVERLAY */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in select-none">
          <form onSubmit={handleCreateIdea} className="bg-[#0c0a14] border border-zinc-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto text-left [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/80 [&::-webkit-scrollbar-thumb]:rounded-full">
            <button type="button" onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 text-sm">✕</button>
            <h3 className="text-sm font-bold text-white tracking-tight text-left">Log New Project Idea</h3>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-1">
                <label className="text-xs font-semibold text-zinc-300">Project Title</label>
                <input type="text" placeholder="e.g. Digit Voting" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors select-text" required />
              </div>
              <div className="space-y-1 col-span-1">
                <label className="text-xs font-semibold text-zinc-300">Classification</label>
                <select value={classification} onChange={e => setClassification(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors">
                  <option value="College Ideas">College Ideas</option>
                  <option value="Hackathon">Hackathon</option>
                  <option value="Personal Project">Personal Project</option>
                  <option value="Research">Research</option>
                </select>
              </div>
              <div className="space-y-1 col-span-1">
                <label className="text-xs font-semibold text-zinc-300">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Complete Architectural Idea</label>
              <textarea placeholder="Describe core execution models, system tech stacks, and scope parameters..." value={completeIdea} onChange={e => setCompleteIdea(e.target.value)} className="w-full h-20 bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-300 focus:outline-none focus:border-purple-500 resize-none transition-colors select-text" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Existing Solutions</label>
                <textarea placeholder="What current applications exist?" value={existingSolutions} onChange={e => setExistingSolutions(e.target.value)} className="w-full h-16 bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-300 focus:outline-none focus:border-purple-500 resize-none transition-colors select-text" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Improved Solution Matrix</label>
                <textarea placeholder="How will your project solve those downfalls uniquely?" value={improvedSolutions} onChange={e => setImprovedSolutions(e.target.value)} className="w-full h-16 bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-300 focus:outline-none focus:border-purple-500 resize-none transition-colors select-text" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Tech Tags (Comma separated)</label>
                <input type="text" placeholder="e.g. Html, Css, React, Vite" value={techTagsInput} onChange={e => setTechTagsInput(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors select-text" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Search Hash Tags (Comma separated)</label>
                <input type="text" placeholder="e.g. College, Education, Security" value={hashTagsInput} onChange={e => setHashTagsInput(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors select-text" />
              </div>
            </div>

            <div className="space-y-2 border-t border-zinc-900 pt-3 select-none">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-zinc-300">Dynamic Resource Target Links</label>
                <button type="button" onClick={addLinkRow} className="text-[10px] text-purple-400 font-bold uppercase hover:text-purple-300">+ Append Custom Resource URL</button>
              </div>
              
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {linkRows.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input 
                      type="text" placeholder="Label Name (e.g. GitHub Repo)" value={row.name}
                      onChange={e => updateLinkRow(idx, 'name', e.target.value)}
                      className="w-1/3 bg-[#110f1c] border border-zinc-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-purple-500 select-text"
                    />
                    <input 
                      type="url" placeholder="https://..." value={row.url}
                      onChange={e => updateLinkRow(idx, 'url', e.target.value)}
                      className="flex-1 bg-[#110f1c] border border-zinc-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono select-text"
                    />
                    {linkRows.length > 1 && (
                      <button type="button" onClick={() => removeLinkRow(idx)} className="text-zinc-600 hover:text-red-400 text-xs p-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-900">
              <button type="submit" className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg">Save Idea</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}