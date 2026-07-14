import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, User, Lock, ArrowRight } from 'lucide-react';
import { supabase } from '../../services/supabaseClient.js';

// 🌟 IMPORT THE CLOCK LOGO INTO THE AUTH SCREEN VIEWPORT
import logoImg from '../../assets/logo.png';

export default function Auth({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin'); // signin or signup
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form Fields State
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  const handleToggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setErrorMsg('');
    setEmail('');
    setUsername('');
    setDisplayName('');
    setPassword('');
  };

  const handleAuthenticationEngine = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const cleanUsername = username.trim().toLowerCase();
        const activePassword = password || 'abcd1234';
        
        // Pre-verify unique user identifier rules
        const { data: existingUser } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('username', cleanUsername)
          .maybeSingle();

        if (existingUser) {
          throw new Error("This username is already taken. Please select another.");
        }

        // Create standard account profile instance
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password: activePassword,
          options: {
            data: {
              display_name: displayName.trim() || username.trim()
            }
          }
        });

        if (authError) throw authError;

        if (authData?.user) {
          // Explicitly saves the credentials password back inside user_profiles table row
          const { error: patchError } = await supabase
            .from('user_profiles')
            .update({ security_password: activePassword })
            .eq('id', authData.user.id);
          
          alert("Account created successfully! Proceeding to your performance workspace dashboard.");
          window.dispatchEvent(new Event('profile-update'));
          if (onLoginSuccess) onLoginSuccess(authData.user);
          navigate('/dashboard');
        }

      } else {
        // --- SIGN IN FLOW ---
        const identifier = email.trim().toLowerCase(); 
        let targetEmail = identifier;

        // Perform lookups on user_profiles if identifier inputted is a custom username segment
        if (!identifier.includes('@')) {
          const { data: profileRecord, error: profileLookupError } = await supabase
            .from('user_profiles')
            .select('email')
            .eq('username', identifier)
            .maybeSingle();

          if (profileLookupError || !profileRecord) {
            throw new Error("No account profile matching that username signature was located.");
          }
          targetEmail = profileRecord.email;
        }

        const activePassword = password;

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password: activePassword,
        });

        if (signInError) throw signInError;

        if (signInData?.user) {
          window.dispatchEvent(new Event('profile-update'));
          if (onLoginSuccess) onLoginSuccess(signInData.user);
          navigate('/dashboard');
        }
      }
    } catch (err) {
      if (err.status === 429 || err.message?.toLowerCase().includes('rate limit')) {
        setErrorMsg("Too many attempts from this connection. Please wait a few moments before trying again.");
      } else {
        setErrorMsg(err.message || "An unexpected validation exception was encountered.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      localStorage.setItem('oauth_mode', mode);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/auth/callback',
        }
      });
      if (error) throw error;
    } catch (err) {
      alert("Google OAuth connection initialization failed: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#06040a] flex flex-col md:flex-row text-zinc-100 font-sans antialiased selection:bg-purple-500/30 select-none">
      
      {/* LEFT SIDE DESCRIPTION LOGO PANEL */}
      <div className="flex-1 bg-[#0b0813] relative overflow-hidden flex items-center justify-center p-8 border-b md:border-b-0 md:border-r border-zinc-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.06),transparent_70%)] pointer-events-none" />
        <div className="space-y-4 max-w-md text-left relative z-10">
          
          {/* 🌟 FIXED LOGO ELEMENT WITH ECOSYSTEM PHRASE REMOVED */}
          <div className="flex items-center gap-3">
            <img 
              src={logoImg} 
              alt="TrackorA" 
              className="w-9 h-9 object-contain drop-shadow-[0_0_12px_rgba(124,58,237,0.4)]" 
            />
            <h2 className="text-xl font-black text-white tracking-tight">TrackorA</h2>
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
            The next generation <br /><span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-400">performance ledger.</span>
          </h1>
          <p className="text-xs text-zinc-500 leading-relaxed font-medium">
            Secure digital milestone verification, real-time checklist sync matrix grids, and profile metrics dashboard environments.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE DATA CONTENT INTERFACE INPUT PANELS */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-600/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="w-full max-w-sm bg-[#0f0c1b]/40 backdrop-blur-xl border border-zinc-800/80 p-8 rounded-3xl shadow-2xl space-y-6 relative z-10">
          
          <div className="flex bg-zinc-950 p-1 border border-zinc-900 rounded-xl">
            <button type="button" onClick={() => { setMode('signin'); setErrorMsg(''); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'signin' ? 'bg-purple-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>Sign In</button>
            <button type="button" onClick={() => { setMode('signup'); setErrorMsg(''); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'signup' ? 'bg-purple-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>Sign Up</button>
          </div>

          <div className="text-left space-y-1">
            <h3 className="text-lg font-bold text-white tracking-tight">{mode === 'signin' ? 'Welcome back' : 'Create Account'}</h3>
            <p className="text-[11px] text-zinc-500">{mode === 'signin' ? 'Enter valid workspace coordinates to fetch ledger' : 'Configure custom identity specifications to initialize'}</p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-left">
              <p className="text-[11px] text-red-400 font-semibold leading-relaxed">⚠️ {errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleAuthenticationEngine} className="space-y-3.5 text-left">
            {mode === 'signup' && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Display Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-3.5 h-3.5 text-zinc-600" />
                    <input type="text" required placeholder="Mani Prakash Rao" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 transition-colors select-text" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Username</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-mono font-bold text-zinc-600">@</span>
                    <input type="text" required placeholder="maniprakash" value={username} onChange={e => setUsername(e.target.value.replace(/\s+/g, ''))} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl py-2 pl-7 pr-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 transition-colors select-text" />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase">{mode === 'signup' ? 'Email Address' : 'Email or Username'}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-3.5 h-3.5 text-zinc-600" />
                <input type="text" required value={email} onChange={e => setEmail(e.target.value)} placeholder={mode === 'signup' ? "name@domain.com" : "Email or username signature..."} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 transition-colors select-text" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase">Security Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-3.5 h-3.5 text-zinc-600" />
                <input type="password" required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#110f1c] border border-zinc-800/80 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 transition-colors select-text" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full mt-2 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
              <span>{loading ? 'Processing transaction...' : mode === 'signin' ? 'Authorize Session' : 'Provision Workspace'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="divider text-[9px] text-zinc-600 font-bold select-none py-1">OR CONTINUE WITH</div>

          <button type="button" onClick={loginWithGoogle} className="w-full py-2.5 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-xs text-zinc-300 font-bold rounded-xl flex items-center justify-center gap-3 transition-colors">
            <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" style={{ width: '14px' }} />
            <span>Connect Google Engine</span>
          </button>

        </div>
      </div>
    </div>
  );
}