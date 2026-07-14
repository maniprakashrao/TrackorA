import { supabase } from './supabaseClient.js';

export const habitService = {
  async getHabits() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized habits access.");

    const { data, error } = await supabase
      .from('user_habits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Normalize database fields cleanly for your frontend habits UI context
    return (data || []).map(h => ({
      id: h.id,
      name: h.title,
      target_per_week: h.description ? parseInt(h.description, 10) : 5,
      created_at: h.created_at,
      deleted_at: h.deleted_at
    }));
  },

  async createHabit(name, target) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication session required.");

    const { data, error } = await supabase
      .from('user_habits')
      .insert([{ 
        title: name.trim(), 
        description: String(target), 
        user_id: user.id 
      }])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.title,
      target_per_week: parseInt(data.description, 10),
      created_at: data.created_at,
      deleted_at: data.deleted_at
    };
  },

  async deleteHabit(id) {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('user_habits')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  },

  async getLogs() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized logs access.");

    const { data, error } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_completed', true);

    if (error) throw error;
    return data || [];
  },

  async toggleLog(habitId, dateStr, currentStatus) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication session required.");

    if (currentStatus) {
      const { error } = await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habitId)
        .eq('log_date', dateStr)
        .eq('user_id', user.id);

      if (error) throw error;
      return false;
    } else {
      const { error } = await supabase
        .from('habit_logs')
        .upsert({ 
          habit_id: habitId, 
          log_date: dateStr, 
          is_completed: true, 
          user_id: user.id 
        });

      if (error) throw error;
      return true;
    }
  }
};