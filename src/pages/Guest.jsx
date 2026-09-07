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

const MAX_VIDEO_DURATION = 60;


/* =========================================
   GUEST
========================================= */

function Guest() {

  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

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


        setUser(currentUser);

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



  /* =========================================
     LIMPIAR ARCHIVO
  ========================================= */

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



      /* -----------------------------------------
         TAMAÑO MÁXIMO
      ----------------------------------------- */

      if (
        isVideoTooLarge(
          file
        )
      ) {

        setResult(
          'El video supera los 50 MB. Elegí uno más corto o más pequeño.'
        );

        setResultType(
          'error'
        );

        clearSelectedFile();

        return;

      }



      try {

        /* =====================================
           VIDEO
        ===================================== */

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



        /* =====================================
           IMAGEN
        ===================================== */

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


      } catch (error) {

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
         * Si la compresión de video falla,
         * permitimos el original si es pequeño.
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



  /* =========================================
     CANCELAR VIDEO
  ========================================= */

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
         * La IA tiene tiempo limitado.
         * Si tarda demasiado, solamente
         * falla el panel de IA.
         *
         * El formulario continúa funcionando.
         */

        const timeoutPromise =
          new Promise(
            (
              _,
              reject
            ) => {

              window.setTimeout(
                () => {

                  reject(
                    new Error(
                      'AI_TIMEOUT'
                    )
                  );

                },
                10000
              );

            }
          );



        const requestPromise =
          supabase.functions.invoke(

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



        const {
          data,
          error,
        } =
          await Promise.race([
            requestPromise,
            timeoutPromise,
          ]);



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

                /*
                 * Permitimos que la función
                 * devuelva strings simples.
                 */

                if (
                  typeof item ===
                  'string'
                ) {

                  return {

                    style:
                      `Idea ${index + 1}`,

                    text:
                      item.trim(),

                  };

                }



                /*
                 * También soportamos:
                 *
                 * {
                 *   style: "...",
                 *   text: "..."
                 * }
                 */

                if (
                  item &&
                  typeof item.text ===
                    'string'
                ) {

                  return {

                    style:
                      item.style ||
                      `Idea ${index + 1}`,

                    text:
                      item.text.trim(),

                  };

                }


                return null;

              }
            )

            .filter(
              Boolean
            )

            .filter(
              item =>
                item.text.length >
                0
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


        let errorMessage =
          'No pudimos generar sugerencias ahora. Podés volver a intentar o escribir normalmente.';



        if (
          error?.message ===
          'AI_TIMEOUT'
        ) {

          errorMessage =
            'La ayuda está tardando más de lo esperado. Podés seguir escribiendo o volver a intentar.';

        }



        setAiError(
          errorMessage
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
     FORMATEAR TAMAÑO
  ========================================= */

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



  const isVideo =
    optimizedFile?.type?.startsWith(
      'video/'
    );


  const isImage =
    optimizedFile?.type?.startsWith(
      'image/'
    );


  /*
   * IMPORTANTE:
   *
   * generatingMessage NO forma parte
   * de canSubmit.
   *
   * La IA nunca bloquea el envío.
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

                  <span className="camera-icon">
                    📷
                  </span>

                  <span className="camera-text">
                    Cámara
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

                    <span>

                      {
                        formatSize(
                          optimizedFile?.size ||
                          originalFile?.size
                        )
                      }

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
                VIDEO
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
                        uploading
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



        {/* =====================================
            FOOTER
        ===================================== */}

        <footer className="guest-footer">


          <div className="footer-line">

            <span />

            ♕

            <span />

          </div>


          <p>
            Gracias por ser parte de este momento tan especial ✨
          </p>


          <AltexBrand
            variant="guest"
          />

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

    ['2%', '5%', '.55', '.52', '0s', '19s'],
    ['14%', '10%', '.32', '.30', '-4s', '23s'],
    ['88%', '6%', '.68', '.57', '-8s', '25s'],
    ['77%', '15%', '.37', '.29', '-2s', '21s'],
    ['4%', '25%', '.45', '.33', '-10s', '24s'],
    ['93%', '29%', '.51', '.39', '-6s', '20s'],
    ['1%', '39%', '.60', '.43', '-13s', '26s'],
    ['46%', '18%', '.36', '.24', '-5s', '27s'],
    ['59%', '31%', '.43', '.27', '-12s', '25s'],
    ['95%', '42%', '.39', '.29', '-9s', '22s'],
    ['6%', '53%', '.56', '.40', '-15s', '24s'],
    ['42%', '54%', '.32', '.22', '-17s', '29s'],
    ['62%', '61%', '.44', '.26', '-8s', '26s'],
    ['91%', '63%', '.57', '.42', '-7s', '24s'],
    ['5%', '75%', '.48', '.35', '-14s', '21s'],
    ['36%', '78%', '.31', '.21', '-15s', '28s'],
    ['82%', '80%', '.54', '.39', '-12s', '25s'],
    ['17%', '90%', '.34', '.26', '-3s', '22s'],
    ['59%', '90%', '.41', '.27', '-10s', '27s'],
    ['91%', '92%', '.45', '.31', '-18s', '26s'],

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