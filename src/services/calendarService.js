import { supabase } from './supabaseClient.js';

export const calendarService = {
  // Fetch all saved events from the database restricted tightly to current user session
  async getEvents() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized access to calendar registers.");

    // Redirected to map down securely to user_exams matching the calendar component logic
    const { data, error } = await supabase
      .from('user_exams')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('exam_date', { ascending: true });

    if (error) {
      console.error('Error fetching calendar elements:', error.message);
      throw error;
    }

    return (data || []).map(item => ({
      id: item.id,
      date: item.exam_date,
      title: item.title,
      time: '10:00',
      category: item.subject || 'General'
    }));
  },

  // Save a brand new custom event row capturing session user ownership
  async createEvent(event) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication context invalid.");

    const { data, error } = await supabase
      .from('user_exams')
      .insert([
        {
          title: event.title.trim(),
          exam_date: event.date,
          subject: event.category.trim() || 'General',
          user_id: user.id
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating calendar entry node:', error.message);
      throw error;
    }
    return data;
  },

  // Soft delete tracking matrix matching page implementations
  async deleteEvent(id) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('user_exams')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error handling calendar database deletion:', error.message);
      throw error;
    }
    return true;
  }
};