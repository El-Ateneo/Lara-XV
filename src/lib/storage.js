import { supabase } from './supabase';

const BUCKET_NAME = 'event-media';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function uploadEventMedia({
  file,
  originalFileName,
  userId,
  eventId,
  authorName,
  message = '',
}) {
  if (!file) {
    throw new Error('No se seleccionó ningún archivo.');
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('El tipo de archivo no está permitido.');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('El archivo supera el límite de 50 MB.');
  }

  if (!userId || !eventId) {
    throw new Error('Faltan datos del usuario o del evento.');
  }

  const extension = getExtension(file);
  const fileName = `${crypto.randomUUID()}${extension}`;
  const filePath = `${userId}/${eventId}/${fileName}`;

  // 1. Subir archivo a Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    throw uploadError;
  }

  try {
    // 2. Crear registro en event_posts
    const { error: postError } = await supabase
      .from('event_posts')
      .insert({
        event_id: eventId,
        user_id: userId,
        author_name: authorName || 'Invitado',
        message: message.trim() || null,

        // Nombre del archivo que realmente se almacenó
        file_name: file.name,

        // Nombre original seleccionado por el usuario
        original_file_name: originalFileName || file.name,

        // Tipo y tamaño del archivo final
        file_type: file.type,
        file_size: file.size,

        // Ruta privada dentro de Storage
        storage_path: filePath,

        status: 'pending',
      });

    if (postError) {
      throw postError;
    }

    return {
      path: filePath,
      fileName: file.name,
      originalFileName: originalFileName || file.name,
      fileType: file.type,
      fileSize: file.size,
    };
  } catch (error) {
    // 3. Si falla la DB, eliminamos el archivo recién subido
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    throw error;
  }
}

function getExtension(file) {
  const originalName = file.name || '';

  const originalExtension = originalName.includes('.')
    ? originalName
        .substring(originalName.lastIndexOf('.'))
        .toLowerCase()
    : '';

  const extensionsByType = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
  };

  return extensionsByType[file.type] || originalExtension;
}
export async function createEventMediaSignedUrl(
  storagePath,
  expiresIn = 3600
) {
  if (!storagePath) {
    throw new Error('Falta la ruta del archivo.');
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}