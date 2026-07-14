import { supabase } from './supabaseClient.js';

export const diaryService = {
  // Fetch active journal entries that haven't been soft-deleted matching project_ideas mapping
  async getEntries() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized access to workspace ledger entries.");

    const { data, error } = await supabase
      .from('project_ideas')
      .select('*')
      .eq('user_id', user.id)
      .eq('classification', 'Diary Entry')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      title: row.title,
      content: row.description || '',
      mood: Array.isArray(row.tech_stack) ? row.tech_stack.join(',') : 'Neutral'
    }));
  },

  // Save a brand new daily entry card re-purposing project ideas indices safely
  async createEntry(title, content, mood, entryDate) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication context invalid.");

    const { data, error } = await supabase
      .from('project_ideas')
      .insert([
        {
          title: title,
          classification: 'Diary Entry',
          description: content.trim(),
          tech_stack: mood ? mood.split(',') : ['Neutral'],
          status: 'idea',
          priority: 'Low',
          user_id: user.id
        }
      ])
      .select()
      .single();

    if (error) throw error;
    
    return {
      id: data.id,
      title: data.title,
      content: data.description,
      mood: data.tech_stack.join(',')
    };
  },

  // Update an existing journal entry matrix matching structural column definitions
  async updateEntry(id, title, content, mood) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('project_ideas')
      .update({
        description: content.trim(),
        tech_stack: mood ? mood.split(',') : ['Neutral']
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    
    return {
      id: data.id,
      title: data.title,
      content: data.description,
      mood: data.tech_stack.join(',')
    };
  },

  // Soft-delete an entry row from active workspace displays
  async deleteEntry(id) {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('project_ideas')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  }
};