import React, { useState, useEffect } from 'react';
import { Save, Upload, Eye, Download, FileText, FolderOpen, Image, Trash2, KeyRound } from 'lucide-react';
import { supabase } from '../../services/supabaseClient.js';

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // Profile Form States
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');

  // Password Setup State
  const [newPassword, setNewPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(false); // 👈 Tracks visibility state

  // Linked Level Profile Metrics
  const [userLevel, setUserLevel] = useState(1);
  const [userXP, setUserXP] = useState(0);

  // Certificates Interface State Configuration
  const [showCertPanel, setShowCertPanel] = useState(false);
  const [certificates, setCertificates] = useState([]);
  const [activeTab, setActiveTab] = useState('College'); 
  
  // New Upload States
  const [certName, setCertName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // File Viewer Lightbox Frame Modal States
  const [viewingCert, setViewingCert] = useState(null);

  const categories = ['School', 'College', 'Academic', 'Other'];

  useEffect(() => {
    fetchUserProfile();
    fetchCertificates();
    compileLinkedLevelProgress();
    
    window.addEventListener('profile-update', fetchUserProfile);
    return () => window.removeEventListener('profile-update', fetchUserProfile);
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setDisplayName(data.display_name || '');
        setUsername(data.username || '');
        setBio(data.bio || '');
        setEmail(data.email || '');
        // 👈 If a custom security password exists in the profile row, flag it to hide layout
        setHasPassword(!!data.security_password); 
      }
    } catch (err) {
      console.error("Profile fetch error context:", err);
    }
  };

  const fetchCertificates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_certificates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) setCertificates(data);
    } catch (err) {
      console.error("Credentials fetch error context:", err);
    }
  };

  const compileLinkedLevelProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('duration_seconds')
        .eq('user_id', user.id);

      const studyCount = sessions ? sessions.length : 0;
      const studySeconds = sessions ? sessions.reduce((sum, s) => sum + s.duration_seconds, 0) : 0;
      const studyHours = parseFloat((studySeconds / 3600).toFixed(1));

      let sequenceStreak = 0;
      if (sessions && sessions.length > 0) {
        const uniqueDates = new Set(sessions.map(s => s.logged_date));
        let checkDate = new Date();
        while (uniqueDates.has(checkDate.toISOString().substring(0, 10))) {
          sequenceStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }

      const { count: habitsCount } = await supabase.from('user_habits').select('*', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null);
      const { count: logsCount } = await supabase.from('habit_logs').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      const { count: goalsCount } = await supabase.from('user_goals').select('*', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null);
      const { count: ideasCount } = await supabase.from('project_ideas').select('*', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null);

      const calculatedXP = (studyCount * 15) + 
                           Math.floor(studyHours * 50) + 
                           (sequenceStreak * 30) + 
                           ((habitsCount || 0) * 20) + 
                           ((logsCount || 0) * 10) + 
                           ((goalsCount || 0) * 25) + 
                           ((ideasCount || 0) * 40);

      setUserXP(calculatedXP);

      let lvl = 1;
      let xpForNextLevel = 500;
      while (calculatedXP >= xpForNextLevel) {
        lvl++;
        xpForNextLevel += lvl * 500;
      }
      setUserLevel(lvl);
    } catch (err) {
      console.error("Experience calculation anomaly:", err);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          display_name: displayName, 
          username: username.trim().toLowerCase(), 
          bio: bio 
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      window.dispatchEvent(new Event('profile-update'));
      alert("Profile alterations successfully retained.");
    } catch (err) {
      alert("Error updating validation fields: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🌟 FIXED: Saves password to Supabase Auth AND the profile table, then hides the layout
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }

    try {
      setPasswordLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Update Supabase Auth instance
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (authError) throw authError;

      // 2. Update user_profiles table tracking reference row
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ security_password: newPassword })
        .eq('id', user.id);
      if (profileError) throw profileError;

      setNewPassword('');
      setHasPassword(true); // 👈 Hide layout panel instantly
      alert("Password successfully linked to your profile ledger!");
    } catch (err) {
      alert("Failed to bind password to account: " + err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!certName.trim() || !selectedFile) return;

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Math.random()}.${fileExt}`;
      const filePath = `vault/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('certificates').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const { error: insertError } = await supabase
        .from('user_certificates')
        .insert([{
          name: certName.trim(),
          category: activeTab,
          file_url: publicUrl,
          file_type: selectedFile.type,
          user_id: user.id
        }]);

      if (insertError) throw insertError;

      setCertName('');
      setSelectedFile(null);
      document.getElementById('file-upload-element').value = '';
      await fetchCertificates();
      alert("Certificate uploaded successfully!");
    } catch (err) {
      alert("Upload error context signature: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCertificate = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to drop this certificate from your records?")) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('user_certificates')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      await fetchCertificates();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownload = async (fileUrl, name) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', name || 'certificate');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      alert("Error generating download data: " + err.message);
    }
  };

  const activeCategoryCertificates = certificates.filter(c => c.category === activeTab);

  return (
    <div className="p-6 max-w-[1400px] mx-auto text-zinc-100 font-sans h-[calc(100vh-7rem)] overflow-y-auto pr-1 select-none [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-600/60">
      
      {viewingCert && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex flex-col p-4 animate-fade-in">
          <div className="flex justify-between items-center text-zinc-300 border-b border-zinc-900 pb-3 select-none shrink-0">
            <h4 className="text-xs font-black uppercase font-mono tracking-wider text-purple-400 flex items-center gap-2">
              {viewingCert.name}
            </h4>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => handleDownload(viewingCert.file_url, viewingCert.name)}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 transition-all"
              >
                Download
              </button>
              <button onClick={() => setViewingCert(null)} className="text-zinc-500 hover:text-zinc-300 text-sm">✕ Close</button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex items-center justify-center p-4 mt-2">
            {viewingCert.file_type.includes('pdf') ? (
              <iframe src={`${viewingCert.file_url}#toolbar=0`} className="w-full h-full max-w-5xl rounded-xl border border-zinc-900" title="PDF Preview Frame" />
            ) : (
              <img src={viewingCert.file_url} className="max-w-full max-h-full object-contain rounded-xl border border-zinc-900 shadow-2xl" alt="Preview Graphic" />
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className={`flex flex-col gap-4 text-left transition-all ${showCertPanel ? 'lg:col-span-5' : 'lg:col-span-8 lg:col-start-3'}`}>
          
          {/* LEVEL PROFILE WIDGET */}
          <div className="bg-gradient-to-br from-[#160f33]/60 to-[#0e0924]/40 backdrop-blur-md border border-purple-500/10 rounded-2xl p-4 shadow-xl flex items-center gap-4 relative overflow-hidden shrink-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white text-lg font-black shadow-md shrink-0">
              {userLevel}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between select-none">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Account Progression</h4>
                <span className="text-[9px] font-mono font-bold text-purple-400">{userXP} Total XP</span>
              </div>
              <p className="text-[10px] text-zinc-500 font-medium truncate mt-0.5">Rank Profile Status: Level {userLevel} Matrix Active</p>
            </div>
          </div>

          {/* PROFILE CONFIG PANEL */}
          <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center border-b border-zinc-900/60 pb-4 mb-5 select-none">
              <h2 className="text-base font-black text-white tracking-tight">Profile</h2>
              <button 
                type="button" 
                onClick={() => setShowCertPanel(!showCertPanel)} 
                className={`px-4 py-1.5 rounded-xl border font-bold text-[10px] uppercase tracking-wider flex items-center gap-2 transition-all ${showCertPanel ? 'bg-purple-600/10 border-purple-500/30 text-purple-300' : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-800'}`}
              >
                <FolderOpen className="w-3.5 h-3.5"/> Credentials Vault
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Display name</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors select-text" required />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors select-text" required />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Bio</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full h-24 bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-300 focus:outline-none focus:border-purple-500 resize-none transition-colors select-text" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Email Address</label>
                <input type="email" value={email} className="w-full bg-[#110f1c] border border-zinc-800/40 rounded-xl p-2.5 text-xs text-zinc-500 cursor-not-allowed select-text" disabled />
              </div>

              <div className="pt-2 select-none">
                <button type="submit" disabled={loading} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5">
                  Save changes
                </button>
              </div>
            </form>
          </div>

          {/* 🌟 FIXED: Conditioned layout card block component structure */}
          {!hasPassword && (
            <div className="bg-[#0f0c1b]/40 backdrop-blur-md border border-zinc-800/60 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              <div className="flex items-center gap-2 border-b border-zinc-900/60 pb-4 mb-5 select-none">
                <KeyRound className="w-4 h-4 text-purple-400" />
                <h2 className="text-base font-black text-white tracking-tight">Set Account Password</h2>
              </div>
              
              <p className="text-[11px] text-zinc-500 mb-4 leading-relaxed">
                If you registered using Google OAuth, your account doesn't have an active password yet. Create one here to lock down manual sign-in access using your username <strong>@{username}</strong> or email address.
              </p>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300">New Password</label>
                  <input 
                    type="password" 
                    placeholder="Enter a secure password (min. 6 characters)..."
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors select-text" 
                    required 
                  />
                </div>

                <div className="pt-1 select-none">
                  <button 
                    type="submit" 
                    disabled={passwordLoading} 
                    className="px-5 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-bold text-xs rounded-xl transition-all"
                  >
                    {passwordLoading ? 'Binding password...' : 'Link Password'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>

        {/* CREDENTIALS CABINET DRAWER */}
        {showCertPanel && (
          <div className="lg:col-span-7 bg-[#0c0a14]/60 backdrop-blur-md border border-zinc-900 rounded-3xl p-5 shadow-2xl flex flex-col h-[calc(100vh-7rem)] text-left overflow-hidden animate-slide-in">
            <div className="flex flex-wrap items-center justify-between border-b border-zinc-900 pb-3 gap-2 select-none shrink-0">
              <div className="flex items-center gap-1 bg-zinc-950 p-1 border border-zinc-900 rounded-xl">
                {categories.map((cat) => (
                  <button
                    key={cat} onClick={() => setActiveTab(cat)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === cat ? 'bg-purple-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowCertPanel(false)} className="text-zinc-600 hover:text-zinc-400 text-xs px-1">✕</button>
            </div>

            <form onSubmit={handleFileUpload} className="grid grid-cols-1 sm:grid-cols-12 gap-2 mt-4 bg-zinc-950/40 border border-zinc-900 p-2 rounded-2xl select-none shrink-0">
              <div className="sm:col-span-5">
                <input 
                  type="text" placeholder="Certificate Name..." value={certName} onChange={e => setCertName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-purple-500 select-text" required
                />
              </div>
              <div className="sm:col-span-4 flex items-center bg-zinc-950 border border-zinc-900 rounded-xl px-2 relative cursor-pointer overflow-hidden group">
                <Upload className="w-3.5 h-3.5 text-zinc-500 mr-2 shrink-0 group-hover:text-purple-400 transition-colors"/>
                <span className="text-[10px] text-zinc-500 font-medium truncate flex-1">
                  {selectedFile ? selectedFile.name : 'Choose Document'}
                </span>
                <input 
                  id="file-upload-element" type="file" accept="application/pdf,image/*"
                  onChange={e => setSelectedFile(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer" required
                />
              </div>
              <div className="sm:col-span-3">
                <button 
                  type="submit" disabled={uploading}
                  className="w-full h-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md"
                >
                  {uploading ? 'Storing...' : 'Save File'}
                </button>
              </div>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 mt-4 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-950/20 [&::-webkit-scrollbar-thumb]:bg-zinc-800/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-600/60">
              {activeCategoryCertificates.length === 0 ? (
                <div className="text-zinc-600 text-xs italic text-center py-16 border border-dashed border-zinc-900/40 rounded-2xl bg-zinc-950/5">
                  No tracking records uploaded inside this profile parameter folder.
                </div>
              ) : (
                activeCategoryCertificates.map((cert) => {
                  const isPdf = cert.file_type?.includes('pdf');
                  return (
                    <div key={cert.id} className="p-3.5 bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800/80 rounded-xl flex items-center justify-between gap-4 group transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-purple-400 shrink-0">
                          {isPdf ? <FileText className="w-4 h-4"/> : <Image className="w-4 h-4"/>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-black text-zinc-200 truncate select-text">{cert.name}</h4>
                          <span className="text-[8px] font-mono font-bold text-zinc-600 uppercase tracking-tight block mt-0.5">
                            Format: {isPdf ? 'PDF document' : 'Graphic Image File'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 select-none">
                        <button type="button" onClick={() => setViewingCert(cert)} className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-purple-500/30 text-zinc-400 hover:text-purple-400 rounded-lg transition-colors"><Eye className="w-3.5 h-3.5"/></button>
                        <button type="button" onClick={() => handleDownload(cert.file_url, cert.name)} className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-emerald-500/30 text-zinc-400 hover:text-emerald-400 rounded-lg transition-colors"><Download className="w-3.5 h-3.5"/></button>
                        <button type="button" onClick={(e) => handleDeleteCertificate(cert.id, e)} className="p-1.5 text-zinc-800 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}