import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient.js';

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [studyData, setStudyData] = useState([]);
  const [subjectBreakdown, setSubjectBreakdown] = useState([]);
  const [habitData, setHabitData] = useState([]);
  const [pipelineData, setPipelineData] = useState({
    wishlist: 0, applied: 0, interview: 0, offer: 0, rejected: 0
  });

  // Hover Tooltip States
  const [hoveredLineIndex, setHoveredLineIndex] = useState(null);
  const [hoveredHabitIndex, setHoveredHabitIndex] = useState(null);
  const [hoveredFunnelIndex, setHoveredFunnelIndex] = useState(null);
  const [hoveredPieIndex, setHoveredPieIndex] = useState(null);

  const stageColors = {
    wishlist: { fill: 'rgba(56, 189, 248, 0.2)', stroke: '#38bdf8' },
    applied: { fill: 'rgba(168, 85, 247, 0.2)', stroke: '#a855f7' },
    interview: { fill: 'rgba(245, 158, 11, 0.2)', stroke: '#f59e0b' },
    offer: { fill: 'rgba(16, 185, 129, 0.2)', stroke: '#10b981' },
    rejected: { fill: 'rgba(244, 63, 94, 0.2)', stroke: '#f43f5e' }
  };

  const generateLast30DaysLabels = () => {
    const labels = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const pad = (num) => String(num).padStart(2, '0');
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      labels.push({
        dateStr,
        displayStr: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      });
    }
    return labels;
  };

  const fetchAnalyticsMetrics = async () => {
    try {
      setLoading(true);
      const labels = generateLast30DaysLabels();
      const startDateStr = labels[0].dateStr;

      // 1. Resolve current user context
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // 2. Fetch Study Session Data isolated to authenticated user
      const { data: studySessions } = await supabase
        .from('study_sessions')
        .select('duration_seconds, logged_date, study_topics(name, color_hex)')
        .eq('user_id', user.id)
        .gte('logged_date', startDateStr);

      const dailyMinutesMap = {};
      labels.forEach(l => { dailyMinutesMap[l.dateStr] = 0; });
      const subjectSecondsMap = {};

      if (studySessions) {
        studySessions.forEach(s => {
          const mins = s.duration_seconds / 60;
          if (dailyMinutesMap[s.logged_date] !== undefined) {
            dailyMinutesMap[s.logged_date] += mins;
          }
          if (s.study_topics) {
            const subjName = s.study_topics.name;
            if (!subjectSecondsMap[subjName]) {
              subjectSecondsMap[subjName] = { seconds: 0, color: s.study_topics.color_hex };
            }
            subjectSecondsMap[subjName].seconds += s.duration_seconds;
          }
        });
      }

      setStudyData(labels.map(l => ({
        label: l.displayStr,
        value: Math.round(dailyMinutesMap[l.dateStr])
      })));

      setSubjectBreakdown(Object.entries(subjectSecondsMap).map(([name, obj]) => ({
        name,
        totalSeconds: obj.seconds,
        color: obj.color
      })));

      // 3. Fetch Habit Data isolated to authenticated user
      const { data: habitLogs } = await supabase
        .from('habit_logs')
        .select('log_date, is_completed')
        .eq('user_id', user.id)
        .gte('log_date', startDateStr);

      const dailyHabitsCountMap = {};
      labels.forEach(l => { dailyHabitsCountMap[l.dateStr] = 0; });

      if (habitLogs) {
        habitLogs.forEach(log => {
          const cleanDateKey = log.log_date ? log.log_date.substring(0, 10) : '';
          if (dailyHabitsCountMap[cleanDateKey] !== undefined && log.is_completed === true) {
            dailyHabitsCountMap[cleanDateKey] += 1;
          }
        });
      }

      setHabitData(labels.map(l => ({
        label: l.displayStr,
        dateStr: l.dateStr,
        totalCount: dailyHabitsCountMap[l.dateStr]
      })));

      // 4. Fetch Real-time Placement Applications Data isolated to authenticated user
      const { data: placementApps } = await supabase
        .from('placement_applications')
        .select('pipeline_stage')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      const pipelineCounts = { wishlist: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
      if (placementApps) {
        placementApps.forEach(app => {
          const stage = app.pipeline_stage?.toLowerCase();
          if (pipelineCounts[stage] !== undefined) {
            pipelineCounts[stage] += 1;
          }
        });
      }
      setPipelineData(pipelineCounts);

    } catch (err) {
      console.error("Error generating analytics visualizations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsMetrics();
  }, []);

  const formatSecondsToReadableString = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  // --- 🎨 INTERACTIVE HOVER LINE CHART (STUDY MINUTES) ---
  const renderLineChart = (data) => {
    if (data.length === 0) return null;
    const width = 500;
    const height = 200;
    const maxVal = Math.max(...data.map(d => d.value), 28);
    
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * (width - 40) + 25;
      const y = height - ((d.value / maxVal) * (height - 40) + 20);
      return { x, y };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - 20} L ${points[0].x} ${height - 20} Z`;

    return (
      <svg className="w-full h-full overflow-visible animate-fade-in" viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((g, idx) => (
          <line key={idx} x1="25" y1={20 + g * (height - 40)} x2={width - 15} y2={20 + g * (height - 40)} className="stroke-zinc-900 stroke-dashed" strokeWidth="1" strokeDasharray="3 3" />
        ))}
        <path d={areaD} className="fill-purple-500/5" />
        <path d={pathD} fill="transparent" className="stroke-[#a855f7]" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHoveredLineIndex(i)} onMouseLeave={() => setHoveredLineIndex(null)}>
            <circle cx={p.x} cy={p.y} r={hoveredLineIndex === i ? "5" : "2"} className={`cursor-pointer transition-all ${hoveredLineIndex === i ? 'fill-purple-400 stroke-purple-600 stroke-2 shadow-lg' : 'fill-purple-500/40'}`} />
            
            {hoveredLineIndex === i && (
              <g className="pointer-events-none animate-fade-in z-50">
                <rect x={p.x - 40} y={p.y - 45} width="80" height="34" rx="6" fill="#0c0a1c" stroke="#3b2d73" strokeWidth="1.2" />
                <text x={p.x} y={p.y - 32} className="fill-zinc-400 font-mono text-[9px] font-bold text-center" textAnchor="middle">{data[i].label}</text>
                <text x={p.x} y={p.y - 20} className="fill-white font-mono text-[10px] font-black text-center" textAnchor="middle">{data[i].value} mins</text>
              </g>
            )}
          </g>
        ))}

        <text x="25" y={height - 2} className="fill-zinc-600 font-mono text-[9px]">{data[0]?.label}</text>
        <text x={width / 2} y={height - 2} className="fill-zinc-600 font-mono text-[9px] text-center" textAnchor="middle">{data[Math.floor(data.length / 2)]?.label}</text>
        <text x={width - 45} y={height - 2} className="fill-zinc-600 font-mono text-[9px] text-right">{data[data.length - 1]?.label}</text>
      </svg>
    );
  };

  const renderPieChart = (data) => {
    if (data.length === 0) {
      return <div className="flex items-center justify-center h-full text-zinc-600 text-xs italic py-12 text-center w-full">No focus logs tracked.</div>;
    }
    const totalSecondsCombined = data.reduce((sum, d) => sum + d.totalSeconds, 0);
    let accumulatedAngle = 0;

    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6 select-none relative animate-fade-in">
        <div className="relative w-40 h-40 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90 scale-110" viewBox="0 0 32 32">
            {data.map((item, idx) => {
              const percentage = totalSecondsCombined > 0 ? (item.totalSeconds / totalSecondsCombined) * 100 : 0;
              const r = 10;
              const circumference = 2 * Math.PI * r;
              const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((accumulatedAngle / 100) * circumference);
              accumulatedAngle += percentage;

              return (
                <circle
                  key={idx} cx="16" cy="16" r={r}
                  fill="transparent"
                  style={{ stroke: item.color }}
                  strokeWidth="3.2"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  onMouseEnter={() => setHoveredPieIndex(idx)}
                  onMouseLeave={() => setHoveredPieIndex(null)}
                  className="transition-all duration-300 cursor-pointer hover:stroke-[4] origin-center"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
            {hoveredPieIndex !== null ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate max-w-full">{data[hoveredPieIndex].name}</span>
                <span className="text-xs font-black font-mono mt-0.5" style={{ color: data[hoveredPieIndex].color }}>{formatSecondsToReadableString(data[hoveredPieIndex].totalSeconds)}</span>
              </>
            ) : (
              <>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono">Total</span>
                <span className="text-xs font-black font-mono text-purple-400 mt-0.5">{formatSecondsToReadableString(totalSecondsCombined)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3.5">
          {data.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-[10px] font-bold tracking-tight">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-zinc-400">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRichBarChart = (data) => {
    if (data.length === 0) return null;
    const width = 500;
    const height = 200;
    const maxVal = Math.max(...data.map(d => d.totalCount), 2);
    const barWidth = (width - 40) / data.length;

    return (
      <svg className="w-full h-full overflow-visible animate-fade-in" viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.5, 1].map((g, idx) => (
          <line key={idx} x1="25" y1={20 + g * (height - 40)} x2={width - 15} y2={20 + g * (height - 40)} className="stroke-zinc-900 stroke-dashed" strokeWidth="1" strokeDasharray="3 3" />
        ))}
        <text x="5" y="24" className="fill-zinc-600 font-mono text-[10px]">{maxVal}</text>
        <text x="5" y={height - 16} className="fill-zinc-600 font-mono text-[10px]">0</text>

        {data.map((d, i) => {
          const barHeight = (d.totalCount / maxVal) * (height - 40);
          const x = 25 + i * barWidth + barWidth * 0.15;
          const y = height - 20 - barHeight;
          const isHovered = hoveredHabitIndex === i;

          return (
            <g key={i} onMouseEnter={() => setHoveredHabitIndex(i)} onMouseLeave={() => setHoveredHabitIndex(null)} className="cursor-pointer">
              <rect
                x={x}
                y={y}
                width={barWidth * 0.7}
                height={Math.max(barHeight, 0)}
                rx="6"
                fill="#c084fc"
                className={`transition-all duration-200 ${isHovered ? 'opacity-100 filter brightness-110' : 'opacity-90'}`}
              />

              {isHovered && d.totalCount > 0 && (
                <g className="pointer-events-none animate-fade-in z-50">
                  <rect x={x - 22} y={y - 42} width="64" height="36" rx="8" fill="#0c0a1c" stroke="#2b2054" strokeWidth="1.2" />
                  <text x={x + (barWidth * 0.7) / 2} y={y - 30} className="fill-zinc-200 font-mono text-[10px] font-black" textAnchor="middle">{d.label}</text>
                  <text x={x + (barWidth * 0.7) / 2} y={y - 16} className="fill-[#c084fc] font-mono text-[10px] font-bold" textAnchor="middle">logs : {d.totalCount}</text>
                </g>
              )}
            </g>
          );
        })}
        <text x="25" y={height - 2} className="fill-zinc-600 font-mono text-[9px]">{data[0]?.label}</text>
        <text x={width / 2} y={height - 2} className="fill-zinc-600 font-mono text-[9px] text-center" textAnchor="middle">{data[Math.floor(data.length / 2)]?.label}</text>
        <text x={width - 45} y={height - 2} className="fill-zinc-600 font-mono text-[9px] text-right">{data[data.length - 1]?.label}</text>
      </svg>
    );
  };

  const renderPipelineFunnel = (data) => {
    const stages = ['wishlist', 'applied', 'interview', 'offer', 'rejected'];
    const width = 500;
    const height = 200;
    const maxVal = Math.max(...stages.map(s => data[s]), 2);
    const barWidth = (width - 40) / stages.length;

    return (
      <svg className="w-full h-full overflow-visible animate-fade-in" viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.5, 1].map((g, idx) => (
          <line key={idx} x1="25" y1={20 + g * (height - 40)} x2={width - 15} y2={20 + g * (height - 40)} className="stroke-zinc-900 stroke-dashed" strokeWidth="1" strokeDasharray="3 3" />
        ))}

        {stages.map((stage, i) => {
          const val = data[stage] || 0;
          const barHeight = (val / maxVal) * (height - 40);
          const x = 25 + i * barWidth + barWidth * 0.15;
          const y = height - 20 - barHeight;
          const isHovered = hoveredFunnelIndex === i;

          const theme = stageColors[stage] || { fill: 'rgba(168, 85, 247, 0.2)', stroke: '#a855f7' };

          return (
            <g key={i} onMouseEnter={() => setHoveredFunnelIndex(i)} onMouseLeave={() => setHoveredFunnelIndex(null)} className="cursor-pointer">
              <rect
                x={x} y={y}
                width={barWidth * 0.7}
                height={Math.max(barHeight, 0)}
                rx="6"
                style={{ fill: theme.fill, stroke: theme.stroke }}
                className={`transition-all duration-300 ${isHovered ? 'filter brightness-125 stroke-[2px]' : 'stroke-[1.2px]'}`}
              />
              
              {isHovered && (
                <g className="pointer-events-none animate-fade-in z-50">
                  <rect x={x - 18} y={y - 32} width="56" height="22" rx="6" fill="#090711" stroke={theme.stroke} strokeWidth="1.2" />
                  <text x={x + (barWidth * 0.7) / 2} y={y - 18} className="fill-zinc-100 font-mono text-[9px] font-black" textAnchor="middle">
                    {val} Apps
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {stages.map((stage, i) => {
          const theme = stageColors[stage] || { stroke: '#a855f7' };
          const isHovered = hoveredFunnelIndex === i;
          return (
            <text 
              key={i} 
              x={25 + i * barWidth + barWidth / 2} 
              y={height - 2} 
              style={{ color: theme.stroke }}
              className={`font-mono text-[9px] font-black text-center uppercase tracking-tighter transition-colors ${isHovered ? 'fill-zinc-100' : 'fill-zinc-600'}`} 
              textAnchor="middle"
            >
              {stage}
            </text>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto text-zinc-100 font-sans grid grid-cols-1 md:grid-cols-2 gap-6 h-[calc(100vh-7rem)] overflow-y-auto pr-1 select-none [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-600/60">
      
      {loading ? (
        <div className="col-span-2 flex flex-col items-center justify-center py-40 text-purple-400 animate-pulse text-xs uppercase tracking-widest font-mono font-bold">
          Syncing performance ledger metrics...
        </div>
      ) : (
        <>
          {/* CARD 1: STUDY TIMELINE */}
          <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-5 flex flex-col justify-between min-h-[290px] shadow-xl">
            <h3 className="text-xs font-bold text-zinc-400 tracking-tight text-left uppercase tracking-wider mb-4">Study minutes — last 30 days</h3>
            <div className="flex-1 flex items-center justify-center">
              {renderLineChart(studyData)}
            </div>
          </div>

          {/* CARD 2: SUBJECT TIME SPLITS */}
          <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-5 flex flex-col justify-between min-h-[290px] shadow-xl">
            <h3 className="text-xs font-bold text-zinc-400 tracking-tight text-left uppercase tracking-wider mb-4">Study time by subject</h3>
            <div className="flex-1">
              {renderPieChart(subjectBreakdown)}
            </div>
          </div>

          {/* CARD 3: HABIT COMPLETIONS */}
          <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-5 flex flex-col justify-between min-h-[290px] shadow-xl">
            <h3 className="text-xs font-bold text-zinc-400 tracking-tight text-left uppercase tracking-wider mb-4">Habit completions — last 30 days</h3>
            <div className="flex-1 flex items-center justify-center">
              {renderRichBarChart(habitData)}
            </div>
          </div>

          {/* CARD 4: RECOLORED RECRUITMENT PIPELINE */}
          <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-5 flex flex-col justify-between min-h-[290px] shadow-xl">
            <h3 className="text-xs font-bold text-zinc-400 tracking-tight text-left uppercase tracking-wider mb-4">Placement pipeline</h3>
            <div className="flex-1 flex items-center justify-center">
              {renderPipelineFunnel(pipelineData)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}