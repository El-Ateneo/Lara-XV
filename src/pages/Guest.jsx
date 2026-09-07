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

  const getLocalMessageSuggestions =
    () => {
      const name =
        authorName.trim();

      const prefix =
        name
          ? `${name}, `
          : '';

      return [
        {
          style:
            'Dulce',
          text:
            `${prefix}que esta nueva etapa esté llena de momentos hermosos, sueños cumplidos y personas que te hagan feliz. ¡Felices 15, Lara! 💕`,
        },
        {
          style:
            'Corto',
          text:
            `${prefix}felices 15, Lara. Que disfrutes muchísimo este día y guardes recuerdos lindísimos para siempre ✨`,
        },
        {
          style:
            'Especial',
          text:
            `${prefix}hoy empieza una etapa inolvidable. Deseo que siempre tengas motivos para sonreír y sueños enormes por cumplir. ¡Felices 15! 🦋`,
        },
      ];
    };

  const handleGenerateMessage =
    async () => {
      if (
        generatingMessage ||
        uploading
      ) {
        return;
      }

      const fallbackSuggestions =
        getLocalMessageSuggestions();

      try {
        setGeneratingMessage(
          true
        );

        setShowSuggestions(
          true
        );

        setMessageSuggestions(
          []
        );

        setResult(
          ''
        );

        setResultType(
          ''
        );

        const timeoutPromise =
          new Promise(
            (_, reject) => {
              setTimeout(
                () =>
                  reject(
                    new Error(
                      'AI_TIMEOUT'
                    )
                  ),
                7000
              );
            }
          );

        const aiPromise =
          supabase.functions.invoke(
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

        const {
          data,
          error,
        } =
          await Promise.race([
            aiPromise,
            timeoutPromise,
          ]);

        if (error) {
          throw error;
        }

        const suggestions =
          Array.isArray(
            data?.suggestions
          )
            ? data.suggestions
                .filter(
                  suggestion =>
                    suggestion?.text
                )
                .slice(
                  0,
                  3
                )
            : [];

        if (
          suggestions.length ===
          0
        ) {
          throw new Error(
            'AI_EMPTY'
          );
        }

        setMessageSuggestions(
          suggestions
        );
      } catch (
        error
      ) {
        console.warn(
          'Usando sugerencias locales:',
          error
        );

        setMessageSuggestions(
          fallbackSuggestions
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

        /*
         * ARCHIVO
         */

        if (
          optimizedFile
        ) {
          await uploadEventMedia({
            file:
              optimizedFile,

            originalFileName:
              originalFile?.name ||
              optimizedFile.name,

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
    !preparingVideo
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
                accept="image/*"
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
                    <span className="camera-icon">📷</span>
                    <span className="camera-text">Cámara</span>
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
                  FOTO SELECCIONADA
              ================================= */}

              {isImage &&
                previewUrl &&
                !preparingVideo && (
                <>
                  <div className="selected-file">
                    <div className="selected-file-icon">
                      📷
                    </div>

                    <div className="selected-file-info">
                      <strong>
                        {originalFile?.name}
                      </strong>

                      <span>
                        {formatSize(
                          optimizedFile?.size ||
                            originalFile?.size
                        )}

                        {optimizedFile &&
                          originalFile &&
                          optimizedFile.size <
                            originalFile.size && (
                          <>
                            {' '}
                            · reducida{' '}
                            {reduction}%
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
                      aria-label="Quitar foto"
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
                        ✓ LISTA
                      </span>
                    </div>

                    <div className="preview-media">
                      <img
                        src={
                          previewUrl
                        }
                        alt="Vista previa de la foto seleccionada"
                      />
                    </div>
                  </div>
                </>
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

      .preview-media video,
      .preview-media img {
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
         LEGIBILIDAD Y CONTRASTE
      ===================================== */

      .composer {
        border-color:
          rgba(255,255,255,.16);

        background:
          linear-gradient(
            180deg,
            rgba(10,12,22,.90),
            rgba(7,9,17,.86)
          );

        box-shadow:
          0 24px 70px
          rgba(0,0,0,.34),
          inset 0 1px 0
          rgba(255,255,255,.035);

        backdrop-filter:
          blur(18px);
      }

      .composer-title p {
        color:
          #eee8ef;

        font-size:
          13px;
      }

      .eyebrow {
        font-size:
          10px;
      }

      .field > label,
      .message-label-row label {
        color:
          #fffaf3;

        font-size:
          14px;

        font-weight:
          800;

        text-shadow:
          0 1px 8px
          rgba(0,0,0,.35);
      }

      .field > label > span:last-child,
      .message-label-row label > span:last-child {
        color:
          #c4bdc7;

        font-size:
          11px;
      }

      .input-shell,
      .textarea-shell {
        border:
          1px solid
          rgba(244,221,180,.30);

        background:
          rgba(4,6,12,.78);

        box-shadow:
          inset 0 1px 0
          rgba(255,255,255,.025);
      }

      .input-shell:focus-within,
      .textarea-shell:focus-within {
        border-color:
          rgba(239,207,145,.82);

        box-shadow:
          0 0 0 3px
          rgba(239,207,145,.13),
          inset 0 1px 0
          rgba(255,255,255,.03);
      }

      .input-shell input,
      .textarea-shell textarea {
        color:
          #ffffff;

        font-size:
          16px;
      }

      .input-shell input::placeholder,
      .textarea-shell textarea::placeholder {
        color:
          #b5afba;

        opacity:
          1;
      }

      .counter,
      .textarea-counter {
        color:
          #b9b2bc;

        font-size:
          10px;
      }

      .media-main-button,
      .camera-button {
        border-color:
          rgba(239,207,145,.34);

        background:
          linear-gradient(
            145deg,
            rgba(24,22,26,.94),
            rgba(17,16,24,.92)
          );

        box-shadow:
          inset 0 1px 0
          rgba(255,255,255,.035);
      }

      .media-copy strong {
        color:
          #fffaf4;

        font-size:
          14px;
      }

      .media-copy small,
      .field-hint {
        color:
          #c8c1ca;

        font-size:
          11px;
      }

      .selected-file {
        border-color:
          rgba(239,207,145,.24);

        background:
          rgba(5,7,13,.78);
      }

      .selected-file-info strong {
        color:
          #fffaf4;

        font-size:
          13px;
      }

      .selected-file-info span {
        color:
          #c1bbc5;

        font-size:
          11px;
      }

      .remove-button {
        width:
          38px;

        height:
          38px;

        border-color:
          rgba(255,255,255,.14);

        background:
          rgba(255,255,255,.06);

        color:
          #f1e9e2;
      }

      .preview {
        border-color:
          rgba(255,255,255,.12);

        background:
          rgba(3,5,10,.78);
      }

      .preview-head {
        color:
          #aaa4ae;

        font-size:
          9px;
      }

      .ai-help-button {
        min-height:
          38px;

        padding:
          8px 12px;

        font-size:
          11px;
      }

      .suggestion-text {
        font-size:
          13px;
      }

      .suggestion-style,
      .suggestion-use,
      .ai-suggestions-header span,
      .ai-loading {
        font-size:
          10px;
      }

      .ai-suggestions-header strong {
        font-size:
          12px;
      }


      /* =====================================
         CAMPOS MÁS VISIBLES
      ===================================== */

      .composer {
        background:
          linear-gradient(
            180deg,
            rgba(22,17,27,.96),
            rgba(13,12,21,.96)
          );

        border:
          1px solid
          rgba(242,210,164,.34);

        box-shadow:
          0 28px 80px
          rgba(0,0,0,.46),
          inset 0 1px 0
          rgba(255,255,255,.05);
      }

      .field {
        padding:
          14px;

        border:
          1px solid
          rgba(255,255,255,.08);

        border-radius:
          17px;

        background:
          rgba(255,247,239,.055);
      }

      .field > label,
      .message-label-row label {
        color:
          #fff5ec;

        font-size:
          15px;

        font-weight:
          850;
      }

      .input-shell {
        min-height:
          58px;

        border:
          2px solid
          rgba(217,174,188,.64);

        border-radius:
          14px;

        background:
          #f8e9ee;

        box-shadow:
          0 7px 22px
          rgba(0,0,0,.18);
      }

      .input-shell input {
        padding:
          15px 14px;

        color:
          #241a24;

        font-size:
          16px;

        font-weight:
          650;
      }

      .input-shell input::placeholder {
        color:
          #7b6573;

        opacity:
          1;
      }

      .input-shell:focus-within {
        border-color:
          #efc981;

        box-shadow:
          0 0 0 4px
          rgba(239,201,129,.18),
          0 7px 22px
          rgba(0,0,0,.20);
      }

      .textarea-shell {
        border:
          2px solid
          rgba(217,174,188,.64);

        border-radius:
          14px;

        background:
          #f8e9ee;

        box-shadow:
          0 7px 22px
          rgba(0,0,0,.18);
      }

      .textarea-shell textarea {
        min-height:
          125px;

        padding:
          15px 14px 30px;

        background:
          transparent;

        color:
          #241a24;

        font-size:
          16px;

        font-weight:
          600;
      }

      .textarea-shell textarea::placeholder {
        color:
          #7b6573;

        opacity:
          1;
      }

      .textarea-shell:focus-within {
        border-color:
          #efc981;

        box-shadow:
          0 0 0 4px
          rgba(239,201,129,.18),
          0 7px 22px
          rgba(0,0,0,.20);
      }

      .counter,
      .textarea-counter {
        color:
          #765f6d;

        font-size:
          11px;

        font-weight:
          800;
      }

      .media-picker {
        gap:
          10px;
      }

      .media-main-button {
        min-height:
          72px;

        border:
          2px solid
          rgba(239,201,129,.52);

        background:
          linear-gradient(
            135deg,
            #fff4e6,
            #f4e2e9
          );

        color:
          #241a24;
      }

      .media-copy strong {
        color:
          #241a24;

        font-size:
          15px;
      }

      .media-copy small {
        color:
          #765f6d;

        font-size:
          12px;
      }

      .media-arrow {
        color:
          #6a4f5e;
      }

      .camera-button {
        min-width:
          88px;

        min-height:
          72px;

        display:
          flex;

        flex-direction:
          column;

        align-items:
          center;

        justify-content:
          center;

        gap:
          3px;

        border:
          2px solid
          rgba(239,201,129,.52);

        background:
          linear-gradient(
            135deg,
            #fff4e6,
            #f4e2e9
          );

        color:
          #241a24;
      }

      .camera-icon {
        font-size:
          22px;
      }

      .camera-text {
        font-size:
          11px;

        font-weight:
          850;
      }

      .field-hint {
        color:
          #e3d8e1;

        font-size:
          12px;
      }

      .ai-help-button {
        min-height:
          40px;

        border:
          1px solid
          rgba(239,201,129,.55);

        background:
          #f3e1e8;

        color:
          #4d3341;

        font-size:
          11px;

        font-weight:
          900;
      }

      .ai-suggestions {
        border:
          1px solid
          rgba(239,201,129,.30);

        background:
          rgba(11,10,17,.92);
      }

      .suggestion-card {
        border:
          1px solid
          rgba(255,255,255,.12);

        background:
          rgba(255,255,255,.055);
      }

      .suggestion-text {
        color:
          #fff5ee;

        font-size:
          13px;
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


        .media-picker {
          grid-template-columns:
            1fr 92px;
        }

        .camera-button {
          width:
            92px;
        }

        .field {
          padding:
            13px 11px;
        }

        .composer {
          background:
            rgba(8,10,18,.93);

          border-color:
            rgba(255,255,255,.18);
        }

        .composer-title p {
          font-size:
            13px;
        }

        .field > label,
        .message-label-row label {
          font-size:
            14px;
        }

        .input-shell {
          min-height:
            56px;
        }

        .input-shell input {
          padding:
            15px 14px;
        }

        .textarea-shell textarea {
          min-height:
            120px;

          padding:
            15px 14px 30px;
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
        .camera-button {
          transition:
            none !important;
        }
      }
    `}</style>
  );
}

export default Guest;