
const MAX_IMAGE_WIDTH = 1920;
const MAX_IMAGE_HEIGHT = 1920;
const JPEG_QUALITY = 0.80;


export async function optimizeImage(file) {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // HEIC no siempre puede ser procesado directamente por el navegador.
  if (file.type === 'image/heic') {
    return file;
  }

  const image = await loadImage(file);

  const needsResize =
    image.width > MAX_IMAGE_WIDTH ||
    image.height > MAX_IMAGE_HEIGHT;

  // Si la imagen ya es pequeña y no necesita reducción,
  // conservamos el archivo original.
  if (!needsResize && file.size <= 1024 * 1024) {
    return file;
  }

  const { width, height } = calculateSize(
    image.width,
    image.height
  );

  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('No se pudo preparar la imagen.');
  }

  context.drawImage(
    image,
    0,
    0,
    width,
    height
  );

  const blob = await canvasToBlob(
    canvas,
    'image/jpeg',
    JPEG_QUALITY
  );

  // Si por alguna razón la versión optimizada
  // termina siendo más grande, usamos la original.
  if (blob.size >= file.size) {
    return file;
  }

  return new File(
    [blob],
    createOptimizedFileName(file.name),
    {
      type: 'image/jpeg',
      lastModified: Date.now(),
    }
  );
}


function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error('No se pudo procesar la imagen.')
      );
    };

    image.src = url;
  });
}

function calculateSize(originalWidth, originalHeight) {
  const ratio = Math.min(
    MAX_IMAGE_WIDTH / originalWidth,
    MAX_IMAGE_HEIGHT / originalHeight,
    1
  );

  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio),
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error('No se pudo comprimir la imagen.')
          );
          return;
        }

        resolve(blob);
      },
      type,
      quality
    );
  });
}

function createOptimizedFileName(originalName) {
  const name = originalName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '_');

  return `${name}-optimized.jpg`;
}
