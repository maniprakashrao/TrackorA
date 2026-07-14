import { supabase } from './supabaseClient.js';

export const placementService = {
  async getApplications() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized placement access.");

    const { data, error } = await supabase
      .from('placement_applications')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Normalizes backend columns to line up perfectly with what MainLayout and Placement UI expect
    return (data || []).map(app => ({
      ...app,
      role_profile: app.role_title // safety bridge mapping fallback
    }));
  },

  async createApplication(company, role, packageDetails, stage, notes = '', applicationLink = '', lastDate = null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication session required.");

    const { data, error } = await supabase
      .from('placement_applications')
      .insert([{ 
        company_name: company.trim(), 
        role_title: role.trim(), 
        role_profile: role.trim(), // syncs duplicate field schemas natively
        package_details: packageDetails.trim() || null, 
        pipeline_stage: stage, 
        application_notes: notes.trim() || null,
        application_link: applicationLink.trim() || null,
        last_date_to_apply: lastDate,
        user_id: user.id 
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateApplicationStage(id, targetStage) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('placement_applications')
      .update({ pipeline_stage: targetStage })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteApplication(id) {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('placement_applications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  }
};