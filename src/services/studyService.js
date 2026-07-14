import { supabase } from './supabaseClient.js';

export const studyService = {
  async getActiveUserId() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error("Authentication session missing.");
    return user.id;
  },

  async getStudyWorkspace() {
    const userId = await this.getActiveUserId();
    
    // Fetch user-owned topics
    const { data: topicsData, error: topicsErr } = await supabase
      .from('study_topics')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (topicsErr) throw topicsErr;

    // Fetch user-owned sessions
    const { data: sessionsData, error: sessionsErr } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId);

    if (sessionsErr) throw sessionsErr;

    // Clean relation compilation engine loop mapping
    return (topicsData || []).map(topic => {
      const associatedSessions = (sessionsData || [])
        .filter(s => s.topic_id === topic.id)
        .map(s => ({
          id: s.id,
          duration_seconds: s.duration_seconds,
          logged_date: s.logged_date,
          created_at: s.created_at
        }));

      return {
        id: topic.id,
        name: topic.name,
        color_hex: topic.color_hex || '#a855f7',
        study_sessions: associatedSessions
      };
    });
  },

  async createTopic(name) {
    const userId = await this.getActiveUserId();
    const generationColorsArray = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
    const assignedRandomColorHex = generationColorsArray[Math.floor(Math.random() * generationColorsArray.length)];
    
    const { data, error } = await supabase
      .from('study_topics')
      .insert([{ name: name.trim(), color_hex: assignedRandomColorHex, user_id: userId }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async logSession(topicId, durationSeconds, dateKey) {
    const userId = await this.getActiveUserId();
    
    const { data, error } = await supabase
      .from('study_sessions')
      .insert([
        {
          topic_id: topicId,
          duration_seconds: durationSeconds,
          logged_date: dateKey,
          user_id: userId
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteTopic(id) {
    const userId = await this.getActiveUserId();
    
    // Soft-deletes topic row context signature smoothly
    const { error } = await supabase
      .from('study_topics')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }
};