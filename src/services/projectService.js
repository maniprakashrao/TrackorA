import { supabase } from './supabaseClient.js';

export const projectService = {
  async getProjectIdeas() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized project catalog access.");

    const { data, error } = await supabase
      .from('project_ideas')
      .select('*')
      .eq('user_id', user.id)
      .not('classification', 'eq', 'Diary Entry') // Hides diary text notes from main project pipeline
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map columns securely into front-end application parameters
    return (data || []).map(row => ({
      id: row.id,
      title: row.title,
      classification: row.classification || 'Personal Project',
      status: row.status || 'idea',
      priority: row.priority || 'Medium',
      complete_idea: row.description || '',
      existing_solutions: row.existing_solutions || '',
      improved_solutions: row.improved_solutions || '',
      tech_tags: row.tech_stack || [],
      search_hash_tags: row.search_hash_tags || [],
      links: row.links || [],
      created_at: row.created_at
    }));
  },

  async createProjectIdea(payload) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication context invalid.");

    const dbPayload = {
      title: payload.title,
      classification: payload.classification,
      status: payload.status,
      priority: payload.priority,
      description: payload.complete_idea, // aligns property matrix parameters
      existing_solutions: payload.existing_solutions || null,
      improved_solutions: payload.improved_solutions || null,
      tech_stack: payload.tech_tags,
      search_hash_tags: payload.search_hash_tags,
      links: payload.links,
      user_id: user.id
    };

    const { data, error } = await supabase
      .from('project_ideas')
      .insert([dbPayload])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProjectIdea(id, payload) {
    const { data: { user } } = await supabase.auth.getUser();

    const dbPayload = {
      title: payload.title,
      classification: payload.classification,
      priority: payload.priority,
      description: payload.complete_idea,
      existing_solutions: payload.existing_solutions || null,
      improved_solutions: payload.improved_solutions || null,
      tech_stack: payload.tech_tags,
      search_hash_tags: payload.search_hash_tags,
      links: payload.links
    };

    const { data, error } = await supabase
      .from('project_ideas')
      .update(dbPayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProjectStatus(id, newStatus) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('project_ideas')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteProjectIdea(id) {
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