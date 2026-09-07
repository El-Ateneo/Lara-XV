import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { supabase } from '../lib/supabase';
import { signInAnonymous } from '../lib/auth';

import {
  uploadEventMedia,
} from '../lib/storage';

import { optimizeImage } from '../lib/image';

import {
  compressVideo,
  shouldCompressVideo,
  isVideoTooLarge,
  cancelVideoCompression,
  VideoCompressionCancelledError,
} from '../lib/video';

import AltexBrand from '../components/AltexBrand';

const EVENT_ID =
  '90eabcfb-7104-4ebf-bd46-401d416f0c83';

const LARA_PHOTO_URL =
  'https://res.cloudinary.com/dl81eetla/image/upload/v1788752908/IMG-20260525-WA0088_tm8ya1.jpg';

const MAX_VIDEO_DURATION = 60;

const STICKERS = [
  '👑',
  '🎩',
  '🧢',
  '🕶️',
  '🤓',
  '😎',
  '🥳',
  '🤪',
  '🐰',
  '🐱',
  '🦋',
  '💕',
  '💫',
  '✨',
  '🌸',
  '🎀',
  '💖',
  '🌟',
];

function Guest() {
  const galleryInputRef =
    useRef(null);

  const cameraInputRef =
    useRef(null);

  const [user, setUser] =
    useState(null);

  const [authorName, setAuthorName] =
    useState('');

  const [message, setMessage] =
    useState('');

  const [originalFile, setOriginalFile] =
    useState(null);

  const [optimizedFile, setOptimizedFile] =
    useState(null);

  const [previewUrl, setPreviewUrl] =
    useState('');

  const [uploading, setUploading] =
    useState(false);

  const [preparingVideo, setPreparingVideo] =
    useState(false);

  const [videoProgress, setVideoProgress] =
    useState(0);

  const [preparationStatus, setPreparationStatus] =
    useState('');

  const [result, setResult] =
    useState('');

  const [resultType, setResultType] =
    useState('');

  /*
   * ==========================================
   * IA
   * ==========================================
   */

  const [
    generatingMessage,
    setGeneratingMessage,
  ] = useState(false);

  const [
    messageSuggestions,
    setMessageSuggestions,
  ] = useState([]);

  const [
    showSuggestions,
    setShowSuggestions,
  ] = useState(false);

  /*
   * ==========================================
   * STICKERS
   * ==========================================
   */

  const [stickers, setStickers] =
    useState([]);

  const [
    selectedStickerId,
    setSelectedStickerId,
  ] = useState(null);

  /*
   * ==========================================
   * INICIALIZACIÓN
   * ==========================================
   */

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        let currentUser =
          session?.user;

        if (!currentUser) {
          currentUser =
            await signInAnonymous();
        }

        if (!mounted) {
          return;
        }

        setUser(
          currentUser
        );
      } catch (
        error
      ) {
        console.error(
          'Error inicializando Guest:',
          error
        );

        if (mounted) {
          setResult(
            'No pudimos preparar la experiencia. Recargá la página e intentá nuevamente.'
          );

          setResultType(
            'error'
          );
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * ==========================================
   * DURACIÓN VIDEO
   * ==========================================
   */

  const getVideoDuration =
    (file) =>
      new Promise(
        (
          resolve,
          reject
        ) => {
          const video =
            document.createElement(
              'video'
            );

          const url =
            URL.createObjectURL(
              file
            );

          video.preload =
            'metadata';

          video.onloadedmetadata =
            () => {
              const duration =
                video.duration;

              URL.revokeObjectURL(
                url
              );

              resolve(
                duration
              );
            };

          video.onerror =
            () => {
              URL.revokeObjectURL(
                url
              );

              reject(
                new Error(
                  'No pudimos comprobar la duración del video.'
                )
              );
            };

          video.src =
            url;
        }
      );

  /*
   * ==========================================
   * LIMPIAR ARCHIVO
   * ==========================================
   */

  const clearSelectedFile =
    () => {
      if (previewUrl) {
        URL.revokeObjectURL(
          previewUrl
        );
      }

      setOriginalFile(
        null
      );

      setOptimizedFile(
        null
      );

      setPreviewUrl(
        ''
      );

      setVideoProgress(
        0
      );

      setPreparationStatus(
        ''
      );

      setStickers(
        []
      );

      setSelectedStickerId(
        null
      );

      if (
        galleryInputRef.current
      ) {
        galleryInputRef.current.value =
          '';
      }

      if (
        cameraInputRef.current
      ) {
        cameraInputRef.current.value =
          '';
      }
    };

  /*
   * ==========================================
   * ARCHIVO
   * ==========================================
   */

  const handleFileChange =
    async (
      event
    ) => {
      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      if (previewUrl) {
        URL.revokeObjectURL(
          previewUrl
        );
      }

      setOriginalFile(
        file
      );

      setOptimizedFile(
        null
      );

      setPreviewUrl(
        ''
      );

      setResult(
        ''
      );

      setResultType(
        ''
      );

      setVideoProgress(
        0
      );

      setPreparationStatus(
        ''
      );

      setStickers(
        []
      );

      setSelectedStickerId(
        null
      );

      /*
       * VIDEO > 50 MB
       */

      if (
        isVideoTooLarge(
          file
        )
      ) {
        setResult(
          'El video supera los 50 MB. Elegí uno más corto o pequeño.'
        );

        setResultType(
          'error'
        );

        clearSelectedFile();

        return;
      }

      try {
        /*
         * ======================================
         * VIDEO
         * ======================================
         */

        if (
          file.type.startsWith(
            'video/'
          )
        ) {
          try {
            const duration =
              await getVideoDuration(
                file
              );

            if (
              Number.isFinite(
                duration
              ) &&
              duration >
                MAX_VIDEO_DURATION
            ) {
              setResult(
                'El video puede durar hasta 60 segundos.'
              );

              setResultType(
                'warning'
              );

              clearSelectedFile();

              return;
            }
          } catch (
            durationError
          ) {
            console.warn(
              'No se pudo comprobar la duración:',
              durationError
            );
          }

          if (
            shouldCompressVideo(
              file
            )
          ) {
            setPreparingVideo(
              true
            );

            setPreparationStatus(
              'Preparando tu video...'
            );

            const prepared =
              await compressVideo(
                file,

                progress => {
                  setVideoProgress(
                    progress
                  );
                },

                status => {
                  setPreparationStatus(
                    status
                  );
                }
              );

            setOptimizedFile(
              prepared
            );

            const url =
              URL.createObjectURL(
                prepared
              );

            setPreviewUrl(
              url
            );

            setPreparationStatus(
              'Video listo para compartir.'
            );
          } else {
            setOptimizedFile(
              file
            );

            const url =
              URL.createObjectURL(
                file
              );

            setPreviewUrl(
              url
            );

            setPreparationStatus(
              'Video listo para compartir.'
            );
          }

          return;
        }

        /*
         * ======================================
         * IMAGEN
         * ======================================
         */

        const preparedFile =
          await optimizeImage(
            file
          );

        setOptimizedFile(
          preparedFile
        );

        const url =
          URL.createObjectURL(
            preparedFile
          );

        setPreviewUrl(
          url
        );

        setPreparationStatus(
          'Foto lista para compartir.'
        );
      } catch (
        error
      ) {
        console.error(
          'Error preparando archivo:',
          error
        );

        if (
          error instanceof
          VideoCompressionCancelledError
        ) {
          return;
        }

        setResult(
          `No pudimos preparar el archivo: ${error.message}`
        );

        setResultType(
          'error'
        );

        /*
         * Fallback para video
         */

        if (
          file.type.startsWith(
            'video/'
          ) &&
          file.size <=
            20 *
              1024 *
              1024
        ) {
          setOptimizedFile(
            file
          );

          const url =
            URL.createObjectURL(
              file
            );

          setPreviewUrl(
            url
          );

          setPreparationStatus(
            'Usaremos el video original.'
          );
        } else {
          setOptimizedFile(
            null
          );
        }
      } finally {
        setPreparingVideo(
          false
        );
      }
    };

  /*
   * ==========================================
   * CANCELAR VIDEO
   * ==========================================
   */

  const handleCancelVideo =
    () => {
      cancelVideoCompression();

      setPreparingVideo(
        false
      );

      clearSelectedFile();

      setResult(
        'La preparación del video fue cancelada. Podés elegir otro.'
      );

      setResultType(
        'info'
      );
    };

  /*
   * ==========================================
   * NOMBRE
   * ==========================================
   */

  const handleNameChange =
    event => {
      const value =
        event.target.value;

      if (
        value.length <=
        60
      ) {
        setAuthorName(
          value
        );
      }
    };

  /*
   * ==========================================
   * MENSAJE
   * ==========================================
   */

  const handleMessageChange =
    event => {
      const value =
        event.target.value;

      if (
        value.length <=
        150
      ) {
        setMessage(
          value
        );
      }
    };

  /*
   * ==========================================
   * CÁMARA
   * ==========================================
   */

  const openCamera =
    () => {
      if (
        uploading ||
        preparingVideo
      ) {
        return;
      }

      cameraInputRef.current?.click();
    };

  /*
   * ==========================================
   * GALERÍA
   * ==========================================
   */

  const openGallery =
    () => {
      if (
        uploading ||
        preparingVideo
      ) {
        return;
      }

      galleryInputRef.current?.click();
    };

  /*
   * ==========================================
   * GENERAR SUGERENCIAS IA
   * ==========================================
   */

  const handleGenerateMessage =
    async () => {
      if (
        generatingMessage ||
        uploading
      ) {
        return;
      }

      try {
        setGeneratingMessage(
          true
        );

        setShowSuggestions(
          true
        );

        setResult(
          ''
        );

        setResultType(
          ''
        );

        const {
          data,
          error,
        } =
          await supabase.functions.invoke(
            'generate-guest-message',
            {
              body: {
                authorName:
                  authorName.trim(),

                draft:
                  message.trim(),
              },
            }
          );

        if (error) {
          throw error;
        }

        const suggestions =
          Array.isArray(
            data?.suggestions
          )
            ? data.suggestions
            : [];

        if (
          suggestions.length ===
          0
        ) {
          throw new Error(
            'La IA no devolvió sugerencias.'
          );
        }

        setMessageSuggestions(
          suggestions.slice(
            0,
            3
          )
        );
      } catch (
        error
      ) {
        console.error(
          'Error generando mensaje:',
          error
        );

        setShowSuggestions(
          false
        );

        setResult(
          'No pudimos generar las sugerencias ahora. Podés escribir tu mensaje normalmente.'
        );

        setResultType(
          'warning'
        );
      } finally {
        setGeneratingMessage(
          false
        );
      }
    };

  /*
   * ==========================================
   * USAR SUGERENCIA
   * ==========================================
   */

  const useSuggestion =
    text => {
      if (!text) {
        return;
      }

      setMessage(
        text
      );

      setShowSuggestions(
        false
      );

      setResult(
        ''
      );

      setResultType(
        ''
      );
    };

  /*
   * ==========================================
   * STICKER
   * ==========================================
   */

  const addSticker =
    emoji => {
      const sticker = {
        id:
          `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,

        emoji,

        x:
          50,

        y:
          50,

        scale:
          1,

        rotation:
          Math.round(
            Math.random() * 14 -
              7
          ),
      };

      setStickers(
        current => [
          ...current,
          sticker,
        ]
      );

      setSelectedStickerId(
        sticker.id
      );
    };

  /*
   * ==========================================
   * ELIMINAR STICKER
   * ==========================================
   */

  const removeSelectedSticker =
    () => {
      if (
        !selectedStickerId
      ) {
        return;
      }

      setStickers(
        current =>
          current.filter(
            sticker =>
              sticker.id !==
              selectedStickerId
          )
      );

      setSelectedStickerId(
        null
      );
    };

  /*
   * ==========================================
   * CAMBIAR TAMAÑO
   * ==========================================
   */

  const changeStickerScale =
    delta => {
      if (
        !selectedStickerId
      ) {
        return;
      }

      setStickers(
        current =>
          current.map(
            sticker => {
              if (
                sticker.id !==
                selectedStickerId
              ) {
                return sticker;
              }

              return {
                ...sticker,
                scale:
                  Math.max(
                    0.55,
                    Math.min(
                      1.7,
                      sticker.scale +
                        delta
                    )
                  ),
              };
            }
          )
      );
    };

  /*
   * ==========================================
   * APLANAR FOTO CON STICKERS
   * ==========================================
   */

  const flattenEditedImage =
    async () => {
      if (
        !optimizedFile ||
        !optimizedFile.type.startsWith(
          'image/'
        ) ||
        stickers.length ===
          0
      ) {
        return optimizedFile;
      }

      const image =
        new Image();

      const sourceUrl =
        URL.createObjectURL(
          optimizedFile
        );

      try {
        await new Promise(
          (
            resolve,
            reject
          ) => {
            image.onload =
              resolve;

            image.onerror =
              () =>
                reject(
                  new Error(
                    'No pudimos preparar la foto editada.'
                  )
                );

            image.src =
              sourceUrl;
          }
        );

        const canvas =
          document.createElement(
            'canvas'
          );

        canvas.width =
          image.naturalWidth;

        canvas.height =
          image.naturalHeight;

        const context =
          canvas.getContext(
            '2d'
          );

        if (!context) {
          throw new Error(
            'No se pudo crear el editor de imagen.'
          );
        }

        context.drawImage(
          image,
          0,
          0
        );

        const baseDimension =
          Math.min(
            canvas.width,
            canvas.height
          );

        for (
          const sticker of stickers
        ) {
          const x =
            (sticker.x /
              100) *
            canvas.width;

          const y =
            (sticker.y /
              100) *
            canvas.height;

          const fontSize =
            Math.max(
              38,
              Math.min(
                115,
                baseDimension *
                  0.115 *
                  sticker.scale
              )
            );

          context.save();

          context.translate(
            x,
            y
          );

          context.rotate(
            (sticker.rotation *
              Math.PI) /
              180
          );

          context.font =
            `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;

          context.textAlign =
            'center';

          context.textBaseline =
            'middle';

          context.shadowColor =
            'rgba(0,0,0,.28)';

          context.shadowBlur =
            Math.max(
              2,
              fontSize *
                0.05
            );

          context.fillText(
            sticker.emoji,
            0,
            0
          );

          context.restore();
        }

        const blob =
          await new Promise(
            resolve =>
              canvas.toBlob(
                resolve,
                'image/jpeg',
                0.9
              )
          );

        if (!blob) {
          throw new Error(
            'No se pudo generar la foto editada.'
          );
        }

        return new File(
          [
            blob,
          ],
          `lara-xv-${Date.now()}.jpg`,
          {
            type:
              'image/jpeg',
            lastModified:
              Date.now(),
          }
        );
      } finally {
        URL.revokeObjectURL(
          sourceUrl
        );
      }
    };

  /*
   * ==========================================
   * ENVIAR
   * ==========================================
   */

  const handleUpload =
    async () => {
      const cleanName =
        authorName.trim();

      const cleanMessage =
        message.trim();

      if (!cleanName) {
        setResult(
          'Contanos tu nombre para que Lara sepa quién dejó este mensaje 💕'
        );

        setResultType(
          'warning'
        );

        return;
      }

      if (
        !optimizedFile &&
        !cleanMessage
      ) {
        setResult(
          'Agregá una foto, un video o un mensajito para Lara ✨'
        );

        setResultType(
          'warning'
        );

        return;
      }

      if (!user) {
        setResult(
          'Estamos preparando tu conexión. Intentá nuevamente en unos segundos.'
        );

        setResultType(
          'warning'
        );

        return;
      }

      try {
        setUploading(
          true
        );

        setResult(
          'Estamos enviando tu recuerdo...'
        );

        setResultType(
          'info'
        );

        let fileToUpload =
          optimizedFile;

        /*
         * Si es una foto y tiene
         * stickers, generar una copia
         * final con los stickers.
         */

        if (
          optimizedFile &&
          optimizedFile.type.startsWith(
            'image/'
          ) &&
          stickers.length >
            0
        ) {
          fileToUpload =
            await flattenEditedImage();
        }

        /*
         * ARCHIVO
         */

        if (
          fileToUpload
        ) {
          await uploadEventMedia({
            file:
              fileToUpload,

            originalFileName:
              originalFile?.name ||
              fileToUpload.name,

            userId:
              user.id,

            eventId:
              EVENT_ID,

            authorName:
              cleanName,

            message:
              cleanMessage,
          });
        } else {
          /*
           * SOLO MENSAJE
           */

          const {
            error,
          } =
            await supabase
              .from(
                'event_posts'
              )
              .insert({
                event_id:
                  EVENT_ID,

                user_id:
                  user.id,

                author_name:
                  cleanName,

                message:
                  cleanMessage,

                file_name:
                  null,

                original_file_name:
                  null,

                file_type:
                  null,

                file_size:
                  null,

                storage_path:
                  null,

                status:
                  'pending',

                ai_status:
                  'pending',
              });

          if (error) {
            throw error;
          }
        }

        /*
         * ÉXITO
         */

        setResult(
          '¡Tu mensaje llegó! Lara va a guardar este momento 💕'
        );

        setResultType(
          'success'
        );

        setAuthorName(
          ''
        );

        setMessage(
          ''
        );

        setMessageSuggestions(
          []
        );

        setShowSuggestions(
          false
        );

        clearSelectedFile();
      } catch (
        error
      ) {
        console.error(
          'Error enviando recuerdo:',
          error
        );

        setResult(
          `No pudimos enviar tu recuerdo: ${error.message}`
        );

        setResultType(
          'error'
        );
      } finally {
        setUploading(
          false
        );
      }
    };

  /*
   * ==========================================
   * UTILIDADES
   * ==========================================
   */

  const formatSize =
    bytes => {
      if (!bytes) {
        return '0 B';
      }

      if (
        bytes <
        1024
      ) {
        return `${bytes} B`;
      }

      if (
        bytes <
        1024 *
          1024
      ) {
        return `${(
          bytes /
          1024
        ).toFixed(
          1
        )} KB`;
      }

      return `${(
        bytes /
        1024 /
        1024
      ).toFixed(
        2
      )} MB`;
    };

  const reduction =
    originalFile &&
    optimizedFile &&
    originalFile.size >
      0
      ? (
          (
            (
              originalFile.size -
              optimizedFile.size
            ) /
            originalFile.size
          ) *
          100
        ).toFixed(
          1
        )
      : 0;

  const isVideo =
    optimizedFile?.type?.startsWith(
      'video/'
    );

  const isImage =
    optimizedFile?.type?.startsWith(
      'image/'
    );

  const canSubmit =
    Boolean(
      authorName.trim()
    ) &&
    Boolean(
      optimizedFile ||
        message.trim()
    ) &&
    !uploading &&
    !preparingVideo &&
    !generatingMessage
  ;

  /*
   * ==========================================
   * LOADING
   * ==========================================
   */

  if (!user) {
    return (
      <>
        <GuestStyles />

        <div className="guest-page">
          <Background />

          <div className="guest-loading">
            <div className="loading-crown">
              ♕
            </div>

            <div className="loading-name">
              LARA
            </div>

            <div className="loading-xv">
              XV
            </div>

            <p>
              Preparando esta tarde
              especial... ✨
            </p>
          </div>
        </div>
      </>
    );
  }

  /*
   * ==========================================
   * UI
   * ==========================================
   */

  return (
    <>
      <GuestStyles />

      <div className="guest-page">
        <Background />

        <main className="guest-container">

          {/* =================================
              HERO
          ================================= */}

          <header className="hero">
            <div className="hero-crown">
              ♕
            </div>

            <div className="hero-name">
              LARA
            </div>

            <div className="hero-xv">
              XV
            </div>

            <div className="hero-decoration">
              <span />
              ✦✦✦✦✦
              <span />
            </div>

            <h1>
              ✨ Instantes que perduran ✨
            </h1>

            <p>
              Dejá tu huella en este día tan especial 💕
              <br />
              💕💕💕
            </p>
          </header>

          {/* =================================
              FORMULARIO
          ================================= */}

          <section className="composer">

            <div className="composer-header">
              <div className="composer-title">

                <span className="composer-crown">
                  ♕
                </span>

                <span className="eyebrow">
                  UN MOMENTO ESPECIAL
                </span>

                <h2>
                  💕 Sé parte de esta historia 💕
                </h2>

                <p>
                  Compartí una foto, un video
                  o un mensajito para Lara.
                </p>

              </div>
            </div>

            {/* =================================
                NOMBRE
            ================================= */}

            <div className="field">
              <label htmlFor="authorName">

                <span>
                  ♡
                </span>

                Agregá tu nombre
              </label>

              <div className="input-shell">

                <input
                  id="authorName"
                  type="text"
                  value={
                    authorName
                  }
                  onChange={
                    handleNameChange
                  }
                  placeholder="Escribí tu nombre"
                  maxLength={
                    60
                  }
                  disabled={
                    uploading
                  }
                />

                <span className="counter">
                  {
                    authorName.length
                  }
                  /60
                </span>

              </div>
            </div>

            {/* =================================
                FOTO / VIDEO
            ================================= */}

            <div className="field">

              <label>
                <span>
                  📸
                </span>

                Compartí tu momento
              </label>

              {/* Galería */}

              <input
                ref={
                  galleryInputRef
                }
                type="file"
                accept="
                  image/jpeg,
                  image/png,
                  image/webp,
                  image/heic,
                  video/mp4,
                  video/webm,
                  video/quicktime
                "
                onChange={
                  handleFileChange
                }
                disabled={
                  uploading ||
                  preparingVideo
                }
                style={{
                  display:
                    'none',
                }}
              />

              {/* Cámara */}

              <input
                ref={
                  cameraInputRef
                }
                type="file"
                accept="
                  image/*,
                  video/*
                "
                capture="environment"
                onChange={
                  handleFileChange
                }
                disabled={
                  uploading ||
                  preparingVideo
                }
                style={{
                  display:
                    'none',
                }}
              />

              {!originalFile &&
                !preparingVideo && (
                <div className="media-picker">

                  <button
                    type="button"
                    className="media-main-button"
                    onClick={
                      openGallery
                    }
                    disabled={
                      uploading
                    }
                  >
                    <span className="media-big-icon">
                      ✦
                    </span>

                    <span className="media-copy">

                      <strong>
                        Elegí una foto o video
                      </strong>

                      <small>
                        Desde tu celular
                      </small>

                    </span>

                    <span className="media-arrow">
                      →
                    </span>

                  </button>

                  <button
                    type="button"
                    className="camera-button"
                    onClick={
                      openCamera
                    }
                    disabled={
                      uploading
                    }
                    aria-label="Abrir cámara"
                  >
                    📷
                  </button>

                </div>
              )}

              {/* =================================
                  PROCESAMIENTO VIDEO
              ================================= */}

              {preparingVideo && (
                <div className="processing-box">

                  <div className="processing-header">

                    <div>
                      <strong>
                        🎥 Preparando tu video
                      </strong>

                      <span>
                        {
                          preparationStatus
                        }
                      </span>
                    </div>

                    <strong>
                      {
                        videoProgress
                      }%
                    </strong>

                  </div>

                  <div className="progress-track">

                    <div
                      className="progress-fill"
                      style={{
                        width:
                          `${videoProgress}%`,
                      }}
                    />

                  </div>

                  <button
                    type="button"
                    className="cancel-button"
                    onClick={
                      handleCancelVideo
                    }
                  >
                    ✕ Cancelar
                  </button>

                </div>
              )}

              {/* =================================
                  FOTO CON STICKERS
              ================================= */}

              {isImage &&
                previewUrl &&
                !preparingVideo && (
                <PhotoStickerEditor
                  previewUrl={
                    previewUrl
                  }
                  stickers={
                    stickers
                  }
                  setStickers={
                    setStickers
                  }
                  selectedStickerId={
                    selectedStickerId
                  }
                  setSelectedStickerId={
                    setSelectedStickerId
                  }
                  onAddSticker={
                    addSticker
                  }
                  onRemoveSticker={
                    removeSelectedSticker
                  }
                  onScale={
                    changeStickerScale
                  }
                  stickerOptions={
                    STICKERS
                  }
                />
              )}

              {/* =================================
                  VIDEO SELECCIONADO
              ================================= */}

              {isVideo &&
                previewUrl &&
                !preparingVideo && (
                <>
                  <div className="selected-file">
                    <div className="selected-file-icon">
                      ▶
                    </div>

                    <div className="selected-file-info">

                      <strong>
                        {
                          originalFile?.name
                        }
                      </strong>

                      <span>
                        {
                          formatSize(
                            optimizedFile?.size ||
                              originalFile?.size
                          )
                        }

                        {optimizedFile &&
                          originalFile &&
                          optimizedFile.size <
                            originalFile.size && (
                            <>
                              {' '}
                              · reducido{' '}
                              {
                                reduction
                              }%
                            </>
                          )}
                      </span>

                    </div>

                    <button
                      type="button"
                      className="remove-button"
                      onClick={
                        clearSelectedFile
                      }
                      aria-label="Quitar video"
                    >
                      ×
                    </button>
                  </div>

                  <div className="preview">
                    <div className="preview-head">
                      <span>
                        VISTA PREVIA
                      </span>

                      <span>
                        ✓ LISTO
                      </span>
                    </div>

                    <div className="preview-media">
                      <video
                        src={
                          previewUrl
                        }
                        controls
                        playsInline
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="field-hint">
                📸 Foto · 🎥 video corto ·
                máximo 50 MB
              </div>

            </div>

            {/* =================================
                MENSAJE
            ================================= */}

            <div className="field">

              <div className="message-label-row">

                <label htmlFor="message">

                  <span>
                    💌
                  </span>

                  Un mensajito para Lara

                  <span>
                    opcional
                  </span>

                </label>

                <button
                  type="button"
                  className="ai-help-button"
                  onClick={
                    handleGenerateMessage
                  }
                  disabled={
                    generatingMessage ||
                    uploading
                  }
                >
                  <span>
                    ✨
                  </span>

                  {
                    generatingMessage
                      ? 'Pensando...'
                      : 'Ayudame a escribir'
                  }
                </button>

              </div>

              <div className="textarea-shell">

                <textarea
                  id="message"
                  value={
                    message
                  }
                  onChange={
                    handleMessageChange
                  }
                  placeholder="Escribile algo que quieras que recuerde..."
                  maxLength={
                    150
                  }
                  rows={
                    4
                  }
                  disabled={
                    uploading
                  }
                />

                <span className="textarea-counter">
                  {
                    message.length
                  }
                  /150
                </span>

              </div>

              {/* =================================
                  SUGERENCIAS IA
              ================================= */}

              {showSuggestions && (
                <div className="ai-suggestions">

                  <div className="ai-suggestions-header">

                    <div>
                      <strong>
                        ✨ Algunas ideas para vos
                      </strong>

                      <span>
                        Elegí una o usala como inspiración.
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setShowSuggestions(
                          false
                        )
                      }
                      className="ai-close"
                    >
                      ×
                    </button>

                  </div>

                  {generatingMessage ? (
                    <div className="ai-loading">
                      <span className="ai-spinner">
                        ✦
                      </span>

                      Preparando unas palabras
                      especiales...
                    </div>
                  ) : (
                    <div className="suggestion-list">

                      {messageSuggestions.map(
                        (
                          suggestion,
                          index
                        ) => (
                          <button
                            key={
                              `suggestion-${index}`
                            }
                            type="button"
                            className="suggestion-card"
                            onClick={() =>
                              useSuggestion(
                                suggestion.text
                              )
                            }
                          >
                            <span className="suggestion-style">
                              {suggestion.style ||
                                'Idea'}
                            </span>

                            <span className="suggestion-text">
                              {suggestion.text}
                            </span>

                            <span className="suggestion-use">
                              Usar →
                            </span>
                          </button>
                        )
                      )}

                    </div>
                  )}

                </div>
              )}

            </div>

            {/* =================================
                ENVÍO
            ================================= */}

            <button
              type="button"
              className={
                canSubmit
                  ? 'send-button'
                  : 'send-button disabled'
              }
              disabled={
                !canSubmit
              }
              onClick={
                handleUpload
              }
            >

              <span>
                {uploading
                  ? '…'
                  : '✨'}
              </span>

              <strong>
                {uploading
                  ? 'Enviando...'
                  : 'Enviar algo lindo 💕'}
              </strong>

              <span>
                →
              </span>

            </button>

            {/* =================================
                RESULTADO
            ================================= */}

            {result && (
              <div
                className={`result ${resultType}`}
              >

                <div className="result-symbol">
                  {resultType ===
                  'success'
                    ? '✓'
                    : resultType ===
                      'error'
                    ? '!'
                    : '✦'}
                </div>

                <div>
                  <strong>
                    {resultType ===
                    'success'
                      ? '¡Recibido!'
                      : resultType ===
                        'error'
                      ? 'Ocurrió un problema'
                      : 'Aviso'}
                  </strong>

                  <p>
                    {
                      result
                    }
                  </p>
                </div>

              </div>
            )}

          </section>

          {/* =================================
              AVISO
          ================================= */}

          <div className="guest-trust">

            <span>
              ✦
            </span>

            Tu recuerdo será revisado
            automáticamente antes de
            aparecer en pantalla.

            <span>
              ✦
            </span>

          </div>

          {/* =================================
              FOOTER
          ================================= */}

          <footer className="guest-footer">

            <div className="footer-line">
              <span />
              ♕
              <span />
            </div>

            <p>
              Gracias por ser parte
              de este momento tan especial ✨
            </p>

            <AltexBrand
              variant="guest"
            />

          </footer>

        </main>
      </div>
    </>
  );
}

/*
 * ============================================
 * EDITOR DE STICKERS
 * ============================================
 */

function PhotoStickerEditor({
  previewUrl,
  stickers,
  setStickers,
  selectedStickerId,
  setSelectedStickerId,
  onAddSticker,
  onRemoveSticker,
  onScale,
  stickerOptions,
}) {
  const stageRef =
    useRef(null);

  const dragRef =
    useRef(null);

  const [imageSize, setImageSize] =
    useState({
      width:
        4,
      height:
        3,
    });

  const handleImageLoad =
    event => {
      setImageSize({
        width:
          event.currentTarget
            .naturalWidth ||
          4,

        height:
          event.currentTarget
            .naturalHeight ||
          3,
      });
    };

  const handleStickerPointerDown =
    (
      event,
      stickerId
    ) => {
      event.preventDefault();

      event.stopPropagation();

      setSelectedStickerId(
        stickerId
      );

      dragRef.current = {
        stickerId,
      };

      try {
        event.currentTarget.setPointerCapture(
          event.pointerId
        );
      } catch {
        // Algunos navegadores móviles
        // pueden no soportarlo.
      }
    };

  const handleStagePointerMove =
    event => {
      if (
        !dragRef.current ||
        !stageRef.current
      ) {
        return;
      }

      const rect =
        stageRef.current.getBoundingClientRect();

      const x =
        Math.max(
          5,
          Math.min(
            95,
            (
              (
                event.clientX -
                rect.left
              ) /
              rect.width
            ) *
              100
          )
        );

      const y =
        Math.max(
          5,
          Math.min(
            95,
            (
              (
                event.clientY -
                rect.top
              ) /
              rect.height
            ) *
              100
          )
        );

      setStickers(
        current =>
          current.map(
            sticker =>
              sticker.id ===
              dragRef.current
                .stickerId
                ? {
                    ...sticker,
                    x,
                    y,
                  }
                : sticker
          )
      );
    };

  const handleStagePointerUp =
    () => {
      dragRef.current =
        null;
    };

  return (
    <div className="photo-editor">

      <div className="photo-editor-heading">

        <div>
          <span className="editor-eyebrow">
            ✨ PERSONALIZÁ TU FOTO
          </span>

          <strong>
            Ponéle tu toque especial 💕
          </strong>

          <small>
            Tocá un sticker para agregarlo
            y arrastralo con el dedo.
          </small>
        </div>

      </div>

      <div
        ref={
          stageRef
        }
        className="photo-stage"
        style={{
          aspectRatio:
            `${imageSize.width}/${imageSize.height}`,
        }}
        onPointerMove={
          handleStagePointerMove
        }
        onPointerUp={
          handleStagePointerUp
        }
        onPointerCancel={
          handleStagePointerUp
        }
        onPointerLeave={
          handleStagePointerUp
        }
      >

        <img
          src={
            previewUrl
          }
          alt="Foto para personalizar"
          className="photo-editor-image"
          onLoad={
            handleImageLoad
          }
          draggable="false"
        />

        {stickers.map(
          sticker => (
            <div
              key={
                sticker.id
              }
              className={
                selectedStickerId ===
                sticker.id
                  ? 'photo-sticker selected'
                  : 'photo-sticker'
              }
              style={{
                left:
                  `${sticker.x}%`,

                top:
                  `${sticker.y}%`,

                transform:
                  `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
              }}
              onPointerDown={
                event =>
                  handleStickerPointerDown(
                    event,
                    sticker.id
                  )
              }
            >
              {sticker.emoji}
            </div>
          )
        )}

      </div>

      <div className="sticker-tools">

        <div className="sticker-tools-title">
          <span>
            Elegí un sticker
          </span>

          {selectedStickerId && (
            <button
              type="button"
              onClick={
                onRemoveSticker
              }
              className="delete-sticker"
            >
              Quitar seleccionado
            </button>
          )}
        </div>

        <div className="sticker-list">
          {stickerOptions.map(
            (
              sticker,
              index
            ) => (
              <button
                key={
                  `${sticker}-${index}`
                }
                type="button"
                className="sticker-button"
                onClick={() =>
                  onAddSticker(
                    sticker
                  )
                }
                aria-label={`Agregar sticker ${sticker}`}
              >
                {sticker}
              </button>
            )
          )}
        </div>

        {selectedStickerId && (
          <div className="sticker-size-tools">

            <span>
              Tamaño
            </span>

            <button
              type="button"
              onClick={() =>
                onScale(
                  -0.1
                )
              }
            >
              −
            </button>

            <div className="size-bar">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>

            <button
              type="button"
              onClick={() =>
                onScale(
                  0.1
                )
              }
            >
              +
            </button>

          </div>
        )}

        {stickers.length >
          0 && (
          <div className="sticker-note">
            ✨ Los stickers se guardarán
            junto con la foto al enviarla.
          </div>
        )}

      </div>

    </div>
  );
}

/*
 * ============================================
 * FONDO
 * ============================================
 */

function Background() {
  const butterflies = [
    {
      left: '2%',
      top: '5%',
      scale: '.55',
      opacity: '.52',
      delay: '0s',
      duration: '19s',
    },
    {
      left: '14%',
      top: '10%',
      scale: '.32',
      opacity: '.30',
      delay: '-4s',
      duration: '23s',
    },
    {
      left: '88%',
      top: '6%',
      scale: '.68',
      opacity: '.57',
      delay: '-8s',
      duration: '25s',
    },
    {
      left: '77%',
      top: '15%',
      scale: '.37',
      opacity: '.29',
      delay: '-2s',
      duration: '21s',
    },
    {
      left: '4%',
      top: '25%',
      scale: '.45',
      opacity: '.33',
      delay: '-10s',
      duration: '24s',
    },
    {
      left: '93%',
      top: '29%',
      scale: '.51',
      opacity: '.39',
      delay: '-6s',
      duration: '20s',
    },
    {
      left: '1%',
      top: '39%',
      scale: '.60',
      opacity: '.43',
      delay: '-13s',
      duration: '26s',
    },
    {
      left: '46%',
      top: '18%',
      scale: '.36',
      opacity: '.24',
      delay: '-5s',
      duration: '27s',
    },
    {
      left: '59%',
      top: '31%',
      scale: '.43',
      opacity: '.27',
      delay: '-12s',
      duration: '25s',
    },
    {
      left: '95%',
      top: '42%',
      scale: '.39',
      opacity: '.29',
      delay: '-9s',
      duration: '22s',
    },
    {
      left: '6%',
      top: '53%',
      scale: '.56',
      opacity: '.40',
      delay: '-15s',
      duration: '24s',
    },
    {
      left: '42%',
      top: '54%',
      scale: '.32',
      opacity: '.22',
      delay: '-17s',
      duration: '29s',
    },
    {
      left: '62%',
      top: '61%',
      scale: '.44',
      opacity: '.26',
      delay: '-8s',
      duration: '26s',
    },
    {
      left: '91%',
      top: '63%',
      scale: '.57',
      opacity: '.42',
      delay: '-7s',
      duration: '24s',
    },
    {
      left: '5%',
      top: '75%',
      scale: '.48',
      opacity: '.35',
      delay: '-14s',
      duration: '21s',
    },
    {
      left: '36%',
      top: '78%',
      scale: '.31',
      opacity: '.21',
      delay: '-15s',
      duration: '28s',
    },
    {
      left: '82%',
      top: '80%',
      scale: '.54',
      opacity: '.39',
      delay: '-12s',
      duration: '25s',
    },
    {
      left: '17%',
      top: '90%',
      scale: '.34',
      opacity: '.26',
      delay: '-3s',
      duration: '22s',
    },
    {
      left: '59%',
      top: '90%',
      scale: '.41',
      opacity: '.27',
      delay: '-10s',
      duration: '27s',
    },
    {
      left: '91%',
      top: '92%',
      scale: '.45',
      opacity: '.31',
      delay: '-18s',
      duration: '26s',
    },
  ];

  const sparkles = [
    ['10%', '8%', '-1s'],
    ['24%', '13%', '-3s'],
    ['80%', '11%', '-5s'],
    ['71%', '21%', '-2s'],
    ['13%', '28%', '-4s'],
    ['52%', '22%', '-6s'],
    ['89%', '35%', '-2s'],
    ['8%', '43%', '-5s'],
    ['46%', '42%', '-7s'],
    ['83%', '48%', '-3s'],
    ['20%', '59%', '-6s'],
    ['67%', '57%', '-1s'],
    ['11%', '70%', '-4s'],
    ['75%', '72%', '-8s'],
    ['29%', '85%', '-2s'],
    ['70%', '88%', '-6s'],
    ['50%', '96%', '-4s'],
  ];

  return (
    <>
      <div
        className="guest-photo-background"
        style={{
          backgroundImage:
            `url("${LARA_PHOTO_URL}")`,
        }}
      />

      <div className="guest-background-overlay" />

      <div className="guest-glow guest-glow-one" />

      <div className="guest-glow guest-glow-two" />

      <div
        className="butterfly-layer"
        aria-hidden="true"
      >
        {butterflies.map(
          (
            butterfly,
            index
          ) => (
            <div
              key={
                `butterfly-${index}`
              }
              className="butterfly"
              style={{
                left:
                  butterfly.left,
                top:
                  butterfly.top,
                '--scale':
                  butterfly.scale,
                '--opacity':
                  butterfly.opacity,
                animationDelay:
                  butterfly.delay,
                animationDuration:
                  butterfly.duration,
              }}
            >
              🦋
            </div>
          )
        )}

        {sparkles.map(
          (
            sparkle,
            index
          ) => (
            <span
              key={
                `sparkle-${index}`
              }
              className="background-sparkle"
              style={{
                left:
                  sparkle[0],
                top:
                  sparkle[1],
                animationDelay:
                  sparkle[2],
              }}
            >
              ✦
            </span>
          )
        )}
      </div>

      <div className="guest-grain" />
    </>
  );
}

/*
 * ============================================
 * ESTILOS
 * ============================================
 */

function GuestStyles() {
  return (
    <style>{`
      * {
        box-sizing: border-box;
      }

      html,
      body,
      #root {
        margin: 0;
        min-height: 100%;
        background: #080911;
      }

      body {
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;

        color: #f8f4ed;
      }

      button,
      input,
      textarea {
        font: inherit;
      }

      button {
        -webkit-tap-highlight-color: transparent;
      }

      /* =====================================
         PÁGINA
      ===================================== */

      .guest-page {
        position: relative;
        min-height: 100vh;
        overflow-x: hidden;
        padding:
          21px 14px 55px;
        isolation: isolate;
        background:
          #080911;
      }

      /* =====================================
         FOTO DE FONDO
      ===================================== */

      .guest-photo-background {
        position: fixed;
        inset: 0;
        z-index: -4;
        pointer-events: none;

        background-repeat:
          no-repeat;

        background-size:
          cover;

        background-position:
          center 38%;

        transform:
          scale(1.045);

        filter:
          brightness(.56)
          saturate(.74)
          contrast(1.04);
      }

      .guest-background-overlay {
        position: fixed;
        inset: 0;
        z-index: -3;
        pointer-events: none;

        background:
          linear-gradient(
            180deg,
            rgba(6,7,16,.43) 0%,
            rgba(13,10,21,.58) 34%,
            rgba(8,9,17,.85) 100%
          ),
          radial-gradient(
            circle at 50% 20%,
            rgba(225,183,199,.14),
            transparent 32%
          ),
          radial-gradient(
            circle at 14% 73%,
            rgba(225,181,111,.08),
            transparent 27%
          );
      }

      .guest-glow {
        position: fixed;
        z-index: -2;
        pointer-events: none;
        border-radius: 50%;
        filter:
          blur(100px);
      }

      .guest-glow-one {
        width: 430px;
        height: 430px;
        right: -200px;
        top: -140px;
        background:
          rgba(217,165,192,.15);
      }

      .guest-glow-two {
        width: 350px;
        height: 350px;
        left: -180px;
        bottom: -130px;
        background:
          rgba(231,195,129,.09);
      }

      .guest-grain {
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        opacity: .027;

        background-image:
          radial-gradient(
            rgba(255,255,255,.75) .45px,
            transparent .45px
          );

        background-size:
          7px 7px;
      }

      /* =====================================
         MARIPOSAS
      ===================================== */

      .butterfly-layer {
        position: fixed;
        inset: 0;
        z-index: 10;
        pointer-events: none;
        overflow: hidden;
      }

      .butterfly {
        position: absolute;
        font-size: 28px;

        opacity:
          var(--opacity);

        filter:
          drop-shadow(
            0 0 13px
            rgba(226,181,211,.43)
          );

        animation:
          butterflyFloat
          linear
          infinite;

        user-select: none;
        will-change:
          transform;
      }

      .background-sparkle {
        position: absolute;
        color: #e3c27d;
        font-size: 11px;
        opacity: .38;

        animation:
          sparklePulse
          4.5s
          ease-in-out
          infinite;
      }

      @keyframes butterflyFloat {
        0% {
          transform:
            translate3d(
              -20px,
              0,
              0
            )
            rotate(-8deg)
            scale(var(--scale));
        }

        25% {
          transform:
            translate3d(
              28px,
              -42px,
              0
            )
            rotate(7deg)
            scale(var(--scale));
        }

        50% {
          transform:
            translate3d(
              68px,
              5px,
              0
            )
            rotate(-2deg)
            scale(var(--scale));
        }

        75% {
          transform:
            translate3d(
              24px,
              50px,
              0
            )
            rotate(9deg)
            scale(var(--scale));
        }

        100% {
          transform:
            translate3d(
              -20px,
              0,
              0
            )
            rotate(-8deg)
            scale(var(--scale));
        }
      }

      @keyframes sparklePulse {
        0%,
        100% {
          opacity:
            .10;

          transform:
            scale(.75);
        }

        50% {
          opacity:
            .72;

          transform:
            scale(1.2);
        }
      }

      /* =====================================
         CONTENEDOR
      ===================================== */

      .guest-container {
        position:
          relative;

        z-index:
          3;

        width:
          100%;

        max-width:
          640px;

        margin:
          0 auto;
      }

      /* =====================================
         HERO
      ===================================== */

      .hero {
        padding:
          7px 8px 24px;

        text-align:
          center;
      }

      .hero-crown {
        color:
          #e5c17c;

        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size:
          30px;

        line-height:
          1;

        text-shadow:
          0 0 23px
          rgba(230,193,124,.25);
      }

      .hero-name {
        margin-top:
          5px;

        color:
          #fffaf1;

        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size:
          clamp(
            53px,
            14vw,
            80px
          );

        font-weight:
          500;

        line-height:
          .84;

        letter-spacing:
          2px;

        text-shadow:
          0 12px 45px
          rgba(0,0,0,.40);
      }

      .hero-xv {
        margin-top:
          10px;

        padding-left:
          8px;

        color:
          #e0b974;

        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size:
          clamp(
            27px,
            7vw,
            39px
          );

        font-style:
          italic;

        line-height:
          1;

        letter-spacing:
          9px;
      }

      .hero-decoration {
        margin:
          17px auto 13px;

        display:
          flex;

        align-items:
          center;

        justify-content:
          center;

        gap:
          10px;

        color:
          #d8b474;

        font-size:
          9px;
      }

      .hero-decoration span {
        width:
          46px;

        height:
          1px;

        background:
          linear-gradient(
            90deg,
            transparent,
            rgba(216,180,116,.52),
            transparent
          );
      }

      .hero h1 {
        margin:
          0;

        color:
          #fffdfa;

        font-size:
          clamp(
            24px,
            5.8vw,
            33px
          );

        line-height:
          1.08;

        letter-spacing:
          -.5px;

        text-shadow:
          0 3px 18px
          rgba(0,0,0,.38);
      }

      .hero p {
        max-width:
          500px;

        margin:
          10px auto 0;

        color:
          #eee7eb;

        font-size:
          12px;

        line-height:
          1.65;

        text-shadow:
          0 2px 13px
          rgba(0,0,0,.45);
      }

      /* =====================================
         COMPOSER
      ===================================== */

      .composer {
        padding:
          25px 19px 21px;

        border:
          1px solid
          rgba(255,255,255,.13);

        border-radius:
          25px;

        background:
          linear-gradient(
            145deg,
            rgba(9,10,19,.81),
            rgba(20,14,26,.71)
          );

        box-shadow:
          0 30px 100px
          rgba(0,0,0,.42);

        backdrop-filter:
          blur(23px);
      }

      .composer-header {
        display:
          flex;

        justify-content:
          center;

        text-align:
          center;

        margin-bottom:
          21px;
      }

      .composer-title {
        width:
          100%;

        display:
          flex;

        flex-direction:
          column;

        align-items:
          center;
      }

      .composer-crown {
        color:
          #e4c17d;

        font-family:
          Georgia,
          serif;

        font-size:
          28px;

        line-height:
          1;

        margin-bottom:
          7px;

        text-shadow:
          0 0 20px
          rgba(228,193,125,.22);
      }

      .eyebrow {
        color:
          #d1b173;

        font-size:
          8px;

        font-weight:
          900;

        letter-spacing:
          2.7px;
      }

      .composer-title h2 {
        margin:
          6px 0 0;

        color:
          #fff8ee;

        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size:
          24px;

        font-weight:
          600;

        line-height:
          1.15;
      }

      .composer-title p {
        max-width:
          430px;

        margin:
          7px auto 0;

        color:
          #d6ced5;

        font-size:
          11px;

        line-height:
          1.55;
      }

      /* =====================================
         FIELD
      ===================================== */

      .field {
        margin-top:
          19px;
      }

      .field > label {
        display:
          flex;

        align-items:
          center;

        justify-content:
          center;

        gap:
          6px;

        margin-bottom:
          8px;

        color:
          #f5efe7;

        font-size:
          12px;

        font-weight:
          800;

        text-align:
          center;
      }

      .field > label > span:first-child {
        color:
          #dfbb78;

        font-size:
          12px;
      }

      .field > label > span:last-child {
        color:
          #8c8591;

        font-size:
          9px;

        font-weight:
          500;
      }

      /* =====================================
         INPUT
      ===================================== */

      .input-shell {
        min-height:
          50px;

        display:
          flex;

        align-items:
          center;

        border:
          1px solid
          rgba(255,255,255,.11);

        border-radius:
          13px;

        background:
          rgba(0,0,0,.23);

        transition:
          border-color .2s ease,
          box-shadow .2s ease;
      }

      .input-shell:focus-within {
        border-color:
          rgba(229,193,126,.42);

        box-shadow:
          0 0 0 3px
          rgba(229,193,126,.055);
      }

      .input-shell input {
        width:
          100%;

        min-width:
          0;

        padding:
          13px 12px;

        border:
          none;

        outline:
          none;

        background:
          transparent;

        color:
          #fff;

        font-size:
          14px;
      }

      .input-shell input::placeholder {
        color:
          #858b99;
      }

      .counter {
        flex:
          0 0 auto;

        padding:
          0 11px;

        color:
          #707787;

        font-size:
          9px;
      }

      /* =====================================
         MEDIA PICKER
      ===================================== */

      .media-picker {
        display:
          grid;

        grid-template-columns:
          minmax(0,1fr) 49px;

        gap:
          8px;
      }

      .media-main-button,
      .camera-button {
        border:
          1px solid
          rgba(230,195,132,.20);

        border-radius:
          14px;

        background:
          linear-gradient(
            145deg,
            rgba(230,195,132,.065),
            rgba(211,161,186,.04)
          );

        color:
          #f1eae2;

        cursor:
          pointer;

        transition:
          transform .18s ease,
          background .18s ease,
          border-color .18s ease;
      }

      .media-main-button:hover,
      .camera-button:hover {
        transform:
          translateY(-1px);

        border-color:
          rgba(230,195,132,.38);

        background:
          linear-gradient(
            145deg,
            rgba(230,195,132,.10),
            rgba(211,161,186,.06)
          );
      }

      .media-main-button {
        min-height:
          75px;

        display:
          grid;

        grid-template-columns:
          42px 1fr auto;

        align-items:
          center;

        gap:
          10px;

        padding:
          10px 12px;

        text-align:
          left;
      }

      .media-big-icon {
        width:
          42px;

        height:
          42px;

        display:
          grid;

        place-items:
          center;

        border:
          1px solid
          rgba(230,195,132,.17);

        border-radius:
          13px;

        background:
          rgba(230,195,132,.07);

        color:
          #e5c27e;

        font-size:
          18px;
      }

      .media-copy {
        min-width:
          0;

        display:
          grid;

        gap:
          4px;
      }

      .media-copy strong {
        color:
          #f6efe6;

        font-size:
          12px;
      }

      .media-copy small {
        color:
          #a29ba5;

        font-size:
          9px;
      }

      .media-arrow {
        color:
          #d8b674;

        font-size:
          18px;
      }

      .camera-button {
        min-height:
          75px;

        display:
          grid;

        place-items:
          center;

        font-size:
          19px;
      }

      .field-hint {
        margin-top:
          7px;

        color:
          #938b96;

        font-size:
          9px;

        line-height:
          1.5;

        text-align:
          center;
      }

      /* =====================================
         VIDEO PROCESSING
      ===================================== */

      .processing-box {
        padding:
          14px;

        border:
          1px solid
          rgba(230,195,132,.14);

        border-radius:
          15px;

        background:
          rgba(230,195,132,.045);
      }

      .processing-header {
        display:
          flex;

        align-items:
          flex-start;

        justify-content:
          space-between;

        gap:
          15px;
      }

      .processing-header > div {
        display:
          grid;

        gap:
          4px;
      }

      .processing-header strong {
        color:
          #eee8df;

        font-size:
          11px;
      }

      .processing-header span {
        color:
          #959baa;

        font-size:
          9px;
      }

      .progress-track {
        width:
          100%;

        height:
          7px;

        margin-top:
          12px;

        overflow:
          hidden;

        border-radius:
          999px;

        background:
          rgba(255,255,255,.06);
      }

      .progress-fill {
        height:
          100%;

        border-radius:
          999px;

        background:
          linear-gradient(
            90deg,
            #d0a0b9,
            #ebc989
          );

        box-shadow:
          0 0 16px
          rgba(232,195,132,.28);

        transition:
          width .2s ease;
      }

      .cancel-button {
        margin-top:
          11px;

        padding:
          8px 12px;

        border:
          1px solid
          rgba(255,255,255,.08);

        border-radius:
          9px;

        background:
          rgba(255,255,255,.025);

        color:
          #a4a9b5;

        cursor:
          pointer;

        font-size:
          9px;
      }

      /* =====================================
         FILE
      ===================================== */

      .selected-file {
        display:
          flex;

        align-items:
          center;

        gap:
          10px;

        padding:
          10px;

        border:
          1px solid
          rgba(255,255,255,.08);

        border-radius:
          13px;

        background:
          rgba(255,255,255,.025);
      }

      .selected-file-icon {
        width:
          37px;

        height:
          37px;

        display:
          grid;

        place-items:
          center;

        flex:
          0 0 auto;

        border-radius:
          11px;

        background:
          rgba(229,194,126,.07);

        color:
          #e3c17d;
      }

      .selected-file-info {
        min-width:
          0;

        flex:
          1;

        display:
          grid;

        gap:
          3px;
      }

      .selected-file-info strong {
        overflow:
          hidden;

        text-overflow:
          ellipsis;

        white-space:
          nowrap;

        color:
          #eee9e2;

        font-size:
          10px;
      }

      .selected-file-info span {
        color:
          #7b8291;

        font-size:
          9px;
      }

      .remove-button {
        width:
          30px;

        height:
          30px;

        display:
          grid;

        place-items:
          center;

        flex:
          0 0 auto;

        border:
          1px solid
          rgba(255,255,255,.07);

        border-radius:
          9px;

        background:
          rgba(255,255,255,.03);

        color:
          #a8adb7;

        cursor:
          pointer;

        font-size:
          17px;
      }

      /* =====================================
         PHOTO EDITOR
      ===================================== */

      .photo-editor {
        margin-top:
          11px;

        overflow:
          hidden;

        border:
          1px solid
          rgba(255,255,255,.08);

        border-radius:
          17px;

        background:
          rgba(0,0,0,.19);
      }

      .photo-editor-heading {
        padding:
          13px 12px 10px;

        text-align:
          center;
      }

      .editor-eyebrow {
        display:
          block;

        color:
          #d1b071;

        font-size:
          8px;

        font-weight:
          900;

        letter-spacing:
          1.8px;
      }

      .photo-editor-heading strong {
        display:
          block;

        margin-top:
          5px;

        color:
          #f3ece4;

        font-family:
          Georgia,
          serif;

        font-size:
          14px;
      }

      .photo-editor-heading small {
        display:
          block;

        margin-top:
          4px;

        color:
          #98919d;

        font-size:
          9px;

        line-height:
          1.45;
      }

      .photo-stage {
        position:
          relative;

        width:
          calc(100% - 18px);

        margin:
          0 auto;

        overflow:
          hidden;

        border:
          1px solid
          rgba(255,255,255,.08);

        border-radius:
          13px;

        background:
          #02040a;

        touch-action:
          none;

        user-select:
          none;
      }

      .photo-editor-image {
        position:
          absolute;

        inset:
          0;

        width:
          100%;

        height:
          100%;

        display:
          block;

        object-fit:
          contain;

        user-select:
          none;

        pointer-events:
          none;
      }

      .photo-sticker {
        position:
          absolute;

        z-index:
          4;

        display:
          grid;

        place-items:
          center;

        padding:
          3px;

        font-size:
          clamp(32px, 10vw, 68px);

        line-height:
          1;

        cursor:
          grab;

        touch-action:
          none;

        filter:
          drop-shadow(
            0 3px 5px
            rgba(0,0,0,.27)
          );
      }

      .photo-sticker:active {
        cursor:
          grabbing;
      }

      .photo-sticker.selected {
        outline:
          1px dashed
          rgba(230,196,127,.80);

        outline-offset:
          5px;

        border-radius:
          8px;
      }

      .sticker-tools {
        padding:
          12px;
      }

      .sticker-tools-title {
        display:
          flex;

        align-items:
          center;

        justify-content:
          space-between;

        gap:
          12px;

        margin-bottom:
          8px;

        color:
          #b8b0bc;

        font-size:
          9px;

        font-weight:
          800;
      }

      .delete-sticker {
        padding:
          5px 8px;

        border:
          none;

        border-radius:
          7px;

        background:
          rgba(225,119,134,.08);

        color:
          #dc9da7;

        cursor:
          pointer;

        font-size:
          8px;
      }

      .sticker-list {
        display:
          flex;

        gap:
          6px;

        overflow-x:
          auto;

        padding-bottom:
          4px;

        scrollbar-width:
          thin;
      }

      .sticker-button {
        width:
          42px;

        height:
          42px;

        flex:
          0 0 auto;

        display:
          grid;

        place-items:
          center;

        border:
          1px solid
          rgba(255,255,255,.08);

        border-radius:
          12px;

        background:
          rgba(255,255,255,.035);

        font-size:
          22px;

        cursor:
          pointer;

        transition:
          transform .15s ease,
          border-color .15s ease,
          background .15s ease;
      }

      .sticker-button:hover {
        transform:
          translateY(-1px);

        border-color:
          rgba(231,196,130,.32);

        background:
          rgba(231,196,130,.06);
      }

      .sticker-size-tools {
        margin-top:
          9px;

        display:
          flex;

        align-items:
          center;

        justify-content:
          center;

        gap:
          8px;

        color:
          #88818d;

        font-size:
          9px;
      }

      .sticker-size-tools button {
        width:
          27px;

        height:
          27px;

        display:
          grid;

        place-items:
          center;

        border:
          1px solid
          rgba(255,255,255,.08);

        border-radius:
          8px;

        background:
          rgba(255,255,255,.035);

        color:
          #ddd5cc;

        cursor:
          pointer;
      }

      .size-bar {
        display:
          flex;

        gap:
          3px;
      }

      .size-bar span {
        width:
          8px;

        height:
          4px;

        border-radius:
          999px;

        background:
          rgba(229,194,126,.35);
      }

      .sticker-note {
        margin-top:
          7px;

        color:
          #777e8f;

        text-align:
          center;

        font-size:
          8px;

        line-height:
          1.5;
      }

      /* =====================================
         PREVIEW VIDEO
      ===================================== */

      .preview {
        margin-top:
          10px;

        padding:
          9px;

        border:
          1px solid
          rgba(255,255,255,.07);

        border-radius:
          16px;

        background:
          rgba(0,0,0,.20);
      }

      .preview-head {
        display:
          flex;

        justify-content:
          space-between;

        margin:
          1px 3px 7px;

        color:
          #72798a;

        font-size:
          8px;

        font-weight:
          900;

        letter-spacing:
          1.7px;
      }

      .preview-head span:last-child {
        color:
          #93d5aa;

        letter-spacing:
          0;
      }

      .preview-media {
        overflow:
          hidden;

        border-radius:
          12px;

        background:
          #02040a;
      }

      .preview-media video {
        display:
          block;

        width:
          100%;

        max-height:
          440px;

        object-fit:
          contain;
      }

      /* =====================================
         MENSAJE + IA
      ===================================== */

      .message-label-row {
        display:
          flex;

        align-items:
          center;

        justify-content:
          space-between;

        gap:
          10px;

        margin-bottom:
          8px;
      }

      .message-label-row label {
        margin:
          0 !important;

        justify-content:
          flex-start !important;

        flex:
          1;

        text-align:
          left !important;
      }

      .ai-help-button {
        flex:
          0 0 auto;

        display:
          inline-flex;

        align-items:
          center;

        gap:
          5px;

        padding:
          6px 9px;

        border:
          1px solid
          rgba(225,190,129,.18);

        border-radius:
          999px;

        background:
          rgba(225,190,129,.055);

        color:
          #e0c180;

        cursor:
          pointer;

        font-size:
          8px;

        font-weight:
          800;
      }

      .ai-help-button:hover {
        border-color:
          rgba(225,190,129,.34);

        background:
          rgba(225,190,129,.08);
      }

      .ai-help-button:disabled {
        opacity:
          .55;

        cursor:
          wait;
      }

      .textarea-shell {
        position:
          relative;

        border:
          1px solid
          rgba(255,255,255,.10);

        border-radius:
          13px;

        background:
          rgba(0,0,0,.22);

        transition:
          border-color .2s ease,
          box-shadow .2s ease;
      }

      .textarea-shell:focus-within {
        border-color:
          rgba(229,193,126,.42);

        box-shadow:
          0 0 0 3px
          rgba(229,193,126,.055);
      }

      .textarea-shell textarea {
        display:
          block;

        width:
          100%;

        min-height:
          105px;

        padding:
          13px 14px 28px;

        border:
          none;

        outline:
          none;

        resize:
          vertical;

        background:
          transparent;

        color:
          #fff;

        font-size:
          13px;

        line-height:
          1.55;
      }

      .textarea-shell textarea::placeholder {
        color:
          #7c8290;
      }

      .textarea-counter {
        position:
          absolute;

        right:
          10px;

        bottom:
          8px;

        color:
          #707687;

        font-size:
          9px;
      }

      .ai-suggestions {
        margin-top:
          9px;

        padding:
          12px;

        border:
          1px solid
          rgba(225,190,129,.13);

        border-radius:
          15px;

        background:
          linear-gradient(
            145deg,
            rgba(225,190,129,.045),
            rgba(214,165,189,.035)
          );
      }

      .ai-suggestions-header {
        display:
          flex;

        align-items:
          flex-start;

        justify-content:
          space-between;

        gap:
          12px;

        margin-bottom:
          9px;
      }

      .ai-suggestions-header > div {
        display:
          grid;

        gap:
          3px;
      }

      .ai-suggestions-header strong {
        color:
          #eee7df;

        font-size:
          10px;
      }

      .ai-suggestions-header span {
        color:
          #88818d;

        font-size:
          8px;
      }

      .ai-close {
        width:
          25px;

        height:
          25px;

        display:
          grid;

        place-items:
          center;

        border:
          1px solid
          rgba(255,255,255,.07);

        border-radius:
          8px;

        background:
          rgba(255,255,255,.025);

        color:
          #999faa;

        cursor:
          pointer;

        font-size:
          15px;
      }

      .suggestion-list {
        display:
          grid;

        gap:
          7px;
      }

      .suggestion-card {
        width:
          100%;

        padding:
          10px;

        display:
          grid;

        gap:
          5px;

        border:
          1px solid
          rgba(255,255,255,.07);

        border-radius:
          11px;

        background:
          rgba(255,255,255,.025);

        color:
          #ede7df;

        text-align:
          left;

        cursor:
          pointer;

        transition:
          border-color .18s ease,
          background .18s ease;
      }

      .suggestion-card:hover {
        border-color:
          rgba(225,190,129,.30);

        background:
          rgba(225,190,129,.06);
      }

      .suggestion-style {
        color:
          #d2ad6d;

        font-size:
          8px;

        font-weight:
          900;

        text-transform:
          uppercase;

        letter-spacing:
          1px;
      }

      .suggestion-text {
        color:
          #ded6dd;

        font-size:
          10px;

        line-height:
          1.5;
      }

      .suggestion-use {
        color:
          #d6b572;

        font-size:
          8px;

        font-weight:
          800;

        text-align:
          right;
      }

      .ai-loading {
        display:
          flex;

        align-items:
          center;

        justify-content:
          center;

        gap:
          8px;

        padding:
          15px 5px;

        color:
          #99919d;

        font-size:
          9px;

        text-align:
          center;
      }

      .ai-spinner {
        color:
          #e3bd79;

        animation:
          aiRotate
          1.3s
          ease-in-out
          infinite;
      }

      @keyframes aiRotate {
        0% {
          transform:
            rotate(0deg)
            scale(.9);
        }

        50% {
          transform:
            rotate(180deg)
            scale(1.15);
        }

        100% {
          transform:
            rotate(360deg)
            scale(.9);
        }
      }

      /* =====================================
         SEND
      ===================================== */

      .send-button {
        width:
          100%;

        min-height:
          55px;

        margin-top:
          22px;

        display:
          grid;

        grid-template-columns:
          28px 1fr 28px;

        align-items:
          center;

        gap:
          8px;

        border:
          1px solid
          rgba(238,204,143,.24);

        border-radius:
          14px;

        background:
          linear-gradient(
            135deg,
            #efcf91,
            #d3a2ba
          );

        color:
          #090b12;

        cursor:
          pointer;

        box-shadow:
          0 16px 40px
          rgba(213,167,118,.17);

        transition:
          transform .2s ease,
          box-shadow .2s ease,
          filter .2s ease;
      }

      .send-button:not(.disabled):hover {
        transform:
          translateY(-2px);

        box-shadow:
          0 19px 44px
          rgba(213,167,118,.24);

        filter:
          brightness(1.03);
      }

      .send-button strong {
        font-size:
          13px;
      }

      .send-button.disabled {
        background:
          rgba(255,255,255,.055);

        border-color:
          rgba(255,255,255,.05);

        color:
          #676e7d;

        cursor:
          not-allowed;

        box-shadow:
          none;
      }

      /* =====================================
         RESULTADO
      ===================================== */

      .result {
        margin-top:
          13px;

        display:
          flex;

        align-items:
          flex-start;

        gap:
          10px;

        padding:
          13px;

        border-radius:
          13px;
      }

      .result-symbol {
        width:
          28px;

        height:
          28px;

        flex:
          0 0 auto;

        display:
          grid;

        place-items:
          center;

        border-radius:
          9px;

        font-weight:
          900;
      }

      .result strong {
        color:
          #f0ebe4;

        font-size:
          11px;
      }

      .result p {
        margin:
          4px 0 0;

        color:
          #a9aeb8;

        font-size:
          10px;

        line-height:
          1.55;
      }

      .result.success {
        flex-direction:
          column;

        align-items:
          center;

        justify-content:
          center;

        text-align:
          center;

        gap:
          8px;
      }

      .result.success > div:last-child {
        display:
          flex;

        flex-direction:
          column;

        align-items:
          center;

        justify-content:
          center;
      }

      .result.success p {
        max-width:
          420px;

        text-align:
          center;
      }

      .result.success {
        border:
          1px solid
          rgba(120,215,163,.13);

        background:
          rgba(120,215,163,.055);
      }

      .result.success .result-symbol {
        background:
          rgba(120,215,163,.10);

        color:
          #9ce1b6;
      }

      .result.error {
        border:
          1px solid
          rgba(225,119,134,.13);

        background:
          rgba(225,119,134,.055);
      }

      .result.error .result-symbol {
        background:
          rgba(225,119,134,.10);

        color:
          #efa0aa;
      }

      .result.warning {
        border:
          1px solid
          rgba(230,189,112,.13);

        background:
          rgba(230,189,112,.05);
      }

      .result.warning .result-symbol {
        background:
          rgba(230,189,112,.09);

        color:
          #e3bf77;
      }

      .result.info {
        border:
          1px solid
          rgba(214,165,189,.11);

        background:
          rgba(214,165,189,.05);
      }

      .result.info .result-symbol {
        background:
          rgba(214,165,189,.08);

        color:
          #dfb5cb;
      }

      /* =====================================
         TRUST
      ===================================== */

      .guest-trust {
        max-width:
          540px;

        margin:
          19px auto 0;

        display:
          flex;

        align-items:
          center;

        justify-content:
          center;

        gap:
          8px;

        color:
          #aaa3ad;

        text-align:
          center;

        font-size:
          9px;

        line-height:
          1.55;

        text-shadow:
          0 2px 9px
          rgba(0,0,0,.35);
      }

      .guest-trust span {
        color:
          #d2ad6d;
      }

      /* =====================================
         FOOTER
      ===================================== */

      .guest-footer {
        margin-top:
          42px;

        padding-bottom:
          5px;

        text-align:
          center;
      }

      .footer-line {
        display:
          flex;

        align-items:
          center;

        justify-content:
          center;

        gap:
          10px;

        color:
          #d4b171;

        font-size:
          11px;
      }

      .footer-line span {
        width:
          44px;

        height:
          1px;

        background:
          linear-gradient(
            90deg,
            transparent,
            rgba(212,177,113,.35),
            transparent
          );
      }

      .guest-footer > p {
        margin:
          10px 0 0;

        color:
          #aaa4ae;

        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size:
          13px;

        font-style:
          italic;
      }

      /* =====================================
         LOADING
      ===================================== */

      .guest-loading {
        position:
          relative;

        z-index:
          5;

        min-height:
          100vh;

        display:
          flex;

        flex-direction:
          column;

        align-items:
          center;

        justify-content:
          center;

        text-align:
          center;
      }

      .loading-crown {
        color:
          #e4bf7b;

        font-family:
          Georgia,
          serif;

        font-size:
          29px;
      }

      .loading-name {
        margin-top:
          4px;

        color:
          #fff8ec;

        font-family:
          Georgia,
          serif;

        font-size:
          50px;

        line-height:
          .85;

        letter-spacing:
          2px;
      }

      .loading-xv {
        margin-top:
          9px;

        color:
          #dbb574;

        font-family:
          Georgia,
          serif;

        font-size:
          25px;

        font-style:
          italic;

        letter-spacing:
          7px;
      }

      .guest-loading p {
        margin-top:
          10px;

        color:
          #c2bbc4;

        font-size:
          11px;
      }

      /* =====================================
         MOBILE
      ===================================== */

      @media (
        max-width: 620px
      ) {
        .guest-page {
          padding:
            15px 9px 45px;
        }

        .guest-photo-background {
          background-position:
            center 35%;
        }

        .hero {
          padding:
            6px 4px 20px;
        }

        .hero-name {
          font-size:
            54px;
        }

        .hero-xv {
          font-size:
            27px;
        }

        .hero h1 {
          font-size:
            24px;
        }

        .hero p {
          font-size:
            12px;
        }

        .composer {
          padding:
            21px 14px 18px;

          border-radius:
            21px;
        }

        .composer-title h2 {
          font-size:
            21px;
        }

        .message-label-row {
          align-items:
            flex-start;
        }

        .message-label-row label {
          flex-wrap:
            wrap;
        }

        .ai-help-button {
          font-size:
            8px;
        }

        .media-main-button {
          min-height:
            70px;
        }

        .camera-button {
          min-height:
            70px;
        }

        .photo-editor-heading strong {
          font-size:
            13px;
        }

        .sticker-button {
          width:
            39px;

          height:
            39px;

          font-size:
            20px;
        }

        .guest-trust {
          padding:
            0 8px;
        }

        .butterfly {
          font-size:
            22px;
        }
      }

      @media (
        max-width: 430px
      ) {
        .message-label-row {
          display:
            grid;

          justify-content:
            stretch;

          gap:
            7px;
        }

        .message-label-row label {
          justify-content:
            center !important;

          text-align:
            center !important;
        }

        .ai-help-button {
          justify-self:
            center;
        }
      }

      @media (
        max-width: 390px
      ) {
        .guest-page {
          padding:
            12px 7px 40px;
        }

        .hero-name {
          font-size:
            49px;
        }

        .hero-xv {
          font-size:
            24px;

          letter-spacing:
            7px;
        }

        .composer {
          padding:
            18px 12px 16px;
        }

        .media-picker {
          grid-template-columns:
            minmax(0,1fr) 44px;
        }

        .media-main-button {
          grid-template-columns:
            37px 1fr auto;

          padding:
            9px;
        }

        .media-big-icon {
          width:
            37px;

          height:
            37px;
        }

        .media-copy strong {
          font-size:
            11px;
        }

        .media-copy small {
          font-size:
            8px;
        }
      }

      @media (
        prefers-reduced-motion: reduce
      ) {
        .butterfly,
        .background-sparkle,
        .ai-spinner {
          animation:
            none !important;
        }

        .send-button,
        .media-main-button,
        .camera-button,
        .sticker-button {
          transition:
            none !important;
        }
      }
    `}</style>
  );
}

export default Guest;