import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { QRCodeSVG } from 'qrcode.react';
import './Display.css';
import { supabase } from '../lib/supabase';
import {
  getApprovedPosts,
  getPostMediaUrl,
} from '../lib/posts';

/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const EVENT_ID =
  '90eabcfb-7104-4ebf-bd46-401d416f0c83';

const GUEST_URL =
  'https://recuerdos-lara-mis-xv.vercel.app/guest';

const LARA_AVATAR =
  'https://res.cloudinary.com/dl81eetla/image/upload/v1788835197/WhatsApp_Image_2026-09-07_at_15.16.41_s6jr3t.webp';

const ALTEX_LOGO =
  'https://res.cloudinary.com/dl81eetla/image/upload/q_auto/f_auto/v1775768400/logo2_rfm9jf.png';

const ALTEX_FALLBACK =
  'https://github.com/El-Ateneo/altex-servicio-tecnico/blob/main/web-app-manifest-512x512.png?raw=true';

const PHOTO_DURATION = 10000;
const VIDEO_DURATION = 16000;
const TEXT_DURATION = 10000;

/*
 * Fecha y hora exactas en que el Display
 * empieza a mostrar recuerdos y mensajes.
 */
/*
 * Inicio de la proyección:
 * 11 de octubre de 2026, 13:00,
 * hora de Argentina (UTC-3).
 *
 * Al usar un instante con offset explícito,
 * no dependemos de la zona horaria configurada
 * en la TV o en la computadora.
 */
const DISPLAY_START_AT =
  new Date('2026-10-11T13:00:00-03:00');
  /*new Date('2026-09-22T17:00:00-03:00');*/


/*
 * Refuerzo de sincronización.
 * Realtime sigue siendo el mecanismo principal,
 * pero este intervalo evita que una TV quede
 * mostrando contenido viejo si pierde un evento.
 */
const DISPLAY_REFRESH_MS = 30000;
const PRE_SHOW_BUCKET = 'display-pre-show';
const PRE_SHOW_SCENE_MS = 9000;
const PRE_SHOW_PHOTO_REFRESH_MS = 30000;

const PRE_SHOW_PHRASES = [
  'Hoy comienza un recuerdo que guardaré para siempre.',
  'Hay momentos que duran un instante y recuerdos que quedan para siempre.',
  'Gracias por acompañarme en este día tan especial.',
  'Cada sonrisa, cada abrazo y cada recuerdo hacen único este día.',
  'Un día soñado, rodeada de las personas que quiero.',
  'Hoy celebro mis XV y me hace feliz compartirlo con ustedes.',
  'Que este día quede para siempre en nuestros recuerdos.',
  'Cada momento de hoy será parte de una historia inolvidable.',
];

const MAX_FLOATING = 10;

/*
 * Las fotos flotantes cambian de manera
 * independiente y desfasada.
 */
const SLOT_CHANGE_MIN = 9000;
const SLOT_CHANGE_MAX = 1300;
const FLOAT_FADE_OUT = 850;

/* =========================================================
   HELPERS
   ========================================================= */

function isVideo(post) {
  return post?.file_type?.startsWith('video/');
}

function isImage(post) {
  return post?.file_type?.startsWith('image/');
}

function getDuration(post) {
  if (isVideo(post)) return VIDEO_DURATION;
  if (isImage(post)) return PHOTO_DURATION;
  return TEXT_DURATION;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function shuffleArray(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [
      result[j],
      result[i],
    ];
  }

  return result;
}


function cleanDisplayMessage(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

function getCountdown(target, now = new Date()) {
  const total = Math.max(
    0,
    target.getTime() - now.getTime()
  );

  const totalSeconds =
    Math.floor(total / 1000);

  const days = Math.floor(
    totalSeconds / 86400
  );

  const hours = Math.floor(
    (totalSeconds % 86400) / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds =
    totalSeconds % 60;

  const pad = (value) =>
    String(value).padStart(2, '0');

  return {
    total,
    days: pad(days),
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
  };
}

function interleaveDisplayItems(posts, messages) {
  if (messages.length === 0) {
    return posts;
  }

  if (posts.length === 0) {
    return messages;
  }

  const result = [];
  let messageIndex = 0;

  posts.forEach((post, index) => {
    result.push(post);

    /*
     * Un mensaje de RSVP cada tres recuerdos.
     * Si hay pocos recuerdos, igualmente
     * insertamos mensajes al final.
     */
    if (
      (index + 1) % 3 === 0 &&
      messageIndex < messages.length
    ) {
      result.push(messages[messageIndex]);
      messageIndex += 1;
    }
  });

  while (messageIndex < messages.length) {
    result.push(messages[messageIndex]);
    messageIndex += 1;
  }

  return result;
}

/* =========================================================
   DISPLAY
   ========================================================= */

function Display() {
  const [posts, setPosts] = useState([]);
  const [formMessages, setFormMessages] = useState([]);
  const [mediaUrls, setMediaUrls] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [transitionKey, setTransitionKey] = useState(0);
  const [altexLogo, setAltexLogo] = useState(ALTEX_LOGO);
  const [now, setNow] = useState(() => new Date());
  const [preShowPhotos, setPreShowPhotos] = useState([]);
  const [preShowScene, setPreShowScene] = useState(0);

  const previousIdsRef = useRef(new Set());
  const initializedRef = useRef(false);

  async function loadPosts() {
    try {
      /*
       * getApprovedPosts() mantiene al Display
       * trabajando únicamente con publicaciones
       * aprobadas.
       */
      const approvedPosts = await getApprovedPosts();

      const newIds = approvedPosts
        .filter(
          (post) =>
            !previousIdsRef.current.has(post.id)
        )
        .map((post) => post.id);

      const urls = {};

      await Promise.all(
        approvedPosts.map(async (post) => {
          if (!post.storage_path) return;

          try {
            urls[post.id] =
              await getPostMediaUrl(post.id);
          } catch (error) {
            console.error(
              `No se pudo cargar ${post.id}:`,
              error
            );
          }
        })
      );

      setMediaUrls(urls);
      setPosts(approvedPosts);

      /*
       * Un recuerdo recién aprobado
       * pasa inmediatamente al centro.
       */
      if (
        initializedRef.current &&
        newIds.length > 0
      ) {
        const newestId = newIds[0];

        const newIndex =
          approvedPosts.findIndex(
            (post) => post.id === newestId
          );

        if (newIndex >= 0) {
          setCurrentIndex(newIndex);
          setTransitionKey((value) => value + 1);
        }
      }

      /*
       * Si una publicación fue eliminada,
       * rechazada o dejó de estar aprobada,
       * ya no estará en approvedPosts y
       * desaparecerá del Display.
       */
      previousIdsRef.current = new Set(
        approvedPosts.map((post) => post.id)
      );

      initializedRef.current = true;
    } catch (error) {
      console.error(
        'Error cargando recuerdos:',
        error
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadFormMessages() {
    try {
      /*
       * Esta RPC devuelve únicamente los mensajes
       * que el administrador habilitó para Display.
       * No exponemos la tabla invitados completa.
       */
      const { data, error } = await supabase
        .rpc('get_mensajes_display');

      if (error) {
        throw error;
      }

      const nextMessages = (data || [])
        .map((item) => ({
          id: `rsvp-${item.id}`,
          source: 'rsvp',
          message: cleanDisplayMessage(
            item.mensaje
          ),
          author_name:
            item.nombre || 'Invitado',
          file_type: null,
          storage_path: null,
        }))
        .filter((item) => item.message);

      setFormMessages(nextMessages);
    } catch (error) {
      console.error(
        'Error cargando mensajes para Display:',
        error
      );
    }
  }

  async function loadPreShowPhotos() {
    try {
      const { data, error } = await supabase.storage
        .from(PRE_SHOW_BUCKET)
        .list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } });

      if (error) throw error;

      const imageFiles = (data || []).filter((file) =>
        /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name)
      );

      const photos = imageFiles.map((file) => {
        const { data: publicData } = supabase.storage
          .from(PRE_SHOW_BUCKET)
          .getPublicUrl(file.name);
        return { name: file.name, url: publicData.publicUrl };
      });

      setPreShowPhotos(photos);
    } catch (error) {
      console.error('Error cargando fotos de la espera:', error);
    }
  }

  /* =======================================================
     REALTIME
     ======================================================= */

  useEffect(() => {
    loadPosts();
    loadFormMessages();
    loadPreShowPhotos();

    const postsChannel = supabase
      .channel('display-event-posts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_posts',
          filter: `event_id=eq.${EVENT_ID}`,
        },
        () => {
          loadPosts();
        }
      )
      .subscribe();

    /*
     * El Display público no necesita leer
     * directamente la tabla invitados.
     * La RPC segura se refresca periódicamente.
     *
     * Esto también funciona como respaldo de
     * Realtime para event_posts: si la TV pierde
     * un evento, a los pocos segundos se corrige.
     */
    const refreshTimer = setInterval(() => {
      loadPosts();
      loadFormMessages();
    }, DISPLAY_REFRESH_MS);

    const preShowPhotoTimer = setInterval(() => {
      loadPreShowPhotos();
    }, PRE_SHOW_PHOTO_REFRESH_MS);

    return () => {
      clearInterval(refreshTimer);
      clearInterval(preShowPhotoTimer);
      supabase.removeChannel(postsChannel);
    };
  }, []);

  /*
   * Reloj local del Display.
   * Al llegar la hora configurada cambia
   * automáticamente a la presentación.
   */
  useEffect(() => {
    const clock = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(clock);
  }, []);

  const displayStart =
    DISPLAY_START_AT;

  const countdown =
    getCountdown(displayStart, now);

  const presentationStarted =
    countdown.total <= 0;

  useEffect(() => {
    if (presentationStarted) return undefined;

    const timer = window.setInterval(() => {
      setPreShowScene((current) => current + 1);
    }, PRE_SHOW_SCENE_MS);

    return () => window.clearInterval(timer);
  }, [presentationStarted]);


  const displayItems = useMemo(
    () =>
      interleaveDisplayItems(
        posts,
        formMessages
      ),
    [posts, formMessages]
  );

  /* =======================================================
     ROTACIÓN CENTRAL
     ======================================================= */

  useEffect(() => {
    if (!presentationStarted) {
      return undefined;
    }

    if (displayItems.length <= 1) {
      setCurrentIndex(0);
      return undefined;
    }

    const currentPost =
      displayItems[currentIndex];

    if (!currentPost) {
      setCurrentIndex(0);
      return undefined;
    }

    const duration =
      getDuration(currentPost);

    const timer = window.setTimeout(() => {
      setCurrentIndex((current) => {
        const nextIndex =
          (current + 1) %
          displayItems.length;

        return nextIndex;
      });

      setTransitionKey(
        (value) => value + 1
      );
    }, duration);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    currentIndex,
    displayItems.length,
    presentationStarted,
  ]);

  /*
   * Si cambia la lista mientras se está mostrando
   * contenido (por aprobación, eliminación o mensaje),
   * mantenemos el índice dentro de un rango válido.
   */
  useEffect(() => {
    if (displayItems.length === 0) {
      setCurrentIndex(0);
      return;
    }

    if (currentIndex >= displayItems.length) {
      setCurrentIndex(0);
    }
  }, [
    displayItems.length,
    currentIndex,
  ]);

  const currentPost =
    displayItems[currentIndex];

  const approvedImages = useMemo(() => {
    return posts.filter(
      (post) =>
        isImage(post) &&
        mediaUrls[post.id]
    );
  }, [posts, mediaUrls]);

  /* =======================================================
     LOADING
     ======================================================= */

  if (loading) {
    return (
      <>
<main className="display">
          <Background />
          <FloralBorders />

          <div className="loading">
            <div className="loading-butterfly">
              <Butterfly />
            </div>

            <RoyalTitle />

            <div className="loading-line" />

            <p>
              Preparando nuestros recuerdos...
            </p>
          </div>
        </main>
      </>
    );
  }

  /* =======================================================
     PRESENTACIÓN DE ESPERA
     ======================================================= */

  if (!presentationStarted) {
    return (
      <PreShow
        countdown={countdown}
        photos={preShowPhotos}
        sceneIndex={preShowScene}
        altexLogo={altexLogo}
        onLogoError={() => {
          if (altexLogo !== ALTEX_FALLBACK) setAltexLogo(ALTEX_FALLBACK);
        }}
      />
    );
  }

  /* =======================================================
     SIN RECUERDOS
     ======================================================= */

  if (displayItems.length === 0) {
    return (
      <>
<main className="display">
          <Background />
          <FloralBorders />

          <div className="empty">
            <RoyalTitle />

            <LargeOrnament />

            <h2>
              Un día para recordar
            </h2>

            <p>
              La celebración ya comenzó. Escaneá el QR y compartí tu recuerdo.
            </p>
          </div>

          <GuestQr />

          <AltexCredit
            logo={altexLogo}
            onLogoError={() => {
              if (altexLogo !== ALTEX_FALLBACK) {
                setAltexLogo(ALTEX_FALLBACK);
              }
            }}
          />
        </main>
      </>
    );
  }

  const mediaUrl =
    mediaUrls[currentPost?.id];

  return (
    <>
<main className="display">
        <Background />

        {/* Guardas decorativas */}
        <FloralBorders />

        {/* Nombre protegido */}
        <header className="top-brand">
          <RoyalTitle compact />
        </header>

        {/* 10 recuerdos flotantes */}
        <FloatingGallery
          images={approvedImages}
          mediaUrls={mediaUrls}
        />

        {/* Mariposas ambientales */}
        <Butterflies />

        {/* Recuerdo protagonista */}
        <section
          key={`${currentPost.id}-${transitionKey}`}
          className="hero"
        >
          <div className="hero-halo" />

          {mediaUrl ? (
            <>
              <ElegantMediaFrame
                post={currentPost}
                mediaUrl={mediaUrl}
              />

              <HeroMessage
                post={currentPost}
              />
            </>
          ) : (
            <TextMemory post={currentPost} />
          )}
        </section>

        <GuestQr />

        <AltexCredit
          logo={altexLogo}
          onLogoError={() => {
            if (altexLogo !== ALTEX_FALLBACK) {
              setAltexLogo(ALTEX_FALLBACK);
            }
          }}
        />
      </main>
    </>
  );
}

/* =========================================================
   PRESENTACIÓN PREVIA
   ========================================================= */

function PreShow({ countdown, photos, sceneIndex, altexLogo, onLogoError }) {
  const scenes = useMemo(() => {
    const result = [
      { type: 'welcome' },
      { type: 'countdown' },
    ];

    const totalPhrases = PRE_SHOW_PHRASES.length;
    const participationAfter = Math.max(1, Math.ceil(totalPhrases / 2));

    PRE_SHOW_PHRASES.forEach((phrase, index) => {
      if (index < photos.length) {
        result.push({
          type: 'photo',
          photo: photos[index],
          phrase,
        });
      }

      result.push({
        type: 'phrase',
        phrase,
      });

      if (index + 1 === participationAfter) {
        result.push({ type: 'participate' });
      }
    });

    if (photos.length > PRE_SHOW_PHRASES.length) {
      photos.slice(PRE_SHOW_PHRASES.length).forEach((photo, index) => {
        result.push({
          type: 'photo',
          photo,
          phrase: PRE_SHOW_PHRASES[index % PRE_SHOW_PHRASES.length],
        });
      });
    }

    result.push({ type: 'countdown' });
    return result;
  }, [photos]);

  const scene = scenes[sceneIndex % scenes.length];

  return (
    <main className="display pre-show">
      <Background />
      <FloralBorders />
      <Butterflies />

      <div key={`${scene.type}-${sceneIndex}`} className="pre-show-stage">
        {scene.type === 'welcome' && (
          <div className="pre-show-copy pre-show-welcome">
            <RoyalTitle />
            <div className="pre-show-kicker">BIENVENIDOS A</div>
            <h2>Mis XV</h2>
            <p>Gracias por acompañarme en este día tan especial ♡</p>
          </div>
        )}

        {scene.type === 'countdown' && (
          <div className="countdown-screen pre-show-countdown">
            <RoyalTitle />
            <h2>Todo está por comenzar</h2>
            <p className="countdown-intro">Los recuerdos comienzan en</p>
            <div className="countdown-clock" aria-label="Cuenta regresiva">
              <div><strong>{countdown.days}</strong><span>DÍAS</span></div>
              <b>:</b>
              <div><strong>{countdown.hours}</strong><span>HORAS</span></div>
              <b>:</b>
              <div><strong>{countdown.minutes}</strong><span>MINUTOS</span></div>
              <b>:</b>
              <div><strong>{countdown.seconds}</strong><span>SEGUNDOS</span></div>
            </div>
            <p className="countdown-hint">
              Mientras esperás, escaneá el QR y dejale un recuerdo a Lara ♡
            </p>
          </div>
        )}

        {scene.type === 'photo' && (
          <div className="pre-show-photo-scene pre-show-photo-only">
            <div className="pre-show-photo-frame">
              <div className="pre-show-photo-glow" />
              <div className="pre-show-photo-inner">
                <img src={scene.photo.url} alt="Lara" className="pre-show-photo" />
              </div>
              <div className="pre-show-photo-butterfly" aria-hidden="true">
                <Butterfly />
              </div>
            </div>
            <div className="pre-show-photo-signature">Lara XV</div>
            <p className="pre-show-photo-phrase">“{scene.phrase}”</p>
          </div>
        )}

        {scene.type === 'participate' && (
          <div className="pre-show-copy">
            <RoyalTitle />
            <h2>Este día también se construye con tus recuerdos</h2>
            <p>Escaneá el QR y dejame una foto, un video o un mensaje ♡</p>
          </div>
        )}

        {scene.type === 'phrase' && (
          <div className="pre-show-copy">
            <RoyalTitle />
            <p className="pre-show-big-phrase">
              “{scene.phrase}”
            </p>
          </div>
        )}
      </div>

      <GuestQr />
      <AltexCredit logo={altexLogo} onLogoError={onLogoError} />
    </main>
  );
}

/* =========================================================
   GALERÍA FLOTANTE
   ========================================================= */

function FloatingGallery({
  images,
  mediaUrls,
}) {
  const containerRef = useRef(null);

  const cardsRef = useRef([]);
  const elementRefs = useRef([]);

  const imageQueueRef = useRef([]);
  const queueIndexRef = useRef(0);

  const [slots, setSlots] = useState([]);
  const [fadingSlots, setFadingSlots] =
    useState({});

  const imagesRef = useRef(images);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  function rebuildQueue() {
    imageQueueRef.current = shuffleArray(
      imagesRef.current.map(
        (post) => post.id
      )
    );

    queueIndexRef.current = 0;
  }

  function getNextImageId(
    excluded = new Set()
  ) {
    const available =
      imagesRef.current.filter(
        (post) =>
          !excluded.has(post.id)
      );

    if (available.length === 0) {
      return null;
    }

    if (
      imageQueueRef.current.length === 0 ||
      queueIndexRef.current >=
        imageQueueRef.current.length
    ) {
      rebuildQueue();
    }

    let attempts = 0;

    while (
      attempts <
      imageQueueRef.current.length
    ) {
      if (
        queueIndexRef.current >=
        imageQueueRef.current.length
      ) {
        rebuildQueue();
      }

      const id =
        imageQueueRef.current[
          queueIndexRef.current
        ];

      queueIndexRef.current += 1;
      attempts += 1;

      if (
        !excluded.has(id) &&
        imagesRef.current.some(
          (post) => post.id === id
        )
      ) {
        return id;
      }
    }

    return available[
      Math.floor(
        Math.random() *
          available.length
      )
    ]?.id;
  }

  /* =======================================================
     CREACIÓN INICIAL
     ======================================================= */

  useEffect(() => {
    if (images.length === 0) {
      setSlots([]);
      cardsRef.current = [];
      return;
    }

    rebuildQueue();

    const amount = Math.min(
      MAX_FLOATING,
      images.length
    );

    const used = new Set();

    const initialSlots =
      Array.from(
        { length: amount },
        (_, index) => {
          const postId =
            getNextImageId(used);

          if (postId) {
            used.add(postId);
          }

          return {
            slotId: index,
            postId,
            version: 0,
          };
        }
      );

    setSlots(initialSlots);
  }, [images.length]);

  /* =======================================================
     PUBLICACIONES ELIMINADAS / RECHAZADAS
     ======================================================= */

  useEffect(() => {
    if (images.length === 0) {
      return;
    }

    const validIds = new Set(
      images.map((post) => post.id)
    );

    setSlots((current) => {
      const visible = new Set(
        current
          .map((slot) => slot.postId)
          .filter(Boolean)
      );

      return current.map((slot) => {
        if (
          slot.postId &&
          validIds.has(slot.postId)
        ) {
          return slot;
        }

        const nextId =
          getNextImageId(visible);

        if (nextId) {
          visible.add(nextId);
        }

        return {
          ...slot,
          postId: nextId,
          version: slot.version + 1,
        };
      });
    });
  }, [images]);

  /* =======================================================
     CAMBIO INDEPENDIENTE Y SUAVE
     ======================================================= */

  useEffect(() => {
    if (slots.length === 0) {
      return undefined;
    }

    const timers = [];
    let cancelled = false;

    function scheduleChange(index, first = false) {
      const delay = first
        ? 1700 +
          index * 520 +
          randomBetween(0, 1000)
        : randomBetween(
            SLOT_CHANGE_MIN,
            SLOT_CHANGE_MAX
          );

      const timer = setTimeout(() => {
        if (cancelled) return;

        changeSlot(index);

        scheduleChange(index, false);
      }, delay);

      timers.push(timer);
    }

    function changeSlot(index) {
      /*
       * FASE 1:
       * solamente esa foto comienza
       * a desvanecerse.
       */
      setFadingSlots((current) => ({
        ...current,
        [index]: true,
      }));

      const swapTimer = setTimeout(() => {
        if (cancelled) return;

        setSlots((current) => {
          if (!current[index]) {
            return current;
          }

          const visible = new Set(
            current
              .map((item) => item.postId)
              .filter(Boolean)
          );

          visible.delete(
            current[index].postId
          );

          const nextId =
            getNextImageId(visible);

          if (!nextId) {
            return current;
          }

          const next = [...current];

          next[index] = {
            ...next[index],
            postId: nextId,
            version:
              next[index].version + 1,
          };

          /*
           * La nueva foto aparecerá
           * en otra posición.
           */
          const card =
            cardsRef.current[index];

          if (card) {
            card.reposition = true;
          }

          return next;
        });

        /*
         * FASE 2:
         * la nueva fotografía aparece
         * suavemente.
         */
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (cancelled) return;

            setFadingSlots(
              (current) => ({
                ...current,
                [index]: false,
              })
            );
          });
        });
      }, FLOAT_FADE_OUT);

      timers.push(swapTimer);
    }

    slots.forEach((_, index) => {
      scheduleChange(index, true);
    });

    return () => {
      cancelled = true;

      timers.forEach((timer) => {
        clearTimeout(timer);
      });
    };
  }, [slots.length]);

  /* =======================================================
     MOTOR DE MOVIMIENTO Y COLISIONES
     ======================================================= */

  useEffect(() => {
    const container =
      containerRef.current;

    if (
      !container ||
      slots.length === 0
    ) {
      return undefined;
    }

    let animationFrame;
    let previousTime = performance.now();

    function getBounds() {
      return {
        width: container.clientWidth,
        height: container.clientHeight,
      };
    }

    function getSideBoundary(width) {
      /*
       * Espacio reservado para
       * las guardas florales.
       */
      return Math.max(
        80,
        width * 0.065
      );
    }

    function findFreePosition(
      cardIndex,
      width,
      height
    ) {
      const bounds = getBounds();

      const sideSafeZone =
        getSideBoundary(bounds.width);

      /*
       * Reserva superior para Lara XV.
       */
      const safeTop = Math.max(
        135,
        bounds.height * 0.19
      );

      /*
       * Reserva inferior para QR y AlTeX.
       */
      const safeBottom =
        bounds.height -
        Math.max(
          110,
          bounds.height * 0.13
        );

      for (
        let attempt = 0;
        attempt < 100;
        attempt += 1
      ) {
        const x = randomBetween(
          sideSafeZone,
          Math.max(
            sideSafeZone + 10,
            bounds.width -
              width -
              sideSafeZone
          )
        );

        const y = randomBetween(
          safeTop,
          Math.max(
            safeTop + 10,
            safeBottom - height
          )
        );

        const centerX =
          x + width / 2;

        const centerY =
          y + height / 2;

        /*
         * Evitamos saturar el núcleo
         * del recuerdo protagonista.
         */
        const inHeroCore =
          centerX >
            bounds.width * 0.34 &&
          centerX <
            bounds.width * 0.66 &&
          centerY >
            bounds.height * 0.29 &&
          centerY <
            bounds.height * 0.74;

        if (
          inHeroCore &&
          attempt < 65
        ) {
          continue;
        }

        let collision = false;

        for (
          let i = 0;
          i <
          cardsRef.current.length;
          i += 1
        ) {
          if (i === cardIndex) continue;

          const other =
            cardsRef.current[i];

          if (!other) continue;

          const padding = 16;

          const overlaps =
            x <
              other.x +
                other.width +
                padding &&
            x +
                width +
                padding >
              other.x &&
            y <
              other.y +
                other.height +
                padding &&
            y +
                height +
                padding >
              other.y;

          if (overlaps) {
            collision = true;
            break;
          }
        }

        if (!collision) {
          return { x, y };
        }
      }

      /*
       * Fallback.
       */
      return {
        x: randomBetween(
          sideSafeZone,
          Math.max(
            sideSafeZone + 5,
            bounds.width -
              width -
              sideSafeZone
          )
        ),

        y: randomBetween(
          safeTop,
          Math.max(
            safeTop + 5,
            safeBottom - height
          )
        ),
      };
    }

    /* =====================================================
       INICIALIZAR FÍSICA
       ===================================================== */

    slots.forEach((_, index) => {
      const element =
        elementRefs.current[index];

      if (!element) return;

      const rect =
        element.getBoundingClientRect();

      const width =
        rect.width || 150;

      const height =
        rect.height || 180;

      if (!cardsRef.current[index]) {
        const position =
          findFreePosition(
            index,
            width,
            height
          );

        const angle =
          randomBetween(
            0,
            Math.PI * 2
          );

        const speed =
          randomBetween(10, 18);

        cardsRef.current[index] = {
          x: position.x,
          y: position.y,

          width,
          height,

          vx:
            Math.cos(angle) * speed,

          vy:
            Math.sin(angle) * speed,

          rotation:
            randomBetween(-4, 4),

          rotationSpeed:
            randomBetween(-0.22, 0.22),

          reposition: false,
        };
      }
    });

    function animate(now) {
      const dt = Math.min(
        (now - previousTime) / 1000,
        0.04
      );

      previousTime = now;

      const bounds = getBounds();

      const sideBoundary =
        getSideBoundary(bounds.width);

      const topBoundary =
        Math.max(
          130,
          bounds.height * 0.18
        );

      const bottomBoundary =
        bounds.height -
        Math.max(
          100,
          bounds.height * 0.12
        );

      /* ===================================================
         MOVIMIENTO
         =================================================== */

      cardsRef.current.forEach(
        (card, index) => {
          if (!card) return;

          const element =
            elementRefs.current[index];

          if (!element) return;

          if (card.reposition) {
            const position =
              findFreePosition(
                index,
                card.width,
                card.height
              );

            card.x = position.x;
            card.y = position.y;

            const angle =
              randomBetween(
                0,
                Math.PI * 2
              );

            const speed =
              randomBetween(10, 18);

            card.vx =
              Math.cos(angle) * speed;

            card.vy =
              Math.sin(angle) * speed;

            card.rotation =
              randomBetween(-4, 4);

            card.reposition = false;
          }

          card.x += card.vx * dt;
          card.y += card.vy * dt;

          card.rotation +=
            card.rotationSpeed * dt;

          /*
           * Rebote lateral respetando
           * las flores.
           */
          if (
            card.x <= sideBoundary
          ) {
            card.x = sideBoundary;

            card.vx =
              Math.abs(card.vx);
          }

          if (
            card.x +
              card.width >=
            bounds.width -
              sideBoundary
          ) {
            card.x =
              bounds.width -
              sideBoundary -
              card.width;

            card.vx =
              -Math.abs(card.vx);
          }

          /*
           * Lara XV queda protegido.
           */
          if (
            card.y <= topBoundary
          ) {
            card.y = topBoundary;

            card.vy =
              Math.abs(card.vy);
          }

          if (
            card.y +
              card.height >=
            bottomBoundary
          ) {
            card.y =
              bottomBoundary -
              card.height;

            card.vy =
              -Math.abs(card.vy);
          }
        }
      );

      /* ===================================================
         COLISIONES
         =================================================== */

      for (
        let i = 0;
        i <
        cardsRef.current.length;
        i += 1
      ) {
        const a =
          cardsRef.current[i];

        if (!a) continue;

        for (
          let j = i + 1;
          j <
          cardsRef.current.length;
          j += 1
        ) {
          const b =
            cardsRef.current[j];

          if (!b) continue;

          const padding = 10;

          const overlapX =
            Math.min(
              a.x + a.width,
              b.x + b.width
            ) -
            Math.max(a.x, b.x);

          const overlapY =
            Math.min(
              a.y + a.height,
              b.y + b.height
            ) -
            Math.max(a.y, b.y);

          if (
            overlapX > -padding &&
            overlapY > -padding
          ) {
            const centerAX =
              a.x + a.width / 2;

            const centerAY =
              a.y + a.height / 2;

            const centerBX =
              b.x + b.width / 2;

            const centerBY =
              b.y + b.height / 2;

            const dx =
              centerBX - centerAX;

            const dy =
              centerBY - centerAY;

            if (
              overlapX < overlapY
            ) {
              const push =
                Math.max(
                  overlapX + padding,
                  2
                ) / 2;

              if (dx >= 0) {
                a.x -= push;
                b.x += push;
              } else {
                a.x += push;
                b.x -= push;
              }

              const temp = a.vx;

              a.vx =
                -Math.sign(dx || 1) *
                Math.abs(b.vx);

              b.vx =
                Math.sign(dx || 1) *
                Math.abs(temp);
            } else {
              const push =
                Math.max(
                  overlapY + padding,
                  2
                ) / 2;

              if (dy >= 0) {
                a.y -= push;
                b.y += push;
              } else {
                a.y += push;
                b.y -= push;
              }

              const temp = a.vy;

              a.vy =
                -Math.sign(dy || 1) *
                Math.abs(b.vy);

              b.vy =
                Math.sign(dy || 1) *
                Math.abs(temp);
            }
          }
        }
      }

      /*
       * Aplicamos posiciones sin
       * provocar renders React.
       */
      cardsRef.current.forEach(
        (card, index) => {
          if (!card) return;

          const element =
            elementRefs.current[index];

          if (!element) return;

          element.style.transform =
            `translate3d(${card.x}px, ${card.y}px, 0) rotate(${card.rotation}deg)`;
        }
      );

      animationFrame =
        requestAnimationFrame(animate);
    }

    animationFrame =
      requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(
        animationFrame
      );
    };
  }, [slots.length]);

  if (
    images.length === 0 ||
    slots.length === 0
  ) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="floating-layer"
    >
      {slots.map(
        (slot, index) => {
          const post = images.find(
            (item) =>
              item.id === slot.postId
          );

          if (!post) return null;

          const url =
            mediaUrls[post.id];

          if (!url) return null;

          return (
            <FloatingMemory
              key={slot.slotId}
              refCallback={(element) => {
                elementRefs.current[
                  index
                ] = element;
              }}
              post={post}
              url={url}
              version={slot.version}
              index={index}
              fading={Boolean(
                fadingSlots[index]
              )}
            />
          );
        }
      )}
    </div>
  );
}

/* =========================================================
   FOTO FLOTANTE
   ========================================================= */

function FloatingMemory({
  refCallback,
  post,
  url,
  version,
  index,
  fading,
}) {
  return (
    <article
      ref={refCallback}
      className={`floating-memory floating-size-${
        index % 5
      } ${
        fading
          ? 'floating-fading'
          : ''
      }`}
    >
      <div className="floating-corner corner-a">
        ❦
      </div>

      <div className="floating-corner corner-b">
        ❦
      </div>

      <div
        key={`${post.id}-${version}`}
        className="floating-photo-transition"
      >
        <img
          src={url}
          alt=""
          draggable="false"
        />
      </div>
    </article>
  );
}

/* =========================================================
   MARCO PRINCIPAL
   ========================================================= */

function ElegantMediaFrame({
  post,
  mediaUrl,
}) {
  return (
    <div
      className={`hero-frame ${
        isVideo(post)
          ? 'video-frame'
          : ''
      }`}
    >
      <div className="frame-border-inner" />

      <div className="ornament ornament-tl">
        ❦
      </div>

      <div className="ornament ornament-tr">
        ❦
      </div>

      <div className="ornament ornament-bl">
        ❦
      </div>

      <div className="ornament ornament-br">
        ❦
      </div>

      <div className="frame-butterfly butterfly-tl">
        <Butterfly />
      </div>

      <div className="frame-butterfly butterfly-br">
        <Butterfly />
      </div>

      <div className="hero-frame-inner">
        {isVideo(post) ? (
          <video
            key={`${post.id}-${mediaUrl}`}
            src={mediaUrl}
            autoPlay
            muted
            loop
            playsInline
            controls={false}
            preload="auto"
            className="hero-media"
          />
        ) : (
          <img
            src={mediaUrl}
            alt={`Recuerdo de ${
              post.author_name ||
              'invitado'
            }`}
            className="hero-media"
          />
        )}
      </div>
    </div>
  );
}

/* =========================================================
   MENSAJE
   ========================================================= */

function HeroMessage({ post }) {
  if (
    !post.message &&
    !post.author_name
  ) {
    return null;
  }

  return (
    <div className="hero-message">
      <div className="message-inner-border" />

      <div className="message-flourish">
        <span />
        <i>❦</i>
        <span />
      </div>

      {post.message && (
        <p>
          “{post.message}”
        </p>
      )}

      <div className="message-author">
        <span>♡</span>

        {post.author_name ||
          'Invitado'}

        <span>♡</span>
      </div>

      <div className="message-butterfly">
        <Butterfly />
      </div>
    </div>
  );
}

/* =========================================================
   RECUERDO DE TEXTO
   ========================================================= */

function TextMemory({ post }) {
  return (
    <div className="text-memory">
      <div className="text-frame-border" />

      <div className="text-corner tc1">
        ❦
      </div>

      <div className="text-corner tc2">
        ❦
      </div>

      <div className="text-corner tc3">
        ❦
      </div>

      <div className="text-corner tc4">
        ❦
      </div>

      <div className="text-butterfly-left">
        <Butterfly />
      </div>

      <div className="text-butterfly-right">
        <Butterfly />
      </div>

      

      <p>
        {post.message ||
          'Un recuerdo para un día inolvidable.'}
      </p>

      <div className="text-author">
        <span />

        {post.author_name ||
          'Invitado'}

        <span />
      </div>
    </div>
  );
}

/* =========================================================
   LARA XV
   ========================================================= */

function RoyalTitle({
  compact = false,
}) {
  return (
    <div
      className={
        compact
          ? 'royal-title compact'
          : 'royal-title'
      }
    >
      <div className="royal-line">
        <div className="royal-crown">
          <span className="crown-star">
            ✦
          </span>

          <span className="crown-main">
            ♛
          </span>

          <span className="crown-star">
            ✦
          </span>
        </div>

        <span className="royal-name">
          Lara
        </span>

        <span className="royal-xv">
          XV
        </span>
      </div>

      <div className="royal-ornament">
        <i />
        <b>❀🦋❀</b>
        <i />
      </div>
    </div>
  );
}

/* =========================================================
   GUARDAS FLORALES
   ========================================================= */

function FloralBorders() {
  return (
    <div
      className="floral-borders"
      aria-hidden="true"
    >
      <FloralSide side="left" />
      <FloralSide side="right" />
    </div>
  );
}

function FloralSide({ side }) {
  return (
    <div
      className={`floral-side floral-${side}`}
    >
      <div className="floral-vine" />

      <Flower
        className="flower-1"
        tone="rose"
      />

      <Flower
        className="flower-2 small"
        tone="champagne"
      />

      <Flower
        className="flower-3"
        tone="lavender"
      />

      <Flower
        className="flower-4 tiny"
        tone="blush"
      />

      <Flower
        className="flower-5 mini"
        tone="champagne"
      />

      <span className="leaf leaf-1">
        ❧
      </span>

      <span className="leaf leaf-2">
        ❧
      </span>

      <span className="leaf leaf-3">
        ❧
      </span>

      <span className="leaf leaf-4">
        ❧
      </span>

      <span className="leaf leaf-5">
        ❧
      </span>

      <div className="border-butterfly bf-1 colorful-one">
        <Butterfly />
      </div>

      <div className="border-butterfly bf-2 colorful-two">
        <Butterfly />
      </div>

      <div className="border-butterfly bf-3 colorful-three">
        <Butterfly />
      </div>
    </div>
  );
}

function Flower({
  className,
  tone,
}) {
  return (
    <div
      className={`flower ${className} flower-${tone}`}
    >
      <span className="petal p1" />
      <span className="petal p2" />
      <span className="petal p3" />
      <span className="petal p4" />
      <span className="petal p5" />
      <i />
    </div>
  );
}

/* =========================================================
   QR
   ========================================================= */

function GuestQr() {
  return (
    <aside className="guest-qr">
      <div className="qr-card">
        <QRCodeSVG
          value={GUEST_URL}
          size={180}
          bgColor="#fffaf2"
          fgColor="#2a181f"
          level="H"
          imageSettings={{
            src: '/icon.svg',
            width: 42,
            height: 42,
            excavate: true,
          }}
        />
      </div>

      <div className="qr-label">
        Escaneá y subí tu recuerdo
      </div>
    </aside>
  );
}

/* =========================================================
   ALTEX
   ========================================================= */

function AltexCredit({
  logo,
  onLogoError,
}) {
  return (
    <aside className="altex-credit">
      <span>
        Desarrollado por
      </span>

      <img
        src={logo}
        alt="AlTeX"
        onError={onLogoError}
      />
    </aside>
  );
}

/* =========================================================
   MARIPOSAS AMBIENTALES
   ========================================================= */

function Butterflies() {
  const butterflies = [
    ['9%', '25%', 22, 21, -4],
    ['89%', '23%', 21, 25, -12],
    ['13%', '70%', 18, 22, -8],
    ['86%', '68%', 24, 28, -16],
    ['20%', '44%', 15, 24, -3],
    ['78%', '18%', 17, 20, -7],
  ];

  return (
    <div className="butterfly-layer">
      {butterflies.map(
        (
          [
            left,
            top,
            size,
            duration,
            delay,
          ],
          index
        ) => (
          <div
            key={index}
            className="flying-butterfly"
            style={{
              left,
              top,
              width: size,
              height: size * 0.72,
              animationDuration:
                `${duration}s`,
              animationDelay:
                `${delay}s`,
            }}
          >
            <Butterfly />
          </div>
        )
      )}
    </div>
  );
}

function Butterfly() {
  return (
    <span className="butterfly">
      <i className="wing wing-left" />
      <i className="wing wing-right" />
      <i className="body" />
    </span>
  );
}

/* =========================================================
   FONDO
   ========================================================= */

function Background() {
  return (
    <>
      <div className="background" />

      <div className="light light-one" />
      <div className="light light-two" />
      <div className="light light-three" />

      <div className="sparkles">
        <i className="spark s1">✦</i>
        <i className="spark s2">✧</i>
        <i className="spark s3">✦</i>
        <i className="spark s4">·</i>
        <i className="spark s5">✧</i>
        <i className="spark s6">✦</i>
        <i className="spark s7">✦</i>
        <i className="spark s8">·</i>
      </div>

      <div className="vignette" />
    </>
  );
}

function LargeOrnament() {
  return (
    <div className="large-ornament">
      <span />
      <i>❦</i>
      <span />
    </div>
  );
}

/* =========================================================
   ESTILOS
   ========================================================= */



export default Display;