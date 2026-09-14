import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { supabase } from '../lib/supabase';
import { signInAnonymous } from '../lib/auth';
import { uploadEventMedia } from '../lib/storage';
import { optimizeImage } from '../lib/image';

import {
  compressVideo,
  shouldCompressVideo,
  isVideoTooLarge,
  cancelVideoCompression,
  VideoCompressionCancelledError,
} from '../lib/video';

import AltexBrand from '../components/AltexBrand';

import './Guest.css';


const EVENT_ID =
  '90eabcfb-7104-4ebf-bd46-401d416f0c83';

const LARA_PHOTO_URL =
  'https://res.cloudinary.com/dl81eetla/image/upload/v1788752908/IMG-20260525-WA0088_tm8ya1.jpg';

const MAX_VIDEO_DURATION = 180;


/* =========================================
   GUEST
========================================= */

function Guest() {

  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const previewUrlRef = useRef('');

  const [user, setUser] = useState(null);

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

  const [previewError, setPreviewError] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [preparingVideo, setPreparingVideo] =
    useState(false);

  const [videoProgress, setVideoProgress] =
    useState(0);

  const [
    preparationStatus,
    setPreparationStatus,
  ] = useState('');

  const [result, setResult] =
    useState('');

  const [resultType, setResultType] =
    useState('');


  /* =========================================
     IA
  ========================================= */

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

  const [aiError, setAiError] =
    useState('');


  /* =========================================
     PREVIEW URL
  ========================================= */

  const replacePreviewUrl = url => {

    if (
      previewUrlRef.current &&
      previewUrlRef.current !== url
    ) {

      URL.revokeObjectURL(
        previewUrlRef.current
      );

    }

    previewUrlRef.current =
      url || '';

    setPreviewUrl(
      url || ''
    );

  };


  /* =========================================
     INICIALIZACIÓN
  ========================================= */

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

      } catch (error) {

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

      cancelVideoCompression();


      if (
        previewUrlRef.current
      ) {

        URL.revokeObjectURL(
          previewUrlRef.current
        );

        previewUrlRef.current =
          '';

      }

    };

  }, []);


  /* =========================================
     DURACIÓN DEL VIDEO
  ========================================= */

  const getVideoDuration =
    file =>
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


          let settled = false;


          const cleanup =
            () => {

              video.onloadedmetadata =
                null;

              video.onerror =
                null;

              video.removeAttribute(
                'src'
              );

              try {
                video.load();
              } catch {
                // No es crítico.
              }

              URL.revokeObjectURL(
                url
              );

            };


          const finish =
            callback => {

              if (settled) {
                return;
              }

              settled = true;

              cleanup();

              callback();

            };


          video.preload =
            'metadata';

          video.muted =
            true;

          video.playsInline =
            true;


          video.onloadedmetadata =
            () => {

              const duration =
                video.duration;

              finish(
                () =>
                  resolve(
                    duration
                  )
              );

            };


          video.onerror =
            () => {

              finish(
                () =>
                  reject(
                    new Error(
                      'No pudimos comprobar la duración del video.'
                    )
                  )
              );

            };


          video.src =
            url;

        }
      );


  /* =========================================
     LIMPIAR ARCHIVO
  ========================================= */

  const clearSelectedFile =
    () => {

      cancelVideoCompression();

      replacePreviewUrl('');

      setOriginalFile(
        null
      );

      setOptimizedFile(
        null
      );

      setPreviewError(
        false
      );

      setPreparingVideo(
        false
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


  /* =========================================
     SELECCIONAR ARCHIVO
  ========================================= */
const handleFileChange =
  async event => {

    const file =
      event.target.files?.[0];


    if (!file) {
      return;
    }


    /*
     * Detenemos cualquier preparación anterior
     * y limpiamos la preview previa.
     */

    cancelVideoCompression();

    replacePreviewUrl('');

    setOriginalFile(file);

    setOptimizedFile(null);

    setPreviewError(false);

    setResult('');

    setResultType('');

    setVideoProgress(0);

    setPreparationStatus('');


    /* =====================================
       VIDEO
    ===================================== */

    if (
      file.type?.startsWith('video/')
    ) {

      /* ===================================
         TAMAÑO
      =================================== */

      if (
        isVideoTooLarge(file)
      ) {

        setResult(
          'Este video supera los 50 MB. Elegí uno más pequeño para poder compartirlo.'
        );

        setResultType('warning');

        clearSelectedFile();

        return;
      }


      setPreparingVideo(true);

      setPreparationStatus(
        'Comprobando tu video...'
      );


      try {

        /* =================================
           DURACIÓN
        ================================= */

        try {

          const duration =
            await getVideoDuration(file);


          if (
            Number.isFinite(duration) &&
            duration > MAX_VIDEO_DURATION
          ) {

            setResult(
              'Este video dura más de 3 minutos. Elegí uno más corto para poder compartirlo 💕'
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

          /*
           * Algunos navegadores no pueden leer
           * correctamente la metadata de ciertos
           * videos locales.
           *
           * Eso NO significa necesariamente que
           * el archivo sea inválido.
           */

          console.warn(
            'No se pudo comprobar la duración del video:',
            durationError
          );

        }


        let finalFile =
          file;


        /* =================================
           OPTIMIZAR VIDEOS GRANDES
        ================================= */

        if (
          shouldCompressVideo(file)
        ) {

          setPreparationStatus(
            'Optimizando tu video...'
          );


          try {

            finalFile =
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

          } catch (
            compressionError
          ) {

            if (
              compressionError instanceof
                VideoCompressionCancelledError
            ) {

              throw compressionError;
            }


            /*
             * La compresión es una mejora,
             * no un requisito para subir.
             *
             * Si falla y el original está dentro
             * de los 50 MB, usamos el original.
             */

            console.warn(
              'La optimización del video falló. Se utilizará el original:',
              compressionError
            );


            finalFile =
              file;
          }

        }


        /* =================================
           ARCHIVO LISTO
        ================================= */

        setOptimizedFile(
          finalFile
        );


        /* =================================
           VISTA PREVIA
        ================================= */

        /*
         * La preview NO determina si el video
         * puede enviarse.
         *
         * Si el navegador no puede mostrar
         * localmente determinado MP4, el archivo
         * sigue seleccionado.
         */

        try {

          const url =
            URL.createObjectURL(
              finalFile
            );


          replacePreviewUrl(
            url
          );

          setPreviewError(
            false
          );

        } catch (
          previewCreationError
        ) {

          console.warn(
            'No se pudo crear la vista previa del video:',
            previewCreationError
          );


          replacePreviewUrl('');

          setPreviewError(
            true
          );

        }


        setVideoProgress(
          100
        );

        setPreparationStatus(
          'Video listo para compartir.'
        );

      } catch (error) {

        if (
          error instanceof
            VideoCompressionCancelledError
        ) {

          return;
        }


        console.error(
          'Error preparando video:',
          error
        );


        /*
         * Si ocurre un error inesperado pero el
         * archivo original cumple el límite de
         * tamaño, todavía permitimos utilizarlo.
         */

        if (
          file.size <=
            50 * 1024 * 1024
        ) {

          setOptimizedFile(
            file
          );


          try {

            const url =
              URL.createObjectURL(
                file
              );


            replacePreviewUrl(
              url
            );

            setPreviewError(
              false
            );

          } catch (
            previewError
          ) {

            console.warn(
              'No se pudo crear la vista previa:',
              previewError
            );


            replacePreviewUrl('');

            setPreviewError(
              true
            );

          }


          setPreparationStatus(
            'Video listo para compartir.'
          );

        } else {

          clearSelectedFile();


          setResult(
            'No pudimos preparar este video. Elegí otro archivo.'
          );

          setResultType(
            'error'
          );

        }

      } finally {

        setPreparingVideo(
          false
        );

      }


      return;
    }


    /* =====================================
       IMAGEN
    ===================================== */

    try {

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


      replacePreviewUrl(
        url
      );


      setPreparationStatus(
        'Foto lista para compartir.'
      );

    } catch (error) {

      console.error(
        'Error preparando imagen:',
        error
      );


      setOptimizedFile(
        null
      );


      setResult(
        `No pudimos preparar la foto: ${error.message}`
      );

      setResultType(
        'error'
      );

    }

  };
  /* =========================================
     CANCELAR VIDEO
  ========================================= */

  const handleCancelVideo =
    () => {

      cancelVideoCompression();

      clearSelectedFile();


      setResult(
        'La preparación del video fue cancelada. Podés elegir otro.'
      );

      setResultType(
        'info'
      );

    };


  /* =========================================
     CAMPOS
  ========================================= */

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


  /* =========================================
     CÁMARA
  ========================================= */

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


  /* =========================================
     GALERÍA
  ========================================= */

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


  /* =========================================
     IA
  ========================================= */

  const handleGenerateMessage =
    async () => {

      if (
        generatingMessage ||
        uploading
      ) {
        return;
      }


      setGeneratingMessage(
        true
      );

      setShowSuggestions(
        true
      );

      setMessageSuggestions(
        []
      );

      setAiError(
        ''
      );


      try {

        /*
         * IMPORTANTE:
         *
         * Guest ya NO tiene un timeout propio.
         *
         * La Edge Function es la responsable
         * de controlar los tiempos de Gemini.
         */

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

                eventName:
                  'Lara XV',

                maxLength:
                  150,

              },

            }

          );


        if (error) {

          throw error;

        }


        const rawSuggestions =
          Array.isArray(
            data?.suggestions
          )
            ? data.suggestions
            : [];


        const suggestions =
          rawSuggestions

            .map(
              (
                item,
                index
              ) => {

                if (
                  typeof item ===
                  'string'
                ) {

                  const text =
                    item.trim();


                  if (!text) {
                    return null;
                  }


                  return {

                    style:
                      `Idea ${index + 1}`,

                    text,

                  };

                }


                if (
                  item &&
                  typeof item.text ===
                    'string'
                ) {

                  const text =
                    item.text.trim();


                  if (!text) {
                    return null;
                  }


                  return {

                    style:
                      item.style ||
                      `Idea ${index + 1}`,

                    text,

                  };

                }


                return null;

              }
            )

            .filter(Boolean)

            .filter(
              item =>
                item.text.length >
                0
            )

            .map(
              item => ({

                ...item,

                text:
                  item.text.slice(
                    0,
                    150
                  ),

              })
            )

            .slice(
              0,
              3
            );


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

      } catch (error) {

        console.error(
          'Error generando sugerencias:',
          error
        );


        setAiError(
          'No pudimos generar sugerencias ahora. Podés volver a intentar o escribir normalmente.'
        );

        setMessageSuggestions(
          []
        );

        setShowSuggestions(
          true
        );

      } finally {

        setGeneratingMessage(
          false
        );

      }

    };


  /* =========================================
     USAR SUGERENCIA
  ========================================= */

  const useSuggestion =
    text => {

      if (!text) {
        return;
      }


      setMessage(
        text.slice(
          0,
          150
        )
      );

      setShowSuggestions(
        false
      );

      setAiError(
        ''
      );

      setResult(
        ''
      );

      setResultType(
        ''
      );

    };


  /* =========================================
     ENVIAR
  ========================================= */

  const handleUpload =
    async () => {

      const cleanName =
        authorName.trim();

      const cleanMessage =
        message.trim();


      if (!cleanName) {

        setResult(
          'Contanos tu nombre para que Lara sepa quién dejó este recuerdo 💕'
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


        /* =====================================
           ARCHIVO
        ===================================== */

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

          /* ===================================
             SOLO MENSAJE
          =================================== */

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


        /* =====================================
           ÉXITO
        ===================================== */

        setResult(
          '¡Tu recuerdo llegó! Lara va a guardar este momento 💕'
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

        setAiError(
          ''
        );

        clearSelectedFile();

      } catch (error) {

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


  /* =========================================
     TIPO DE ARCHIVO
  ========================================= */

  const isVideo =
    optimizedFile?.type?.startsWith(
      'video/'
    );

  const isImage =
    optimizedFile?.type?.startsWith(
      'image/'
    );


  /*
   * La IA NO participa de canSubmit.
   */

  const canSubmit =

    Boolean(
      authorName.trim()
    ) &&

    Boolean(
      optimizedFile ||
      message.trim()
    ) &&

    !uploading &&

    !preparingVideo;


  /* =========================================
     CARGANDO SESIÓN
  ========================================= */

  if (!user) {

    return (

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
            Preparando esta tarde especial... ✨
          </p>

        </div>

      </div>

    );

  }


  /* =========================================
     UI
  ========================================= */

  return (

    <div className="guest-page">

      <Background />


      <main className="guest-container">


        {/* =====================================
            HERO
        ===================================== */}

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


        {/* =====================================
            FORMULARIO
        ===================================== */}

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


          {/* ===================================
              NOMBRE
          =================================== */}

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


          {/* ===================================
              FOTO / VIDEO
          =================================== */}

          <div className="field">


            <label>

              <span>
                📸
              </span>

              Compartí tu momento

            </label>


            {/* GALERÍA */}

            <input

              ref={
                galleryInputRef
              }

              type="file"

              accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/webm,video/quicktime"

              onChange={
                handleFileChange
              }

              disabled={
                uploading ||
                preparingVideo
              }

              className="hidden-input"

            />


            {/* CÁMARA */}

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

              className="hidden-input"

            />


            {!originalFile &&
              !preparingVideo && (

              <div className="media-picker">

                <button

                  type="button"

                  className="media-option-button"

                  onClick={
                    openGallery
                  }

                  disabled={
                    uploading
                  }

                >

                  <span className="media-option-icon">
                    🖼️
                  </span>

                  <span className="media-option-title">
                    Foto o video
                  </span>

                  <span className="media-option-subtitle">
                    Desde tu galería
                  </span>

                </button>


                <button

                  type="button"

                  className="media-option-button"

                  onClick={
                    openCamera
                  }

                  disabled={
                    uploading
                  }

                  aria-label="Abrir cámara"

                >

                  <span className="media-option-icon">
                    📷
                  </span>

                  <span className="media-option-title">
                    Cámara
                  </span>

                  <span className="media-option-subtitle">
                    Sacá una foto
                  </span>

                </button>

              </div>

            )}


            {/* =================================
                PREPARANDO VIDEO
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
                FOTO
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
                      {
                        originalFile?.name
                      }
                    </strong>

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
                VIDEO
            ================================= */}

            {isVideo &&
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


                  {previewUrl &&
                    !previewError ? (

                    <div className="preview-media">

                      <video

                        key={
                          previewUrl
                        }

                        src={
                          previewUrl
                        }

                        controls

                        playsInline

                        preload="metadata"

                        onLoadedMetadata={() => {

                          setPreviewError(
                            false
                          );

                        }}

                        onError={event => {

                          console.warn(
                            'Este navegador no pudo mostrar la vista previa local:',
                            event.currentTarget.error
                          );

                          setPreviewError(
                            true
                          );

                        }}

                      >
                        Tu navegador no puede reproducir la vista previa de este video.
                      </video>

                    </div>

                  ) : (

                    <div className="field-hint">

                      🎥 Video seleccionado y listo para enviar.
                      La vista previa no está disponible en este navegador.

                    </div>

                  )}

                </div>

              </>

            )}


            <div className="field-hint">

              📸 Foto · 🎥 video corto · máximo 50 MB

            </div>

          </div>


          {/* ===================================
              MENSAJE
          =================================== */}

          <div className="field">


            <div className="message-label-row">


              <label htmlFor="message">

                <span>
                  💌
                </span>

                Un mensajito para Lara

                <span className="optional-label">
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
                IA
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

                    className="ai-close"

                    aria-label="Cerrar sugerencias"

                    onClick={() => {

                      setShowSuggestions(
                        false
                      );

                      setAiError(
                        ''
                      );

                    }}

                  >
                    ×
                  </button>

                </div>


                {generatingMessage ? (

                  <div className="ai-loading">

                    <span className="ai-spinner">
                      ✦
                    </span>

                    <span>
                      Preparando unas palabras especiales...
                    </span>

                  </div>

                ) : aiError ? (

                  <div
                    className="ai-error"
                    role="status"
                  >

                    <span>
                      {
                        aiError
                      }
                    </span>


                    <button

                      type="button"

                      className="ai-retry-button"

                      onClick={
                        handleGenerateMessage
                      }

                      disabled={
                        uploading ||
                        generatingMessage
                      }

                    >
                      Reintentar
                    </button>

                  </div>

                ) : (

                  <div className="suggestion-list">

                    {
                      messageSuggestions.map(
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

                              {
                                suggestion.style ||
                                `Idea ${index + 1}`
                              }

                            </span>


                            <span className="suggestion-text">

                              {
                                suggestion.text
                              }

                            </span>


                            <span className="suggestion-use">
                              Usar →
                            </span>

                          </button>

                        )
                      )
                    }

                  </div>

                )}

              </div>

            )}

          </div>


          {/* ===================================
              ENVIAR
          =================================== */}

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

              {
                uploading
                  ? '…'
                  : '✨'
              }

            </span>


            <strong>

              {
                uploading
                  ? 'Enviando...'
                  : 'Enviar algo lindo 💕'
              }

            </strong>


            <span>
              →
            </span>

          </button>


          {/* ===================================
              RESULTADO
          =================================== */}

          {result && (

            <div
              className={`result ${resultType}`}
            >


              <div className="result-symbol">

                {
                  resultType ===
                  'success'
                    ? '✓'
                    : resultType ===
                      'error'
                    ? '!'
                    : '✦'
                }

              </div>


              <div>

                <strong>

                  {
                    resultType ===
                    'success'
                      ? '¡Recibido!'
                      : resultType ===
                        'error'
                      ? 'Ocurrió un problema'
                      : 'Aviso'
                  }

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


        {/* =====================================
            AVISO
        ===================================== */}

        <div className="guest-trust">

          <span>
            ✦
          </span>

          Tu recuerdo será revisado automáticamente
          antes de aparecer en pantalla.

          <span>
            ✦
          </span>

         
         
        </div>
        <p>
          Gracias por ser parte de este momento tan especial ✨
        </p>

        {/* =====================================
            FOOTER
        ===================================== */}

        <footer className="guest-footer">
          <div className="guest-footer-crowns">
            <span />
            ♕ ♕ ♕
            <span />
          </div>

          <AltexBrand variant="guest" />
        </footer>


      </main>

    </div>

  );

}


/* =========================================
   FONDO
========================================= */

function Background() {

  const butterflies = [

    ['2%', '5%', '.55', '.52', '0s', '13s'],
    ['14%', '10%', '.32', '.30', '-4s', '16s'],
    ['88%', '6%', '.68', '.57', '-8s', '17s'],
    ['77%', '15%', '.37', '.29', '-2s', '14s'],
    ['4%', '25%', '.45', '.33', '-10s', '16s'],
    ['93%', '29%', '.51', '.39', '-6s', '13s'],
    ['1%', '39%', '.60', '.43', '-13s', '18s'],
    ['46%', '18%', '.36', '.24', '-5s', '17s'],
    ['59%', '31%', '.43', '.27', '-12s', '16s'],
    ['95%', '42%', '.39', '.29', '-9s', '14s'],
    ['6%', '53%', '.56', '.40', '-15s', '16s'],
    ['42%', '54%', '.32', '.22', '-17s', '18s'],
    ['62%', '61%', '.44', '.26', '-8s', '17s'],
    ['91%', '63%', '.57', '.42', '-7s', '15s'],
    ['5%', '75%', '.48', '.35', '-14s', '14s'],
    ['36%', '78%', '.31', '.21', '-15s', '18s'],
    ['82%', '80%', '.54', '.39', '-12s', '16s'],
    ['17%', '90%', '.34', '.26', '-3s', '15s'],
    ['59%', '90%', '.41', '.27', '-10s', '17s'],
    ['91%', '92%', '.45', '.31', '-18s', '16s'],

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

        {
          butterflies.map(
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
                    butterfly[0],

                  top:
                    butterfly[1],

                  '--scale':
                    butterfly[2],

                  '--opacity':
                    butterfly[3],

                  animationDelay:
                    butterfly[4],

                  animationDuration:
                    butterfly[5],

                }}

              >

                🦋

              </div>

            )
          )
        }


        {
          sparkles.map(
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
          )
        }

      </div>


      <div className="guest-grain" />

    </>

  );

}


export default Guest;