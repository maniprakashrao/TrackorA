import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, Clock, Tag, List as ListIcon, Grid, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/supabaseClient.js';

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [viewMode, setViewMode] = useState('Month'); 
  
  // Drill-down View State for Sidebar
  const [activeEventDetails, setActiveEventDetails] = useState(null);

  // Custom Confirmation Modal States
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Real-time Date reference setup
  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

  const [currentDate, setCurrentDate] = useState(new Date(todayObj.getFullYear(), todayObj.getMonth(), 1)); 

  // Form States
  const [eventTitle, setEventTitle] = useState('');
  const [eventTime, setEventTime] = useState('10:00');
  const [eventCategory, setEventCategory] = useState('General');

  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const getCalendarCells = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const prevDay = totalDaysInPrevMonth - i;
      const prevMonthIdx = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      cells.push({
        day: prevDay,
        dateStr: `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`,
        isCurrentMonth: false
      });
    }

    for (let i = 1; i <= totalDaysInMonth; i++) {
      cells.push({
        day: i,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        isCurrentMonth: true
      });
    }

    const remainingSlots = 42 - cells.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextMonthIdx = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      cells.push({
        day: i,
        dateStr: `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        isCurrentMonth: false
      });
    }

    return cells;
  };

  const calendarDays = getCalendarCells();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Fixed: Forces both the month focus and lists context viewport back to today's active date coordinates
  const handleToday = () => {
    setCurrentDate(new Date(todayObj.getFullYear(), todayObj.getMonth(), 1));
    setSelectedDate(todayStr);
  };

  const syncWorkspace = async () => {
    try {
      setLoading(true);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // Query only calendar_events belonging to the logged-in user
      const { data: eventsData, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .order('event_date', { ascending: true });

      if (error) throw error;

      const formatted = (eventsData || []).map(item => ({
        id: item.id,
        date: item.event_date,
        title: item.title,
        time: item.event_time ? item.event_time.substring(0, 5) : '10:00',
        category: item.category || 'General'
      }));

      setEvents(formatted);

      if (activeEventDetails) {
        const updatedCurrent = formatted.find(e => e.id === activeEventDetails.id);
        setActiveEventDetails(updatedCurrent || null);
      }
    } catch (err) {
      console.error("Could not sync live calendar records:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncWorkspace();
  }, []);

  const handleDateClick = (dateStr) => {
    setSelectedDate(dateStr);
    setIsAddingEvent(true);
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('calendar_events')
        .insert([
          {
            title: eventTitle.trim(),
            event_date: selectedDate,
            event_time: eventTime ? `${eventTime}:00` : '10:00:00',
            category: eventCategory.trim() || 'General',
            user_id: user.id
          }
        ]);

      if (error) throw error;

      setEventTitle('');
      setEventCategory('General');
      setIsAddingEvent(false);
      await syncWorkspace();
    } catch (err) {
      alert("Database persistence failed: " + err.message);
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
      if (!user) return;

      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', deleteTargetId)
        .eq('user_id', user.id);

      if (error) throw error;

      setShowConfirmModal(false);
      setDeleteTargetId(null);
      setActiveEventDetails(null);
      await syncWorkspace();
    } catch (err) {
      alert("Failed to delete the database item.");
    }
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonthLabel = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  const matchesCurrentMonthView = (eventDateStr) => {
    if (!eventDateStr) return false;
    const [evYear, evMonth] = eventDateStr.split('-');
    return parseInt(evYear) === currentDate.getFullYear() && 
           parseInt(evMonth) === (currentDate.getMonth() + 1);
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-6 max-w-[1600px] mx-auto text-zinc-100 font-sans relative selection:bg-purple-500/30">
      
      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0f0c1b] border border-zinc-800/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-left">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/10 rounded-xl text-red-400 shrink-0 border border-red-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white tracking-tight">Delete Event Target</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Are you absolutely sure you want to remove this event permanently? This process instantly deletes data inside your Supabase cluster.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                type="button" 
                onClick={() => { setShowConfirmModal(false); setDeleteTargetId(null); }}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-xs font-semibold border border-zinc-800/80 transition-all"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={executeConfirmedDelete}
                className="px-5 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-red-600/10"
              >
                Delete Track
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT PANEL */}
      <div className="flex-1 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <button onClick={handlePrevMonth} className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-400 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-xl font-bold tracking-tight text-white min-w-[150px] text-center">
                {currentMonthLabel}
              </h2>
              <button onClick={handleNextMonth} className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-400 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button onClick={handleToday} className="bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold px-4 py-1.5 rounded-lg border border-zinc-800 transition-colors">
              Today
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-zinc-900 p-0.5 rounded-lg border border-zinc-800/80 flex">
              <button 
                onClick={() => setViewMode('Month')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                  viewMode === 'Month' ? "bg-[#22183d]/60 text-purple-400 border border-purple-500/10" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Grid className="w-3.5 h-3.5" /> Month
              </button>
              <button 
                onClick={() => setViewMode('List')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                  viewMode === 'List' ? "bg-[#22183d]/60 text-purple-400 border border-purple-500/10" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <ListIcon className="w-3.5 h-3.5" /> List
              </button>
            </div>
            <button 
              onClick={() => handleDateClick(todayStr)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-lg"
            >
              <Plus className="w-3.5 h-3.5" /> Add event
            </button>
          </div>
        </div>

        <div className="flex-1 bg-[#0f0c1b]/20 border border-zinc-800/60 rounded-xl overflow-hidden flex flex-col relative">
          {loading && (
            <div className="absolute inset-0 bg-[#06040A]/80 backdrop-blur-sm z-50 flex items-center justify-center text-xs text-purple-400 font-medium">
              Syncing with Supabase grid...
            </div>
          )}

          {viewMode === 'Month' ? (
            <>
              <div className="grid grid-cols-7 border-b border-zinc-800/60 bg-[#0b0813]/40 text-center py-2.5">
                {daysOfWeek.map((day) => (
                  <span key={day} className="text-[10px] font-bold text-zinc-500 tracking-wider">{day}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 flex-1 divide-x divide-y divide-zinc-800/40 border-l border-t border-zinc-800/40">
                {calendarDays.map((cell, idx) => {
                  const dayEvents = events.filter(e => e.date === cell.dateStr);
                  const isToday = cell.dateStr === todayStr;
                  const isSelected = selectedDate === cell.dateStr;
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <div
                      key={idx}
                      onClick={() => handleDateClick(cell.dateStr)}
                      className={`p-2 flex flex-col justify-between min-h-[85px] cursor-pointer transition-all duration-150 relative group ${
                        !cell.isCurrentMonth ? 'opacity-20 bg-zinc-950/20' : ''
                      } ${
                        isToday ? 'bg-purple-950/10' : ''
                      } ${
                        isSelected ? 'bg-purple-500/5' : ''
                      } ${
                        hasEvents && cell.isCurrentMonth && !isToday ? 'bg-zinc-900/20 border-b-2 border-b-purple-500/20' : ''
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-md transition-all ${
                          isToday 
                            ? 'bg-[#8B5CF6] text-white font-bold shadow-md scale-105' 
                            : hasEvents && cell.isCurrentMonth
                            ? 'text-purple-400 font-medium bg-purple-950/20'
                            : !cell.isCurrentMonth
                            ? 'text-zinc-600'
                            : 'text-zinc-400 group-hover:text-zinc-200'
                        }`}>
                          {cell.day}
                        </span>
                        
                        {/* 🌟 LIVE DOT TYPE INDICATOR RING MARKER */}
                        {isToday && (
                          <span className="relative flex h-2 w-2 mr-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 mt-1 overflow-hidden w-full text-left">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div 
                            key={ev.id} 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveEventDetails(ev);
                              setIsAddingEvent(false);
                            }}
                            className="text-[9px] font-medium px-1.5 py-0.5 rounded truncate bg-purple-950/40 text-purple-300 border border-purple-500/10 hover:border-purple-400"
                          >
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[8px] text-purple-400 font-bold pl-1">+{dayEvents.length - 2} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-left">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-400">Master Sheet Records</h3>
                <span className="text-xs bg-zinc-900 px-2.5 py-1 rounded-md text-zinc-500 font-medium">
                  {events.length} total events logged
                </span>
              </div>
              {events.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs italic">No event markers found in the database.</div>
              ) : (
                <div className="divide-y divide-zinc-800/60">
                  {events.map((ev) => {
                    const isEventToday = ev.date === todayStr;
                    return (
                      <div 
                        key={ev.id} 
                        onClick={() => { setActiveEventDetails(ev); setIsAddingEvent(false); }} 
                        className={`py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group cursor-pointer hover:bg-zinc-900/10 px-2 rounded-xl transition-all ${
                          isEventToday ? 'bg-purple-950/5 border-l-2 border-purple-500 pl-3' : ''
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">{ev.title}</span>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">{ev.category}</span>
                            {isEventToday && (
                              <span className="text-[8px] px-1.5 py-0.2 bg-purple-600 text-white font-black uppercase font-mono rounded animate-pulse">Live Today</span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Time: {ev.time}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-xs font-mono font-bold border px-3 py-1 rounded-lg ${
                            isEventToday ? 'text-purple-400 bg-purple-950/20 border-purple-500/30' : 'text-zinc-400 bg-zinc-900 border-zinc-800/80'
                          }`}>
                            {ev.date}
                          </span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); initiateDeleteRequest(ev.id, e); }}
                            className="text-zinc-600 hover:text-red-400 p-1 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE PANEL: REMOVED SUBTOPICS EXTRA LAYOUT PER INPUT SPECIFICATIONS */}
      <div className="w-80 bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-xl p-5 flex flex-col shrink-0 overflow-y-auto text-left">
        {activeEventDetails ? (
          <div className="space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-purple-400 truncate flex-1 pr-2">{activeEventDetails.title}</h3>
                <button type="button" onClick={() => setActiveEventDetails(null)} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-900 space-y-2.5 text-xs text-zinc-400">
                <div className="flex justify-between">
                  <span>Target Date:</span>
                  <span className="font-mono text-zinc-200 font-bold">{activeEventDetails.date}</span>
                </div>
                <div className="flex justify-between">
                  <span>Category classification:</span>
                  <span className="text-purple-400 font-bold uppercase">{activeEventDetails.category}</span>
                </div>
                <div className="flex justify-between">
                  <span>Execution Timestamp:</span>
                  <span className="font-mono text-zinc-200">{activeEventDetails.time}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={(e) => initiateDeleteRequest(activeEventDetails.id, e)}
              className="w-full py-2.5 bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-600 text-red-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete track
            </button>
          </div>
        ) : !isAddingEvent ? (
          <div className="space-y-4 flex-1 flex flex-col">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Active Overview</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">Live tracking for {currentMonthLabel}.</p>
            </div>
            <hr className="border-zinc-800/80" />
            <div className="space-y-3 flex-1 overflow-y-auto pr-0.5">
              {events.filter(e => matchesCurrentMonthView(e.date)).length === 0 ? (
                <p className="text-xs text-zinc-600 italic py-4">No item tracks recorded for this specific month.</p>
              ) : (
                events
                  .filter(e => matchesCurrentMonthView(e.date))
                  .map((ev) => (
                    <div key={ev.id} onClick={() => setActiveEventDetails(ev)} className="p-3 bg-zinc-900/40 border border-zinc-800/50 rounded-lg space-y-1.5 group cursor-pointer border-transparent hover:border-zinc-700/60 transition-all flex justify-between items-center gap-2">
                      <div className="space-y-1 truncate flex-1">
                        <p className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors truncate">{ev.title}</p>
                        <span className="text-[9px] font-medium text-zinc-600 font-mono block">{ev.date}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateEvent} className="space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-purple-400">
                  <CalendarIcon className="w-4 h-4" />
                  <h3 className="text-sm font-bold text-white">Add Event</h3>
                </div>
                <button type="button" onClick={() => setIsAddingEvent(false)} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-zinc-900/60 text-xs font-medium px-3 py-2 rounded-lg border border-zinc-800 text-zinc-400">
                Target Date: <span className="text-purple-400 font-bold font-mono ml-1">{selectedDate}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Event Objective / Title</label>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="e.g., SIH Mock Hackathon Prototype" 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500/60 select-text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Category Tag</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="e.g., Birthday, Meeting, Reminder" 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500/60 select-text"
                    value={eventCategory}
                    onChange={(e) => setEventCategory(e.target.value)}
                  />
                  <Tag className="w-3.5 h-3.5 text-zinc-600 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Timing Checkpoint</label>
                <div className="relative">
                  <input 
                    type="time" 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500/60 text-center font-mono"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                  />
                  <Clock className="w-3.5 h-3.5 text-zinc-600 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-zinc-800/60">
              <button type="button" onClick={() => setIsAddingEvent(false)} className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-400 font-medium text-xs py-2 rounded-lg">
                Cancel
              </button>
              <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs py-2 rounded-lg transition-all">
                Save Track
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  );
}