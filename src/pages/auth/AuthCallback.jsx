import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient.js';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCaptureOAuthFlow = async () => {
      try {
        // Exchange trailing token verification signatures with Supabase Auth Engine Cloud
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user) {
          console.error("Session resolve fault inside callback router container:", sessionError);
          return navigate('/login', { replace: true });
        }

        const user = session.user;

        // 1. Verify corresponding target user_profiles table entry log
        const { data: profile, error: profileCheckError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        // 2. Just-In-Time (JIT) creation routine fallback if background triggers lag
        if (!profile && !profileCheckError) {
          const defaultUsername = user.email 
            ? user.email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 6) 
            : 'user_' + user.id.substring(0, 6);
          const defaultName = user.user_metadata?.full_name || user.user_metadata?.name || defaultUsername;

          await supabase
            .from('user_profiles')
            .insert([
              {
                id: user.id,
                email: user.email,
                username: defaultUsername.toLowerCase(),
                display_name: defaultName,
                bio: ''
              }
            ]);
        }

        // 3. Clear cache tracking states, broadcast updates, and force routing directly into /dashboard
        localStorage.removeItem('oauth_mode');
        window.dispatchEvent(new Event('profile-update')); 
        navigate('/dashboard', { replace: true });

      } catch (err) {
        console.error("Critical OAuth callback route failure exception:", err);
        navigate('/login', { replace: true });
      }
    };

    handleCaptureOAuthFlow();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#06040a] flex flex-col items-center justify-center font-mono text-xs text-purple-400 gap-3">
      <div className="w-5 h-5 border-2 border-t-transparent border-purple-500 rounded-full animate-spin" />
      <span>Processing authenticated handshake tokens safely...</span>
    </div>
  );
}