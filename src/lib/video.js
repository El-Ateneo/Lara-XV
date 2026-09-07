
import { FFmpeg } from '@ffmpeg/ffmpeg';

import {
  fetchFile,
  toBlobURL,
} from '@ffmpeg/util';

const MAX_VIDEO_SIZE =
  50 * 1024 * 1024; // 50 MB

const COMPRESS_FROM =
  20 * 1024 * 1024; // 15 MB

const COMPRESSION_TIMEOUT =
  120000; // 2 minutos

let ffmpeg = null;
let ffmpegLoading = null;
let activeProgressHandler = null;

let compressionCancelled = false;

export const VIDEO_LIMITS = {
  maxSize: MAX_VIDEO_SIZE,
  compressFrom: COMPRESS_FROM,
};

export class VideoCompressionCancelledError extends Error {
  constructor() {
    super(
      'La compresión del video fue cancelada.'
    );

    this.name =
      'VideoCompressionCancelledError';
  }
}

async function getFFmpeg(
  onStatus
) {
  if (ffmpeg) {
    return ffmpeg;
  }

  if (ffmpegLoading) {
    return ffmpegLoading;
  }

  ffmpegLoading = (async () => {
    const instance =
      new FFmpeg();

    ffmpeg = instance;

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
      /*
       * Cancelar cualquier proceso
       * anterior.
       */
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

      onStatus?.(
        'Compresor listo.'
      );

      return instance;
    } catch (error) {
      ffmpegLoading =
        null;

      ffmpeg = null;

      throw error;
    }
  })();

  return ffmpegLoading;
}

export function shouldCompressVideo(
  file
) {
  return (
    file?.type?.startsWith(
      'video/'
    ) &&
    file.size >
      COMPRESS_FROM
  );
}

export function isVideoTooLarge(
  file
) {
  return (
    file?.type?.startsWith(
      'video/'
    ) &&
    file.size >
      MAX_VIDEO_SIZE
  );
}

export function cancelVideoCompression() {
  compressionCancelled =
    true;

  /*
   * FFmpeg.terminate()
   * cancela las operaciones
   * actuales y destruye el worker.
   */
  if (ffmpeg) {
    try {
      ffmpeg.terminate();
    } catch {
      // Ya estaba terminado.
    }
  }

  /*
   * Después de terminate()
   * hay que volver a cargar FFmpeg
   * antes de utilizarlo nuevamente.
   */
  ffmpeg = null;
  ffmpegLoading = null;
  activeProgressHandler = null;
}

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
   * Videos de 15 MB o menos:
   * no se comprimen.
   */
  if (
    file.size <=
    COMPRESS_FROM
  ) {
    return file;
  }

  compressionCancelled =
    false;

  const engine =
    await getFFmpeg(
      onStatus
    );

  if (
    compressionCancelled
  ) {
    throw new VideoCompressionCancelledError();
  }

  const inputExtension =
    getExtension(
      file.name
    ) || 'mp4';

  const inputName =
    `input.${inputExtension}`;

  const outputName =
    'lara-xv-optimized.mp4';

  const progressHandler =
    ({ progress }) => {
      if (
        compressionCancelled
      ) {
        return;
      }

      if (
        typeof progress ===
        'number'
      ) {
        onProgress?.(
          Math.min(
            100,
            Math.max(
              0,
              Math.round(
                progress * 100
              )
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
    /*
     * ======================================
     * ESCRIBIR ARCHIVO
     * ======================================
     */

    onStatus?.(
      'Preparando video...'
    );

    await engine.writeFile(
      inputName,
      await fetchFile(file)
    );

    if (
      compressionCancelled
    ) {
      throw new VideoCompressionCancelledError();
    }

    /*
     * ======================================
     * COMPRIMIR
     * ======================================
     *
     * 1280x720 máximo aproximado.
     *
     * CRF 30:
     * prioriza una reducción importante
     * manteniendo una calidad razonable
     * para TV/celular.
     *
     * ultrafast:
     * prioriza velocidad.
     *
     * AAC 96k:
     * audio suficiente para recuerdos.
     *
     * faststart:
     * favorece reproducción progresiva.
     */

    onStatus?.(
      'Comprimiendo video...'
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

    if (
      compressionCancelled
    ) {
      throw new VideoCompressionCancelledError();
    }

    if (
      exitCode !== 0
    ) {
      throw new Error(
        'La compresión del video no pudo completarse.'
      );
    }

    /*
     * ======================================
     * LEER RESULTADO
     * ======================================
     */

    onStatus?.(
      'Preparando video final...'
    );

    const data =
      await engine.readFile(
        outputName
      );

    if (
      compressionCancelled
    ) {
      throw new VideoCompressionCancelledError();
    }

    const optimizedFile =
      new File(
        [data.buffer],
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
     * Si el resultado es igual o mayor,
     * usamos el original.
     */
    if (
      optimizedFile.size >=
      file.size
    ) {
      onStatus?.(
        'El video ya estaba suficientemente optimizado.'
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
      error?.message?.includes(
        'terminate'
      )
    ) {
      throw new VideoCompressionCancelledError();
    }

    throw error;
  } finally {
    /*
     * Quitar listener para evitar que
     * se acumulen listeners después
     * de varias compresiones.
     */
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
        // El worker puede haber sido terminado.
      }
    }

    activeProgressHandler =
      null;

    /*
     * Limpiar archivos temporales.
     */
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
      // Puede haber sido terminado.
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
      // Puede haber sido terminado.
    }
  }
}

function getExtension(
  name
) {
  const parts =
    name
      ?.split('.')
      .filter(Boolean);

  return parts?.length > 1
    ? parts.at(-1).toLowerCase()
    : '';
}

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
