import { FFmpeg } from '@ffmpeg/ffmpeg';

import {
  fetchFile,
  toBlobURL,
} from '@ffmpeg/util';


/* =========================================
   CONFIGURACIÓN
========================================= */

const MAX_VIDEO_SIZE =
  50 * 1024 * 1024; // 50 MB

const COMPRESS_FROM =
  20 * 1024 * 1024; // 20 MB

const COMPRESSION_TIMEOUT =
  120000; // 2 minutos


export const VIDEO_LIMITS = {
  maxSize: MAX_VIDEO_SIZE,
  compressFrom: COMPRESS_FROM,
};


/* =========================================
   ESTADO INTERNO DE FFMPEG
========================================= */

let ffmpeg = null;

let ffmpegLoading = null;

let activeProgressHandler = null;

let compressionCancelled = false;


/* =========================================
   ERROR DE CANCELACIÓN
========================================= */

export class VideoCompressionCancelledError
  extends Error {

  constructor() {

    super(
      'La compresión del video fue cancelada.'
    );

    this.name =
      'VideoCompressionCancelledError';

  }

}


/* =========================================
   CARGAR FFMPEG
========================================= */

async function getFFmpeg(
  onStatus
) {

  if (
    ffmpeg &&
    ffmpeg.loaded
  ) {

    return ffmpeg;

  }


  if (ffmpegLoading) {

    return ffmpegLoading;

  }


  ffmpegLoading =
    (async () => {

      const instance =
        new FFmpeg();


      instance.on(
        'log',
        ({ message }) => {

          console.log(
            '[FFmpeg]',
            message
          );

        }
      );


      try {

        compressionCancelled =
          false;


        const baseURL =
          'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';


        onStatus?.(
          'Preparando compresor de video...'
        );


        await instance.load({

          coreURL:
            await toBlobURL(
              `${baseURL}/ffmpeg-core.js`,
              'text/javascript'
            ),

          wasmURL:
            await toBlobURL(
              `${baseURL}/ffmpeg-core.wasm`,
              'application/wasm'
            ),

        });


        if (compressionCancelled) {

          try {
            instance.terminate();
          } catch {
            // Ya estaba terminado.
          }

          throw new VideoCompressionCancelledError();

        }


        ffmpeg =
          instance;


        onStatus?.(
          'Compresor listo.'
        );


        return instance;

      } catch (error) {

        ffmpeg =
          null;

        throw error;

      } finally {

        ffmpegLoading =
          null;

      }

    })();


  return ffmpegLoading;

}


/* =========================================
   VALIDACIONES
========================================= */

export function shouldCompressVideo(
  file
) {

  return Boolean(
    file &&
    file.type?.startsWith(
      'video/'
    ) &&
    file.size >
      COMPRESS_FROM
  );

}


export function isVideoTooLarge(
  file
) {

  return Boolean(
    file &&
    file.type?.startsWith(
      'video/'
    ) &&
    file.size >
      MAX_VIDEO_SIZE
  );

}


/* =========================================
   CANCELAR COMPRESIÓN
========================================= */

export function cancelVideoCompression() {

  compressionCancelled =
    true;


  if (ffmpeg) {

    try {

      ffmpeg.terminate();

    } catch {

      // Puede estar terminado.

    }

  }


  ffmpeg =
    null;

  ffmpegLoading =
    null;

  activeProgressHandler =
    null;

}


/* =========================================
   COMPRIMIR VIDEO
========================================= */

export async function compressVideo(
  file,
  onProgress,
  onStatus
) {

  if (
    !file?.type?.startsWith(
      'video/'
    )
  ) {

    throw new Error(
      'El archivo seleccionado no es un video.'
    );

  }


  if (
    file.size >
    MAX_VIDEO_SIZE
  ) {

    throw new Error(
      'El video supera el límite máximo de 50 MB.'
    );

  }


  /*
   * Los videos pequeños se utilizan
   * directamente.
   *
   * No cargamos FFmpeg innecesariamente.
   */

  if (
    file.size <=
    COMPRESS_FROM
  ) {

    onProgress?.(100);

    onStatus?.(
      'Video listo para compartir.'
    );

    return file;

  }


  compressionCancelled =
    false;


  const engine =
    await getFFmpeg(
      onStatus
    );


  if (compressionCancelled) {

    throw new VideoCompressionCancelledError();

  }


  const uniqueId =
    crypto.randomUUID();


  const inputExtension =
    getExtension(
      file.name
    ) || 'mp4';


  const inputName =
    `input-${uniqueId}.${inputExtension}`;


  const outputName =
    `output-${uniqueId}.mp4`;


  const progressHandler =
    ({ progress }) => {

      if (compressionCancelled) {
        return;
      }


      if (
        typeof progress ===
        'number' &&
        Number.isFinite(progress)
      ) {

        const percentage =
          Math.round(
            progress * 100
          );


        onProgress?.(
          Math.min(
            99,
            Math.max(
              0,
              percentage
            )
          )
        );

      }

    };


  activeProgressHandler =
    progressHandler;


  engine.on(
    'progress',
    progressHandler
  );


  try {

    /* =====================================
       COPIAR ARCHIVO A FFMPEG
    ===================================== */

    onStatus?.(
      'Preparando video...'
    );


    await engine.writeFile(
      inputName,
      await fetchFile(file)
    );


    if (compressionCancelled) {

      throw new VideoCompressionCancelledError();

    }


    /* =====================================
       CONVERSIÓN
    ===================================== */

    onStatus?.(
      'Optimizando video...'
    );


    const exitCode =
      await engine.exec(
        [
          '-i',
          inputName,

          '-vf',
          'scale=1280:720:force_original_aspect_ratio=decrease',

          '-c:v',
          'libx264',

          '-preset',
          'ultrafast',

          '-crf',
          '30',

          '-pix_fmt',
          'yuv420p',

          '-c:a',
          'aac',

          '-b:a',
          '96k',

          '-movflags',
          '+faststart',

          '-y',
          outputName,
        ],
        COMPRESSION_TIMEOUT
      );


    if (compressionCancelled) {

      throw new VideoCompressionCancelledError();

    }


    if (exitCode !== 0) {

      throw new Error(
        'La optimización del video no pudo completarse.'
      );

    }


    /* =====================================
       LEER RESULTADO
    ===================================== */

    onStatus?.(
      'Preparando video final...'
    );


    const data =
      await engine.readFile(
        outputName
      );


    if (compressionCancelled) {

      throw new VideoCompressionCancelledError();

    }


    /*
     * Creamos una copia real del resultado.
     *
     * Evita depender de memoria interna de
     * FFmpeg después de borrar el archivo.
     */

    const bytes =
      new Uint8Array(
        data.length
      );


    bytes.set(
      data
    );


    const optimizedFile =
      new File(
        [bytes],
        createOutputName(
          file.name
        ),
        {
          type:
            'video/mp4',

          lastModified:
            Date.now(),
        }
      );


    /*
     * Si FFmpeg generó un archivo vacío
     * o inválido, nunca lo utilizamos.
     */

    if (
      optimizedFile.size ===
      0
    ) {

      throw new Error(
        'El video optimizado quedó vacío.'
      );

    }


    /*
     * Si la conversión no redujo el peso,
     * conservamos el original.
     */

    if (
      optimizedFile.size >=
      file.size
    ) {

      onProgress?.(100);

      onStatus?.(
        'El video original ya estaba optimizado.'
      );

      return file;

    }


    onProgress?.(100);

    onStatus?.(
      'Video optimizado correctamente.'
    );


    return optimizedFile;

  } catch (error) {

    if (
      compressionCancelled ||
      error instanceof
        VideoCompressionCancelledError ||
      error?.message?.toLowerCase()
        ?.includes(
          'terminate'
        )
    ) {

      throw new VideoCompressionCancelledError();

    }


    throw error;

  } finally {

    /* =====================================
       QUITAR LISTENER
    ===================================== */

    if (
      activeProgressHandler &&
      engine
    ) {

      try {

        engine.off(
          'progress',
          activeProgressHandler
        );

      } catch {

        // Worker terminado.

      }

    }


    activeProgressHandler =
      null;


    /* =====================================
       LIMPIAR ARCHIVOS TEMPORALES
    ===================================== */

    try {

      if (
        engine &&
        engine.loaded
      ) {

        await engine.deleteFile(
          inputName
        );

      }

    } catch {

      // No bloqueamos por limpieza.

    }


    try {

      if (
        engine &&
        engine.loaded
      ) {

        await engine.deleteFile(
          outputName
        );

      }

    } catch {

      // No bloqueamos por limpieza.

    }

  }
  

}

/* =========================================
   NORMALIZAR VIDEO PARA COMPATIBILIDAD
========================================= */

export async function normalizeVideo(
  file,
  onProgress,
  onStatus
) {
  if (!file) {
    throw new Error(
      'No se recibió ningún video.'
    );
  }

  if (file.size > MAX_VIDEO_SIZE) {
    throw new Error(
      'El video supera el límite máximo de 50 MB.'
    );
  }

  compressionCancelled = false;

  const engine =
    await getFFmpeg(onStatus);

  if (compressionCancelled) {
    throw new VideoCompressionCancelledError();
  }

  const uniqueId =
    crypto.randomUUID();

  const inputExtension =
    getExtension(file.name) || 'mp4';

  const inputName =
    `normalize-input-${uniqueId}.${inputExtension}`;

  const outputName =
    `normalize-output-${uniqueId}.mp4`;

  const progressHandler =
    ({ progress }) => {
      if (compressionCancelled) {
        return;
      }

      if (
        typeof progress === 'number' &&
        Number.isFinite(progress)
      ) {
        onProgress?.(
          Math.min(
            99,
            Math.max(
              0,
              Math.round(progress * 100)
            )
          )
        );
      }
    };

  activeProgressHandler =
    progressHandler;

  engine.on(
    'progress',
    progressHandler
  );

  try {
    onStatus?.(
      'Preparando video compatible...'
    );

    await engine.writeFile(
      inputName,
      await fetchFile(file)
    );

    if (compressionCancelled) {
      throw new VideoCompressionCancelledError();
    }

    onStatus?.(
      'Adaptando video para tu navegador...'
    );

    const exitCode =
      await engine.exec(
        [
          '-i',
          inputName,

          '-vf',
          'scale=1280:-2:force_original_aspect_ratio=decrease',

          '-c:v',
          'libx264',

          '-preset',
          'ultrafast',

          '-crf',
          '28',

          '-pix_fmt',
          'yuv420p',

          '-c:a',
          'aac',

          '-b:a',
          '96k',

          '-movflags',
          '+faststart',

          '-y',
          outputName,
        ],
        COMPRESSION_TIMEOUT
      );

    if (compressionCancelled) {
      throw new VideoCompressionCancelledError();
    }

    if (exitCode !== 0) {
      throw new Error(
        'No se pudo preparar una versión compatible del video.'
      );
    }

    const data =
      await engine.readFile(
        outputName
      );

    if (compressionCancelled) {
      throw new VideoCompressionCancelledError();
    }

    if (
      !data ||
      typeof data === 'string' ||
      data.length === 0
    ) {
      throw new Error(
        'El video compatible quedó vacío.'
      );
    }

    const bytes =
      new Uint8Array(data.length);

    bytes.set(data);

    const compatibleFile =
      new File(
        [bytes],
        createCompatibleOutputName(
          file.name
        ),
        {
          type: 'video/mp4',
          lastModified: Date.now(),
        }
      );

    if (compatibleFile.size === 0) {
      throw new Error(
        'El video compatible quedó vacío.'
      );
    }

    if (
      compatibleFile.size >
      MAX_VIDEO_SIZE
    ) {
      throw new Error(
        'La versión compatible supera el límite de 50 MB.'
      );
    }

    onProgress?.(100);

    onStatus?.(
      'Video listo para compartir.'
    );

    return compatibleFile;

  } catch (error) {
    if (
      compressionCancelled ||
      error instanceof
        VideoCompressionCancelledError ||
      error?.message
        ?.toLowerCase()
        ?.includes('terminate')
    ) {
      throw new VideoCompressionCancelledError();
    }

    throw error;

  } finally {
    if (
      activeProgressHandler &&
      engine
    ) {
      try {
        engine.off(
          'progress',
          activeProgressHandler
        );
      } catch {
        // Worker terminado.
      }
    }

    activeProgressHandler = null;

    try {
      if (
        engine &&
        engine.loaded
      ) {
        await engine.deleteFile(
          inputName
        );
      }
    } catch {
      // No bloqueamos por limpieza.
    }

    try {
      if (
        engine &&
        engine.loaded
      ) {
        await engine.deleteFile(
          outputName
        );
      }
    } catch {
      // No bloqueamos por limpieza.
    }
  }
}


/* =========================================
   EXTENSIÓN
========================================= */

function getExtension(
  name
) {

  const parts =
    name
      ?.split('.')
      .filter(Boolean);


  return parts?.length > 1
    ? parts.at(-1)
        .toLowerCase()
    : '';

}


/* =========================================
   NOMBRE DE SALIDA
========================================= */

function createOutputName(
  originalName
) {

  const base =
    originalName
      ?.replace(
        /\.[^/.]+$/,
        ''
      )
      ?.replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      ) ||
    'video';


  return `${base}-optimized.mp4`;

}

function createCompatibleOutputName(
  originalName
) {
  const base =
    originalName
      ?.replace(
        /\.[^/.]+$/,
        ''
      )
      ?.replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      ) ||
    'video';

  return `${base}-compatible.mp4`;
}