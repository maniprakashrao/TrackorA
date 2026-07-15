import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar, BarChart3, Timer, 
  CheckSquare, Target, BookOpen, GraduationCap, 
  Briefcase, Trophy, Settings, LogOut, Sidebar as SidebarIcon
} from 'lucide-react';
import { supabase } from '../services/supabaseClient.js';

import logoImg from '../assets/logo.png';

const navigation = [
  {
    category: "OVERVIEW",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Calendar", href: "/calendar", icon: Calendar },
      { name: "Analytics", href: "/analytics", icon: BarChart3 },
    ]
  },
  {
    category: "PRODUCTIVITY",
    items: [
      { name: "Study Tracker", href: "/study-tracker", icon: Timer },
      { name: "Habits", href: "/habits", icon: CheckSquare },
      { name: "Goals", href: "/goals", icon: Target },
      { name: "Diary", href: "/diary", icon: BookOpen },
    ]
  },
  {
    category: "ACADEMIC",
    items: [
      { name: "Exams", href: "/exams", icon: GraduationCap },
      { name: "Placements", href: "/placement", icon: Briefcase },
      { name: "Project Ideas", href: "/project-ideas", icon: GraduationCap },
    ]
  },
  {
    category: "YOU",
    items: [
      { name: "Achievements", href: "/achievements", icon: Trophy },
      { name: "Settings", href: "/settings", icon: Settings },
    ]
  }
];

export default function Sidebar({ onLogout, isMobileOpen, onMobileClose, onDesktopToggle, isExpanded }) {
  const location = useLocation();
  const [profileName, setProfileName] = useState('...');
  const [profileEmail, setProfileEmail] = useState('...');

  useEffect(() => {
    syncSidebarUserProfile();
    window.addEventListener('profile-update', syncSidebarUserProfile);
    return () => window.removeEventListener('profile-update', syncSidebarUserProfile);
  }, []);

  const syncSidebarUserProfile = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      setProfileEmail(user.email || '');

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('display_name, username')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileError && profile) {
        setProfileName(profile.display_name || profile.username || 'User');
      } else {
        const fallbackName = user.email ? user.email.split('@')[0] : 'User';
        setProfileName(fallbackName);
      }
    } catch (err) {
      console.error("Sidebar runtime profile link failure:", err);
    }
  };

  const avatarLetters = profileName.substring(0, 2).toUpperCase();

  return (
    <aside className={`
      fixed md:static top-0 left-0 z-50 bg-[#0B0813] border-r border-zinc-900 text-zinc-400 
      flex flex-col h-screen justify-between transition-all duration-300 ease-in-out select-none
      ${isExpanded ? "w-64 p-4" : "w-16 p-2 items-center"}
      ${isMobileOpen ? "translate-x-0 w-64 p-4" : "-translate-x-full md:translate-x-0"}
    `}>
      <div className="flex flex-col flex-1 overflow-y-auto w-full overflow-x-hidden pr-0.5 [&::-webkit-scrollbar]:w-0">
        
        {/* 🌟 FIXED HEADER ORDER: TOGGLE OPTION ENGINES ON TOP, LOGO DIRECTLY UNDERNEATH */}
        <div className={`flex py-2 text-white font-bold text-xl tracking-tight ${isExpanded ? "flex-row items-center justify-between px-2" : "flex-col items-center gap-4"}`}>
          
          {/* Toggle Button placed cleanly at the top of the stack order */}
          <button 
            type="button" 
            onClick={window.innerWidth < 768 ? onMobileClose : onDesktopToggle} 
            className="p-2 text-zinc-400 hover:text-purple-400 hover:bg-purple-600/10 border border-transparent hover:border-purple-500/20 rounded-xl transition-all active:scale-95 shadow-sm shrink-0"
            title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <SidebarIcon className="w-4 h-4 stroke-[2]" />
          </button>

          <div className="flex items-center gap-3 shrink-0">
            <img 
              src={logoImg} 
              alt="TrackorA" 
              className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(124,58,237,0.35)] shrink-0" 
            />
            {isExpanded && <span className="animate-fade-in">TrackorA</span>}
          </div>
        </div>
        
        {/* LINKS STRUCTURE LIST */}
        <nav className="space-y-5 mt-4 w-full">
          {navigation.map((group) => (
            <div key={group.category} className="w-full">
              {isExpanded && (
                <p className="text-[10px] font-semibold text-zinc-600 tracking-wider mb-2 px-2 uppercase truncate animate-fade-in">
                  {group.category}
                </p>
              )}
              <ul className="space-y-1 w-full">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <li key={item.name} className="w-full flex justify-center">
                      <Link 
                        to={item.href} 
                        onClick={() => onMobileClose && onMobileClose()}
                        className={`flex items-center font-medium rounded-lg transition-all duration-150 group ${
                          isExpanded 
                            ? "w-full gap-3 px-3 py-2 text-sm" 
                            : "p-2.5 justify-center"
                        } ${
                          isActive 
                            ? "bg-purple-600/10 text-purple-400 border border-purple-500/20" 
                            : "hover:bg-zinc-900 hover:text-zinc-200"
                        }`}
                        title={!isExpanded ? item.name : undefined}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {isExpanded && <span className="truncate text-xs animate-fade-in">{item.name}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* 🌟 CLEANED BOTTOM USER PROFILE: REMOVED DUPLICATE BUTTON TO MATCH THE IMAGE PRECISELY */}
      <div className={`border-t border-zinc-800 pt-4 flex items-center mt-auto shrink-0 w-full justify-center ${isExpanded ? "justify-between" : ""}`}>
        <div className={`flex items-center truncate ${isExpanded ? "gap-3" : "justify-center w-full"}`}>
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0 font-mono">
            {avatarLetters}
          </div>
          {isExpanded && (
            <div className="truncate text-left animate-fade-in">
              <p className="text-xs font-semibold text-zinc-200 truncate">{profileName}</p>
              <p className="text-[10px] text-zinc-500 truncate">{profileEmail}</p>
            </div>
          )}
        </div>

        {isExpanded && (
          <button 
            onClick={onLogout}
            className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}