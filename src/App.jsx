import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Auth from './pages/auth/Login';
import AuthCallback from './pages/auth/AuthCallback';
import Dashboard from './pages/overview/Dashboard';
import Calendar from './pages/overview/Calendar';
import Analytics from './pages/overview/Analytics'; 
import Goals from './pages/productivity/Goals'; 
import Habits from './pages/productivity/Habits';
import Diary from './pages/productivity/Diary';
import Exams from './pages/academic/Exams';
import Placement from './pages/academic/Placement';
import ProjectIdeas from './pages/academic/ProjectIdeas';
import Settings from './pages/you/Settings';
import StudyTracker from './pages/productivity/StudyTracker'; 
import Achievements from './pages/you/Achievements'; 

import { Sidebar as SidebarIcon } from 'lucide-react';
import { supabase } from './services/supabaseClient';

export default function App() {
  const [session, setSession] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  
  // Sidebar state configurations
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthInitialized(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-[#06040a] flex items-center justify-center font-mono text-xs text-purple-400">
        Initializing TrackorA environment systems...
      </div>
    );
  }

  const isAuthPath = location.pathname === '/login' || location.pathname === '/auth/callback';

  if (!session && !isAuthPath) {
    return <Navigate to="/login" replace />;
  }

  if (isAuthPath) {
    return (
      <Routes>
        <Route path="/login" element={<Auth onLoginSuccess={(user) => setSession({ user })} />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#06040a] text-zinc-100 overflow-hidden relative">
      
      {/* MOBILE ACTION BLUR BACKDROP OVERLAY */}
      {mobileSidebarOpen && (
        <div 
          onClick={() => setMobileSidebarOpen(false)} 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
        />
      )}

      {/* SIDEBAR WRAPPER CONTAINER STRIP */}
      <Sidebar 
        onLogout={async () => await supabase.auth.signOut()} 
        isMobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        onDesktopToggle={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
        isExpanded={desktopSidebarOpen}
      />
      
      {/* WORKSPACE CONTENT CONTAINER DECK */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        
        {/* MOBILE TOP BANNER CONTROLLER BAR (Hides completely on desktop layouts) */}
        <header className="md:hidden flex items-center justify-between p-4 bg-[#0B0813] border-b border-zinc-900 z-30 shrink-0">
          <button 
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-950 border border-zinc-855 rounded-xl transition-all shadow-md"
          >
            <SidebarIcon className="w-4 h-4 stroke-[2]" />
          </button>

          <span className="text-xs font-black text-zinc-400 tracking-widest font-mono">TRACKORA</span>
          <div className="w-8 h-8" />
        </header>

        {/* APPLICATION PAGES SCROLL VIEWS */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full h-full p-4 md:p-6 scrolling-touch relative [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/analytics" element={<Analytics />} />
            
            <Route path="/study-tracker" element={<StudyTracker />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/goals" element={<Goals />} />
            
            <Route path="/habits" element={<Habits />} />
            <Route path="/diary" element={<Diary />} />
            <Route path="/exams" element={<Exams />} />
            <Route path="/placement" element={<Placement />} />
            <Route path="/project-ideas" element={<ProjectIdeas />} />
            <Route path="/settings" element={<Settings />} />
            
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}