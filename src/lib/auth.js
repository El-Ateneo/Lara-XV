import { supabase } from './supabase';

export async function signInAnonymous() {
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    throw error;
  }

  return data.user;
}