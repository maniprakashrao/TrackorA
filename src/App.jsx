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

// 🌟 ADDED MISSING IMPORTERS TO RESOLVE THE REFRESH LOOPS
import StudyTracker from './pages/productivity/StudyTracker'; 
import Achievements from './pages/you/Achievements'; 

import { supabase } from './services/supabaseClient';

export default function App() {
  const [session, setSession] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Check initial auth session
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

  // If not authenticated and not on an auth callback/login page, force back to login portal
  if (!session && !isAuthPath) {
    return <Navigate to="/login" replace />;
  }

  // Render full-screen views without sidebars for OAuth and Login sequences
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
    <div className="flex h-screen bg-[#06040a] text-zinc-100 overflow-hidden">
      <Sidebar onLogout={async () => await supabase.auth.signOut()} />
      
      <main className="flex-1 overflow-y-auto p-6 relative">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/analytics" element={<Analytics />} />
          
          {/* 🌟 FIXED: Added active routes to stop the wildcard page loops */}
          <Route path="/study-tracker" element={<StudyTracker />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/goals" element={<Goals />} />
          
          <Route path="/habits" element={<Habits />} />
          <Route path="/diary" element={<Diary />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/placement" element={<Placement />} />
          <Route path="/project-ideas" element={<ProjectIdeas />} />
          <Route path="/settings" element={<Settings />} />
          
          {/* Safe fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}