import { supabase } from './supabaseClient.js';

export const goalService = {
  // Fetch active goals with their nested sub-topics locked tightly to authenticated session ID
  async getGoals() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized goals access.");

    const { data: goals, error: goalsError } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (goalsError) throw goalsError;

    const { data: subtopics, error: subtopicsError } = await supabase
      .from('goal_subtopics')
      .select('*')
      .eq('user_id', user.id);

    if (subtopicsError) throw subtopicsError;

    return (goals || []).map(g => {
      const associatedSubtopics = (subtopics || [])
        .filter(sub => sub.goal_id === g.id)
        .map(sub => ({
          id: sub.id,
          title: sub.title,
          is_done: sub.is_done
        }));

      return {
        id: g.id,
        title: g.title,
        is_completed: g.is_completed,
        created_at: g.created_at,
        target_date: g.target_date || 'No Date',
        goal_subtopics: associatedSubtopics
      };
    });
  },

  // Create a parent goal capturing explicit account identity linkage markers
  async createGoal(title, targetDate) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication session required.");

    const { data, error } = await supabase
      .from('user_goals')
      .insert([{ 
        title: title.trim(), 
        target_date: targetDate, 
        is_completed: false, 
        user_id: user.id 
      }])
      .select();

    if (error) throw error;
    return data[0];
  },

  // TARGETED INSERTION: Adds subtopic linked to parent goal id with user row mapping security
  async addSubtopic(goalId, title) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication session required.");

    const { data, error } = await supabase
      .from('goal_subtopics')
      .insert([{ 
        goal_id: goalId, 
        title: title.trim(), 
        is_done: false, 
        user_id: user.id 
      }])
      .select();

    if (error) throw error;
    return data[0];
  },

  async toggleSubtopic(subtopicId, currentStatus) {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('goal_subtopics')
      .update({ is_done: !currentStatus })
      .eq('id', subtopicId)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  async toggleGoalComplete(goalId, nextStatus) {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('user_goals')
      .update({ is_completed: nextStatus })
      .eq('id', goalId)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  async deleteGoal(goalId) {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('user_goals')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', goalId)
      .eq('user_id', user.id);

    if (error) throw error;
  }
};