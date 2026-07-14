import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar, BarChart3, Timer, 
  CheckSquare, Target, BookOpen, GraduationCap, 
  Briefcase, Trophy, Settings, LogOut 
} from 'lucide-react';
import { supabase } from '../services/supabaseClient.js';

// 🌟 IMPORT THE RETROFITTED IMAGE ASSET
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

export default function Sidebar({ onLogout }) {
  const location = useLocation();
  const [profileName, setProfileName] = useState('...');
  const [profileEmail, setProfileEmail] = useState('...');

  useEffect(() => {
    syncSidebarUserProfile();

    // Real-time event listener triggers profile synchronization across layouts smoothly
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
    <aside className="w-64 bg-[#0B0813] border-r border-zinc-900 text-zinc-400 flex flex-col h-screen justify-between p-4 shrink-0 select-none">
      <div>
        {/* 🌟 FIXED HEADER BRANDING WITH THE CLOCK TRACKING LOGO */}
        <div className="flex items-center gap-3 px-2 py-4 text-white font-bold text-xl tracking-tight">
          <img 
            src={logoImg} 
            alt="TrackorA" 
            className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(124,58,237,0.35)]" 
          />
          <span>TrackorA</span>
        </div>
        
        <nav className="space-y-5 mt-4">
          {navigation.map((group) => (
            <div key={group.category}>
              <p className="text-[10px] font-semibold text-zinc-600 tracking-wider mb-2 px-2">{group.category}</p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link 
                        to={item.href} 
                        className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                          isActive 
                            ? "bg-purple-600/10 text-purple-400 border border-purple-500/20" 
                            : "hover:bg-zinc-900 hover:text-zinc-200"
                        }`}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-zinc-800 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-3 truncate">
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0 font-mono">
            {avatarLetters}
          </div>
          <div className="truncate text-left">
            <p className="text-xs font-semibold text-zinc-200 truncate">{profileName}</p>
            <p className="text-[10px] text-zinc-500 truncate">{profileEmail}</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}