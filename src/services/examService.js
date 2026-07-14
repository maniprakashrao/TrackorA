import { supabase } from './supabaseClient.js';

export const examService = {
  // Fetch exams with nested subtopic arrays locked to the active user session
  async getExamsWorkspace() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized workspace access.");

    // Query exams for this user
    const { data: exams, error: examsError } = await supabase
      .from('user_exams')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('exam_date', { ascending: true });

    if (examsError) throw examsError;

    // Fetch matching checklist subtopics linked to this user's exam cards
    const { data: subtopics, error: subtopicsError } = await supabase
      .from('goal_subtopics')
      .select('*')
      .eq('user_id', user.id);

    if (subtopicsError) throw subtopicsError;

    // Compile the two collections back together inside local memory to match frontend parameters
    return (exams || []).map(exam => {
      const associatedSubtopics = (subtopics || [])
        .filter(sub => sub.goal_id === exam.id)
        .map(sub => ({
          id: sub.id,
          subtopic_name: sub.title,
          is_completed: sub.is_done
        }));

      return {
        ...exam,
        exam_subtopics: associatedSubtopics
      };
    });
  },

  async createExam(title, subject, examDate, examTime) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication session required.");

    const { data, error } = await supabase
      .from('user_exams')
      .insert([{ 
        title: title.trim(), 
        subject: subject.trim(), 
        exam_date: examDate, 
        user_id: user.id 
      }])
      .select();

    if (error) throw error;
    return data[0];
  },

  // Append a syllabus item subtopic under a parent exam node ID capturing explicit user ownership
  async addSubtopic(examId, name) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication session required.");

    const { data, error } = await supabase
      .from('goal_subtopics')
      .insert([{ 
        goal_id: examId, 
        title: name.trim(), 
        is_done: false, 
        user_id: user.id 
      }])
      .select();

    if (error) throw error;
    
    return {
      id: data[0].id,
      subtopic_name: data[0].title,
      is_completed: data[0].is_done
    };
  },

  // Toggle checklist checkbox state attributes safely checking user isolation
  async toggleSubtopicState(subtopicId, currentState) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('goal_subtopics')
      .update({ is_done: !currentState })
      .eq('id', subtopicId)
      .eq('user_id', user.id)
      .select();

    if (error) throw error;
    
    return {
      id: data[0].id,
      subtopic_name: data[0].title,
      is_completed: data[0].is_done
    };
  },

  // Remove individual subtopic log rows guarded by user verification locks
  async deleteSubtopic(subtopicId) {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('goal_subtopics')
      .delete()
      .eq('id', subtopicId)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  },

  async deleteExam(id) {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('user_exams')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  }
};