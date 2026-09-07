import { supabase } from './supabase';

const EVENT_ID =
  '90eabcfb-7104-4ebf-bd46-401d416f0c83';

export async function getApprovedPosts() {
  const { data, error } = await supabase
    .from('event_posts')
    .select(`
      id,
      event_id,
      author_name,
      message,
      file_url,
      file_type,
      file_name,
      status,
      ai_comment,
      created_at,
      storage_path,
      file_size,
      original_file_name
    `)
    .eq('event_id', EVENT_ID)
    .eq('status', 'approved')
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getPostMediaUrl(postId) {
  const { data, error } =
    await supabase.functions.invoke(
      'get-event-media-url',
      {
        body: {
          postId,
        },
      }
    );

  if (error) {
    throw error;
  }

  return data?.url ?? null;
}
export async function movePostToTrash(postId) {
  return managePostAction('trash', postId);
}

export async function restorePost(postId) {
  return managePostAction('restore', postId);
}

export async function deletePostPermanently(postId) {
  return managePostAction('delete', postId);
}

async function managePostAction(action, postId) {
  if (!postId) {
    throw new Error(
      'Falta el identificador del recuerdo.'
    );
  }

  const { data, error } =
    await supabase.functions.invoke(
      'manage-event-post',
      {
        body: {
          action,
          postId,
        },
      }
    );

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}