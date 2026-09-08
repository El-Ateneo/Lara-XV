import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { QRCodeSVG } from 'qrcode.react';
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

/* =========================================================
   DISPLAY
   ========================================================= */

function Display() {
  const [posts, setPosts] = useState([]);
  const [mediaUrls, setMediaUrls] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [transitionKey, setTransitionKey] = useState(0);
  const [altexLogo, setAltexLogo] = useState(ALTEX_LOGO);

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

  /* =======================================================
     REALTIME
     ======================================================= */

  useEffect(() => {
    loadPosts();

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* =======================================================
     ROTACIÓN CENTRAL
     ======================================================= */

  useEffect(() => {
    if (posts.length <= 1) {
      setCurrentIndex(0);
      return undefined;
    }

    const currentPost = posts[currentIndex];

    if (!currentPost) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setCurrentIndex(
        (current) =>
          (current + 1) % posts.length
      );

      setTransitionKey(
        (value) => value + 1
      );
    }, getDuration(currentPost));

    return () => clearTimeout(timer);
  }, [posts, currentIndex]);

  useEffect(() => {
    if (
      posts.length > 0 &&
      currentIndex >= posts.length
    ) {
      setCurrentIndex(0);
    }
  }, [posts.length, currentIndex]);

  const currentPost = posts[currentIndex];

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
        <DisplayStyles />

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
     SIN RECUERDOS
     ======================================================= */

  if (posts.length === 0) {
    return (
      <>
        <DisplayStyles />

        <main className="display">
          <Background />
          <FloralBorders />

          <div className="empty">
            <RoyalTitle />

            <LargeOrnament />

            <h2>
              Una noche para recordar
            </h2>

            <p>
              Tus recuerdos aparecerán acá.
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
      <DisplayStyles />

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
          'Un recuerdo para una noche inolvidable.'}
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
          size={108}
          bgColor="#fffaf2"
          fgColor="#2a181f"
          level="H"
          imageSettings={{
            src: LARA_AVATAR,
            width: 29,
            height: 29,
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

function DisplayStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Great+Vibes&display=swap');

      * {
        box-sizing: border-box;
      }

      html,
      body,
      #root {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #090609;
      }

      .display {
        --gold: #d7ae5c;
        --gold-bright: #f2cf7d;
        --champagne: #e9d39e;
        --champagne-light: #f7e8bd;
        --champagne-dark: #b68b3f;
        --rose: #d992aa;
        --wine: #5b2337;
        --wine-dark: #32121f;
        --cream: #fff8e8;

        position: relative;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        isolation: isolate;

        color: var(--cream);
        background: #090609;

        font-family:
          'Cormorant Garamond',
          Georgia,
          serif;

        user-select: none;
      }

      /* ===================================================
         FONDO
         =================================================== */

      .background {
        position: absolute;
        inset: -3%;
        z-index: -20;

        background:
          radial-gradient(
            circle at 50% 43%,
            rgba(125, 52, 79, .36),
            transparent 42%
          ),
          radial-gradient(
            circle at 9% 8%,
            rgba(220, 143, 169, .16),
            transparent 30%
          ),
          radial-gradient(
            circle at 91% 85%,
            rgba(216, 175, 93, .14),
            transparent 31%
          ),
          linear-gradient(
            135deg,
            #080507 0%,
            #190a11 38%,
            #11070d 70%,
            #060406 100%
          );

        animation:
          backgroundMove
          15s ease-in-out
          infinite alternate;
      }

      .light {
        position: absolute;
        z-index: -18;
        border-radius: 50%;
        filter: blur(95px);
        pointer-events: none;
      }

      .light-one {
        width: 34vw;
        height: 34vw;
        left: -14vw;
        top: -15vw;

        background:
          rgba(222,147,172,.19);

        animation:
          lightOne 21s
          ease-in-out infinite alternate;
      }

      .light-two {
        width: 32vw;
        height: 32vw;
        right: -14vw;
        bottom: -14vw;

        background:
          rgba(208,167,100,.15);

        animation:
          lightTwo 25s
          ease-in-out infinite alternate;
      }

      .light-three {
        width: 25vw;
        height: 25vw;
        left: 38%;
        top: 34%;

        background:
          rgba(150,65,97,.13);

        animation:
          lightThree 19s
          ease-in-out infinite alternate;
      }

      .vignette {
        position: absolute;
        inset: 0;
        z-index: 90;
        pointer-events: none;

        box-shadow:
          inset 0 0 125px
          rgba(0,0,0,.66),
          inset 0 0 35px
          rgba(0,0,0,.23);
      }

      /* ===================================================
         LARA XV
         =================================================== */

      .top-brand {
        position: absolute;
        z-index: 75;
        left: 50%;
        top: 28px;

        transform:
          translateX(-50%);

        pointer-events: none;
      }

      .royal-title {
        display: flex;
        flex-direction: column;
        align-items: center;
        white-space: nowrap;

        filter:
          drop-shadow(
            0 7px 18px
            rgba(0,0,0,.7)
          );
      }

      .royal-line {
        display: flex;
        align-items: center;
        justify-content: center;

        gap:
          clamp(10px, 1vw, 18px);
      }

      .royal-crown {
        display: flex;
        align-items: center;
        gap: 4px;

        color:
          var(--gold-bright);
      }

      .crown-main {
        display: block;

        font-family:
          Georgia,
          serif;

        font-size:
          clamp(35px, 3vw, 55px);

        line-height: 1;

        text-shadow:
          0 0 17px
          rgba(242,207,125,.3);

        animation:
          crownGlow
          3.5s ease-in-out
          infinite;
      }

      .crown-star {
        color:
          rgba(242,207,125,.6);

        font-size: 7px;
      }

      .royal-name {
        color: #fff9f0;

        font-family:
          'Great Vibes',
          cursive;

        font-size:
          clamp(76px, 7vw, 126px);

        line-height: .9;
        font-weight: 400;

        text-shadow:
          0 7px 24px
          rgba(0,0,0,.65),
          0 0 18px
          rgba(217,146,170,.12);
      }

      .royal-xv {
        color:
          var(--gold-bright);

        font-family:
          'Cormorant Garamond',
          Georgia,
          serif;

        font-size:
          clamp(35px, 3vw, 55px);

        line-height: 1;
        font-weight: 600;
        letter-spacing: .12em;

        text-shadow:
          0 5px 17px
          rgba(0,0,0,.65);
      }

      .royal-ornament {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;

        margin-top: 4px;

        color:
          rgba(242,207,125,.76);
      }

      .royal-ornament i {
        width:
          clamp(45px, 4vw, 75px);

        height: 1px;

        background:
          linear-gradient(
            90deg,
            transparent,
            rgba(242,207,125,.72)
          );
      }

      .royal-ornament i:last-child {
        transform: scaleX(-1);
      }

      .royal-ornament b {
        font-size: 11px;
        font-weight: 400;
      }

      .compact .royal-name {
        font-size:
          clamp(72px, 6.3vw, 115px);
      }

      .compact .crown-main,
      .compact .royal-xv {
        font-size:
          clamp(31px, 2.5vw, 48px);
      }

      /* ===================================================
         GUARDAS FLORALES
         =================================================== */

      .floral-borders {
        position: absolute;
        inset: 0;

        z-index: 12;

        pointer-events: none;
        overflow: hidden;
      }

      .floral-side {
        position: absolute;

        top: 13%;
        bottom: 12%;

        width:
          clamp(62px, 5.8vw, 105px);

        opacity: .93;
      }

      .floral-left {
        left: 0;
      }

      .floral-right {
        right: 0;
        transform: scaleX(-1);
      }

      .floral-vine {
        position: absolute;

        left: 23%;
        top: 1%;

        width: 42px;
        height: 98%;

        border-left:
          1px solid
          rgba(216,178,99,.52);

        border-radius: 50%;

        transform:
          rotate(-2deg);
      }

      .floral-vine::before,
      .floral-vine::after {
        content: "";

        position: absolute;

        width: 26px;
        height: 42%;

        border-left:
          1px solid
          rgba(219,181,101,.28);

        border-radius: 50%;
      }

      .floral-vine::before {
        left: 6px;
        top: 6%;

        transform:
          rotate(8deg);
      }

      .floral-vine::after {
        left: -6px;
        bottom: 7%;

        transform:
          rotate(-8deg);
      }

      /* Flores */

      .flower {
        position: absolute;

        width: 36px;
        height: 36px;

        animation:
          flowerBreath
          5s ease-in-out
          infinite alternate;

        filter:
          drop-shadow(
            0 4px 7px
            rgba(0,0,0,.32)
          );
      }

      .flower-1 {
        top: 5%;
        left: 15px;
      }

      .flower-2 {
        top: 27%;
        left: 36px;
        animation-delay: -2s;
      }

      .flower-3 {
        top: 50%;
        left: 12px;
        animation-delay: -3.2s;
      }

      .flower-4 {
        top: 72%;
        left: 36px;
        animation-delay: -1.2s;
      }

      .flower-5 {
        top: 91%;
        left: 17px;
        animation-delay: -3.8s;
      }

      .flower.small {
        transform: scale(.8);
      }

      .flower.tiny {
        transform: scale(.66);
      }

      .flower.mini {
        transform: scale(.56);
      }

      .petal {
        position: absolute;

        left: 11px;
        top: 3px;

        width: 14px;
        height: 18px;

        border-radius:
          70% 70% 60% 60%;

        transform-origin:
          7px 15px;

        border:
          1px solid
          rgba(248,218,173,.48);

        box-shadow:
          inset 0 0 5px
          rgba(255,255,255,.23);
      }

      .flower-rose .petal {
        background:
          linear-gradient(
            160deg,
            #f8d9e1,
            #cf829e
          );
      }

      .flower-champagne .petal {
        background:
          linear-gradient(
            160deg,
            #f8e8c3,
            #d1a252
          );
      }

      .flower-lavender .petal {
        background:
          linear-gradient(
            160deg,
            #ead4e8,
            #a96d9c
          );
      }

      .flower-blush .petal {
        background:
          linear-gradient(
            160deg,
            #fff0df,
            #d58c9c
          );
      }

      .petal.p1 {
        transform: rotate(0deg);
      }

      .petal.p2 {
        transform: rotate(72deg);
      }

      .petal.p3 {
        transform: rotate(144deg);
      }

      .petal.p4 {
        transform: rotate(216deg);
      }

      .petal.p5 {
        transform: rotate(288deg);
      }

      .flower i {
        position: absolute;

        z-index: 3;

        left: 14px;
        top: 14px;

        width: 8px;
        height: 8px;

        border-radius: 50%;

        background:
          #efc46b;

        box-shadow:
          0 0 8px
          rgba(240,198,111,.62);
      }

      /* Hojas */

      .leaf {
        position: absolute;

        color:
          rgba(192,158,92,.72);

        font-family:
          Georgia,
          serif;

        font-size: 31px;

        text-shadow:
          0 2px 8px
          rgba(0,0,0,.45);
      }

      .leaf-1 {
        top: 15%;
        left: 17px;
        transform: rotate(-27deg);
      }

      .leaf-2 {
        top: 38%;
        left: 36px;
        transform: rotate(23deg);
      }

      .leaf-3 {
        top: 61%;
        left: 15px;
        transform: rotate(-18deg);
      }

      .leaf-4 {
        top: 81%;
        left: 36px;
        transform: rotate(25deg);
      }

      .leaf-5 {
        top: 95%;
        left: 22px;
        transform: rotate(-18deg);
      }

      /* Mariposas de colores */

      .border-butterfly {
        position: absolute;

        z-index: 5;

        width: 28px;
        height: 21px;

        filter:
          drop-shadow(
            0 3px 5px
            rgba(0,0,0,.5)
          );
      }

      .colorful-one .wing-left {
        background:
          linear-gradient(
            145deg,
            #ffd8e4,
            #e985a8
          );
      }

      .colorful-one .wing-right {
        background:
          linear-gradient(
            145deg,
            #f8e29d,
            #d59b4a
          );
      }

      .colorful-two .wing-left {
        background:
          linear-gradient(
            145deg,
            #d8c9ff,
            #9477d4
          );
      }

      .colorful-two .wing-right {
        background:
          linear-gradient(
            145deg,
            #f9c5d9,
            #c86691
          );
      }

      .colorful-three .wing-left {
        background:
          linear-gradient(
            145deg,
            #bde5e0,
            #5da6a2
          );
      }

      .colorful-three .wing-right {
        background:
          linear-gradient(
            145deg,
            #ffe4ad,
            #d6a354
          );
      }

      .bf-1 {
        top: 18%;
        left: 48px;

        animation:
          floralButterflyOne
          7s ease-in-out
          infinite;
      }

      .bf-2 {
        top: 49%;
        left: 7px;

        animation:
          floralButterflyTwo
          9s ease-in-out
          infinite;

        animation-delay: -4s;
      }

      .bf-3 {
        top: 78%;
        left: 45px;

        animation:
          floralButterflyThree
          8s ease-in-out
          infinite;

        animation-delay: -2s;
      }

      /* ===================================================
         HERO
         =================================================== */

      .hero {
        position: absolute;

        z-index: 45;

        left: 50%;
        top: 56%;

        width:
          min(52vw, 940px);

        height:
          min(68vh, 720px);

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        transform:
          translate(-50%, -50%);

        animation:
          heroEntrance
          1.05s
          cubic-bezier(.18,.86,.22,1)
          both;
      }

      .hero-halo {
        position: absolute;

        z-index: -1;

        width: 82%;
        height: 73%;

        border-radius: 50%;

        background:
          radial-gradient(
            ellipse,
            rgba(218,144,169,.27),
            rgba(205,166,91,.07) 48%,
            transparent 73%
          );

        filter: blur(38px);

        animation:
          haloPulse
          5s ease-in-out
          infinite alternate;
      }

      /* ===================================================
         MARCO PRINCIPAL
         =================================================== */

      .hero-frame {
        position: relative;

        /*height:
          min(42vh, 470px);

        max-width:
          min(44vw, 780px);*/

        width: fit-content;
        height: fit-content;

        max-width:
          min(44vw, 780px);

        max-height:
          min(42vh, 470px);

        padding:
          clamp(12px, 1vw, 17px);

        border:
          2px solid
          rgba(242,207,125,.88);

        border-radius: 10px;

        background:
          linear-gradient(
            145deg,
            rgba(212,174,91,.88),
            rgba(153,108,45,.78)
          );

        box-shadow:
          0 38px 100px
          rgba(0,0,0,.68),
          0 0 22px
          rgba(231,190,102,.12),
          inset 0 0 30px
          rgba(255,240,198,.15);
      }

      .frame-border-inner {
        position: absolute;
        inset: 6px;

        z-index: 5;

        border:
          1px solid
          rgba(255,242,205,.63);

        border-radius: 7px;

        pointer-events: none;
      }

      .hero-frame-inner {
        position: relative;

        z-index: 2;

        width: auto;
        height: auto;

        max-width: 100%;
        max-height: 100%;

        overflow: hidden;

        border-radius: 4px;

        background:
          rgba(14,7,10,.98);
      }

      .hero-media {
        display: block;

        width: auto;
        height: auto;

        max-width:
          min(42vw, 750px);

        max-height:
          min(39vh, 440px);

        object-fit: contain;

        background: transparent;
      }

      img.hero-media {
        width: auto;
        height: auto;

        max-width:
          min(42vw, 750px);

        max-height:
          min(39vh, 440px);

        object-fit: contain;
      }

      .video-frame {
        width: fit-content;
        height: fit-content;

        max-width:
          min(46vw, 820px);

        max-height:
          min(42vh, 470px);
      }

      .ornament {
        position: absolute;

        z-index: 9;

        color:
          #f5d987;

        font-size:
          clamp(32px, 2.8vw, 49px);

        text-shadow:
          0 2px 8px
          rgba(0,0,0,.6);
      }

      .ornament-tl {
        top: -21px;
        left: -19px;
        transform: rotate(-42deg);
      }

      .ornament-tr {
        top: -21px;
        right: -19px;
        transform:
          rotate(42deg)
          scaleX(-1);
      }

      .ornament-bl {
        bottom: -21px;
        left: -19px;
        transform: rotate(-135deg);
      }

      .ornament-br {
        right: -19px;
        bottom: -21px;
        transform:
          rotate(135deg)
          scaleX(-1);
      }

      .frame-butterfly {
        position: absolute;

        z-index: 10;

        width: 32px;
        height: 23px;
      }

      .butterfly-tl {
        left: -22px;
        top: 14%;
        transform: rotate(-18deg);
      }

      .butterfly-br {
        right: -21px;
        bottom: 19%;
        transform: rotate(17deg);
      }

      /* ===================================================
         MENSAJES
         =================================================== */

      .hero-message {
        position: relative;

        width:
          min(62%, 500px);

        margin-top: 9px;

        padding:
          10px 24px 9px;

        color:
          #fff6df;

        text-align: center;

        border:
          1px solid
          rgba(241,203,117,.92);

        border-radius: 10px;

        background:
          linear-gradient(
            145deg,
            rgba(91,35,55,.98),
            rgba(48,17,30,.98)
          );

        box-shadow:
          0 18px 45px
          rgba(0,0,0,.52),
          0 0 18px
          rgba(215,174,92,.08),
          inset 0 1px
          rgba(255,233,183,.11);

        animation:
          messageAppear
          .75s .3s ease both;
      }

      .message-inner-border {
        position: absolute;
        inset: 6px;

        border:
          1px solid
          rgba(241,203,117,.27);

        border-radius: 6px;

        pointer-events: none;
      }

      .hero-message p {
        position: relative;
        z-index: 3;

        margin: 6px 0 7px;

        color: #fff8e9;

        font-size:
          clamp(14px, 1.05vw, 19px);

        line-height: 1.2;

        font-weight: 500;
        font-style: italic;

        text-shadow:
          0 2px 5px
          rgba(0,0,0,.55);
      }

      .message-author {
        position: relative;
        z-index: 3;

        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;

        color: #f0cb7b;

        font-size:
          clamp(10px, .75vw, 13px);

        font-weight: 600;
      }

      .message-author span {
        color: #e5a4b8;
      }

      .message-flourish {
        position: relative;
        z-index: 3;

        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;

        color: #e6bd67;
      }

      .message-flourish span {
        width: 34px;
        height: 1px;

        background:
          linear-gradient(
            90deg,
            transparent,
            rgba(234,196,109,.75)
          );
      }

      .message-flourish span:last-child {
        transform: scaleX(-1);
      }

      .message-flourish i {
        font-size: 10px;
        font-style: normal;
      }

      .message-butterfly {
        position: absolute;
        z-index: 5;

        right: 15px;
        top: 10px;

        width: 24px;
        height: 18px;

        opacity: .8;
      }

      /* ===================================================
         SOLO TEXTO
         =================================================== */

      .text-memory {
        position: relative;

        width:
          min(38vw, 6500px);

        min-height:
          min(30vh, 330px);

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        padding:
          clamp(35px, 4vh, 52px)
          clamp(40px, 3.5vw, 65px);

        border:
          2px solid
          rgba(240,200,109,.88);

        border-radius: 11px;

        color: #fff7e5;
        text-align: center;

        background:
          linear-gradient(
            145deg,
            rgba(92,35,55,.97),
            rgba(47,16,29,.97)
          );

        box-shadow:
          0 40px 100px
          rgba(0,0,0,.64),
          inset 0 0 35px
          rgba(237,195,104,.07);

        animation:
          messageBubble
          1.05s
          cubic-bezier(.18,.89,.32,1.22)
          both;
      }

      .text-frame-border {
        position: absolute;
        inset: 8px;

        border:
          1px solid
          rgba(239,201,115,.31);

        border-radius: 7px;

        pointer-events: none;
      }

      .text-memory p {
        position: relative;
        z-index: 4;

        margin: 0;

        color: #fff8e9;

        font-size:
          clamp(20px, 1.8vw, 32px);

        line-height: 1.22;

        font-weight: 500;
        font-style: italic;

        text-shadow:
          0 3px 10px
          rgba(0,0,0,.45);
      }

      

      .text-author {
        position: relative;
        z-index: 4;

        display: flex;
        align-items: center;

        gap: 14px;
        margin-top: 20px;

        color: #efc873;

        font-size:
          clamp(141x, .9vw, 16px);

        font-weight: 600;
      }

      .text-author span {
        width: 34px;
        height: 1px;

        background:
          linear-gradient(
            90deg,
            transparent,
            rgba(238,198,108,.7)
          );
      }

      .text-author span:last-child {
        transform: scaleX(-1);
      }

      .text-corner {
        position: absolute;

        color: #edc469;

        font-size:
          clamp(32px, 3vw, 52px);
      }

      .tc1 {
        left: -16px;
        top: -18px;
        transform: rotate(-42deg);
      }

      .tc2 {
        right: -16px;
        top: -18px;
        transform:
          rotate(42deg)
          scaleX(-1);
      }

      .tc3 {
        left: -16px;
        bottom: -18px;
        transform: rotate(-135deg);
      }

      .tc4 {
        right: -16px;
        bottom: -18px;
        transform:
          rotate(135deg)
          scaleX(-1);
      }

      .text-butterfly-left,
      .text-butterfly-right {
        position: absolute;

        width: 36px;
        height: 27px;

        opacity: .8;
      }

      .text-butterfly-left {
        left: 5%;
        top: 10%;
      }

      .text-butterfly-right {
        right: 5%;
        bottom: 11%;
      }

      /* ===================================================
         FOTOS FLOTANTES
         =================================================== */

      .floating-layer {
        position: absolute;
        inset: 0;

        z-index: 15;

        overflow: hidden;
        pointer-events: none;
      }

      .floating-memory {
        position: absolute;

        left: 0;
        top: 0;

        width:
          clamp(125px, 10vw, 190px);

        height:
          clamp(145px, 17vh, 210px);

        padding: 7px;

        border:
          2px solid
          rgba(241,203,117,.84);

        border-radius: 9px;

        background:
          linear-gradient(
            145deg,
            rgba(221,183,96,.95),
            rgba(166,119,49,.93)
          );

        box-shadow:
          0 18px 46px
          rgba(0,0,0,.5),
          0 0 15px
          rgba(226,186,97,.09),
          inset 0 0 12px
          rgba(255,240,199,.14);

        opacity: .9;

        will-change:
          transform,
          opacity,
          filter;

        transition:
          opacity .85s ease,
          filter .85s ease;
      }

      /*
       * Salida suave.
       */
      .floating-memory.floating-fading {
        opacity: 0;

        filter:
          blur(3px)
          brightness(.85);
      }

      .floating-size-1,
      .floating-size-6 {
        width:
          clamp(115px, 9vw, 170px);

        height:
          clamp(140px, 16vh, 195px);
      }

      .floating-size-2,
      .floating-size-7 {
        width:
          clamp(135px, 11vw, 205px);

        height:
          clamp(150px, 18vh, 220px);
      }

      .floating-size-3,
      .floating-size-8 {
        width:
          clamp(120px, 9.5vw, 180px);

        height:
          clamp(145px, 17vh, 205px);
      }

      .floating-size-4,
      .floating-size-9 {
        width:
          clamp(130px, 10.5vw, 195px);

        height:
          clamp(145px, 17.5vh, 215px);
      }

      /*
       * Entrada suave de la nueva foto.
       */
      .floating-photo-transition {
        position: relative;

        width: 100%;
        height: 100%;

        overflow: hidden;

        border-radius: 4px;

        background: #160d11;

        animation:
          floatingPhotoIn
          1.15s
          cubic-bezier(.22,.75,.28,1)
          both;
      }

      .floating-photo-transition img {
        display: block;

        width: 100%;
        height: 100%;

        object-fit: cover;
      }

      .floating-memory::after {
        content: "";

        position: absolute;
        inset: 3px;

        z-index: 4;

        border:
          1px solid
          rgba(255,240,199,.42);

        border-radius: 6px;

        pointer-events: none;
      }

      .floating-corner {
        position: absolute;
        z-index: 8;

        color: #f4d27f;

        font-size: 19px;

        text-shadow:
          0 2px 5px
          rgba(0,0,0,.55);
      }

      .floating-corner.corner-a {
        left: -8px;
        top: -10px;
        transform: rotate(-45deg);
      }

      .floating-corner.corner-b {
        right: -8px;
        bottom: -10px;
        transform: rotate(135deg);
      }

      /* ===================================================
         QR
         =================================================== */

      .guest-qr {
        position: absolute;

        z-index: 80;

        left: 22px;
        bottom: 15px;

        display: flex;
        flex-direction: column;
        align-items: center;

        pointer-events: none;
      }

      .qr-card {
        display: flex;

        padding: 5px;

        border:
          1px solid
          rgba(230,207,160,.68);

        border-radius: 11px;

        background: #fffaf2;

        box-shadow:
          0 12px 34px
          rgba(0,0,0,.42);
      }

      .qr-card svg {
        display: block;

        width:
          clamp(78px, 6vw, 108px);

        height:
          clamp(78px, 6vw, 108px);
      }

      .qr-label {
        margin-top: 5px;

        color:
          rgba(249,231,191,.86);

        font-family:
          Arial,
          sans-serif;

        font-size:
          clamp(7px, .55vw, 10px);

        font-weight: 500;
        letter-spacing: .03em;

        white-space: nowrap;

        text-shadow:
          0 2px 7px
          rgba(0,0,0,.75);
      }

      /* ===================================================
         ALTEX
         =================================================== */

      .altex-credit {
        position: absolute;

        z-index: 80;

        right: 25px;
        bottom: 19px;

        display: flex;
        flex-direction: column;
        align-items: flex-end;

        gap: 5px;

        pointer-events: none;
      }

      .altex-credit span {
        color:
          rgba(255,255,255,.82);

        font-family:
          Arial,
          sans-serif;

        font-size:
          clamp(8px, .63vw, 11px);

        font-weight: 500;

        letter-spacing: .1em;
        text-transform: uppercase;

        text-shadow:
          0 2px 7px
          rgba(0,0,0,.7);
      }

      .altex-credit img {
        width:
          clamp(92px, 7.5vw, 135px);

        max-height: 60px;

        object-fit: contain;

        opacity: 1;

        filter:
          drop-shadow(
            0 6px 16px
            rgba(0,0,0,.6)
          );
      }

      /* ===================================================
         MARIPOSAS
         =================================================== */

      .butterfly-layer {
        position: absolute;
        inset: 0;

        z-index: 25;

        pointer-events: none;
      }

      .flying-butterfly {
        position: absolute;

        opacity: .55;

        animation:
          butterflyTravel
          ease-in-out
          infinite;
      }

      .butterfly {
        position: relative;

        display: inline-block;

        width: 100%;
        height: 100%;
      }

      .wing {
        position: absolute;

        top: 8%;

        width: 47%;
        height: 70%;

        background:
          linear-gradient(
            145deg,
            rgba(245,212,221,.96),
            rgba(182,98,129,.72)
          );

        border:
          1px solid
          rgba(242,220,171,.48);
      }

      .wing-left {
        right: 52%;

        border-radius:
          90% 22% 68% 27%;

        transform-origin:
          right center;

        animation:
          wingLeft
          .48s ease-in-out
          infinite alternate;
      }

      .wing-right {
        left: 52%;

        border-radius:
          22% 90% 27% 68%;

        transform-origin:
          left center;

        animation:
          wingRight
          .48s ease-in-out
          infinite alternate;
      }

      .body {
        position: absolute;

        left: 47%;
        top: 17%;

        width: 7%;
        height: 67%;

        border-radius: 999px;

        background:
          var(--gold-bright);
      }

      /* ===================================================
         LOADING / VACÍO
         =================================================== */

      .loading,
      .empty {
        position: relative;
        z-index: 30;

        width: 100%;
        height: 100%;

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        text-align: center;
      }

      .loading-butterfly {
        width: 42px;
        height: 31px;

        margin-bottom: 18px;
      }

      .loading p,
      .empty p {
        margin: 0;

        color:
          rgba(255,255,255,.58);

        font-size:
          clamp(12px, 1vw, 16px);

        font-style: italic;
      }

      .empty h2 {
        margin: 18px 0 5px;

        color: #fff7e8;

        font-size:
          clamp(20px, 1.8vw, 31px);

        font-weight: 400;
        font-style: italic;
      }

      .large-ornament {
        display: flex;
        align-items: center;

        gap: 10px;

        margin: 22px 0 0;

        color: var(--gold);
      }

      .large-ornament span {
        width: 55px;
        height: 1px;

        background:
          linear-gradient(
            90deg,
            transparent,
            rgba(215,179,108,.72)
          );
      }

      .large-ornament span:last-child {
        transform: scaleX(-1);
      }

      .large-ornament i {
        font-style: normal;
      }

      .loading-line {
        width: 95px;
        height: 1px;

        margin: 17px 0 9px;

        background:
          linear-gradient(
            90deg,
            transparent,
            var(--gold),
            transparent
          );
      }

      /* ===================================================
         DESTELLOS
         =================================================== */

      .sparkles {
        position: absolute;
        inset: 0;

        z-index: -4;

        pointer-events: none;
      }

      .spark {
        position: absolute;

        color:
          rgba(240,217,160,.38);

        font-style: normal;

        animation:
          sparkle
          4s ease-in-out
          infinite;
      }

      .s1 { left: 8%; top: 10%; }
      .s2 { left: 29%; top: 14%; animation-delay: -1s; }
      .s3 { left: 68%; top: 9%; animation-delay: -2.3s; }
      .s4 { right: 8%; top: 34%; animation-delay: -.8s; }
      .s5 { left: 5%; top: 51%; animation-delay: -1.7s; }
      .s6 { right: 5%; top: 61%; animation-delay: -2.7s; }
      .s7 { left: 21%; bottom: 10%; animation-delay: -3.1s; }
      .s8 { right: 28%; bottom: 8%; animation-delay: -.4s; }

      /* ===================================================
         ANIMACIONES
         =================================================== */

      @keyframes floatingPhotoIn {
        0% {
          opacity: 0;

          transform:
            scale(.94);

          filter:
            blur(3px);
        }

        45% {
          opacity: .72;

          filter:
            blur(1px);
        }

        100% {
          opacity: 1;

          transform:
            scale(1);

          filter:
            blur(0);
        }
      }

      @keyframes floralButterflyOne {
        0%,
        100% {
          transform:
            translate(0, 0)
            rotate(-12deg);
        }

        35% {
          transform:
            translate(17px, -29px)
            rotate(11deg);
        }

        70% {
          transform:
            translate(-4px, 20px)
            rotate(-5deg);
        }
      }

      @keyframes floralButterflyTwo {
        0%,
        100% {
          transform:
            translate(0, 0)
            rotate(8deg);
        }

        35% {
          transform:
            translate(24px, 18px)
            rotate(-12deg);
        }

        68% {
          transform:
            translate(11px, -31px)
            rotate(13deg);
        }
      }

      @keyframes floralButterflyThree {
        0%,
        100% {
          transform:
            translate(0, 0)
            rotate(-7deg);
        }

        40% {
          transform:
            translate(18px, -23px)
            rotate(14deg);
        }

        75% {
          transform:
            translate(-5px, 15px)
            rotate(-10deg);
        }
      }

      @keyframes flowerBreath {
        from {
          filter:
            brightness(.92)
            drop-shadow(
              0 4px 7px
              rgba(0,0,0,.32)
            );
        }

        to {
          filter:
            brightness(1.13)
            drop-shadow(
              0 5px 9px
              rgba(0,0,0,.4)
            );
        }
      }

      @keyframes heroEntrance {
        0% {
          opacity: 0;

          transform:
            translate(-50%, -50%)
            scale(.5);

          filter: blur(11px);
        }

        55% {
          opacity: 1;

          transform:
            translate(-50%, -50%)
            scale(1.035);

          filter: blur(0);
        }

        100% {
          opacity: 1;

          transform:
            translate(-50%, -50%)
            scale(1);
        }
      }

      @keyframes messageAppear {
        from {
          opacity: 0;

          transform:
            translateY(18px)
            scale(.95);
        }

        to {
          opacity: 1;

          transform:
            translateY(0)
            scale(1);
        }
      }

      @keyframes messageBubble {
        0% {
          opacity: 0;
          transform: scale(.25);
        }

        58% {
          opacity: 1;
          transform: scale(1.04);
        }

        100% {
          transform: scale(1);
        }
      }

      @keyframes butterflyTravel {
        0%,
        100% {
          transform:
            translate3d(0,0,0)
            rotate(-8deg);
        }

        25% {
          transform:
            translate3d(
              38px,
              -25px,
              0
            )
            rotate(7deg);
        }

        51% {
          transform:
            translate3d(
              10px,
              -60px,
              0
            )
            rotate(-3deg);
        }

        77% {
          transform:
            translate3d(
              -28px,
              -31px,
              0
            )
            rotate(9deg);
        }
      }

      @keyframes wingLeft {
        from {
          transform:
            rotateY(0deg)
            rotate(-18deg);
        }

        to {
          transform:
            rotateY(58deg)
            rotate(-6deg);
        }
      }

      @keyframes wingRight {
        from {
          transform:
            rotateY(0deg)
            rotate(18deg);
        }

        to {
          transform:
            rotateY(-58deg)
            rotate(6deg);
        }
      }

      @keyframes haloPulse {
        from {
          opacity: .58;
          transform: scale(.91);
        }

        to {
          opacity: 1;
          transform: scale(1.09);
        }
      }

      @keyframes crownGlow {
        0%,
        100% {
          opacity: .75;
          transform: translateY(0);
        }

        50% {
          opacity: 1;
          transform: translateY(-2px);
        }
      }

      @keyframes sparkle {
        0%,
        100% {
          opacity: .12;
          transform: scale(.7);
        }

        50% {
          opacity: .68;
          transform: scale(1.2);
        }
      }

      @keyframes backgroundMove {
        from {
          transform: scale(1);

          filter:
            saturate(.94)
            brightness(.94);
        }

        to {
          transform: scale(1.025);

          filter:
            saturate(1.07)
            brightness(1.04);
        }
      }

      @keyframes lightOne {
        to {
          transform:
            translate(8vw, 6vh);
        }
      }

      @keyframes lightTwo {
        to {
          transform:
            translate(-7vw, -5vh);
        }
      }

      @keyframes lightThree {
        from {
          transform:
            translate(-4vw, 2vh)
            scale(.8);
        }

        to {
          transform:
            translate(5vw, -4vh)
            scale(1.15);
        }
      }

      /* ===================================================
         PANTALLAS 4:3
         =================================================== */

      @media (
        max-aspect-ratio: 4 / 3
      ) {
        .hero {
          width: 67vw;
        }

        .hero-frame {
          max-width: 63vw;
          height: 51vh;
        }

        .video-frame {
          width: 63vw;
        }

        .hero-media {
          max-height: min(39vh, 440px);
        }

        .floating-memory {
          width:
            clamp(105px, 9vw, 155px);

          height:
            clamp(125px, 15vh, 180px);
        }

        .floral-side {
          width: 66px;
        }
      }

      /* ===================================================
         MOBILE
         =================================================== */

      @media (
        max-width: 800px
      ) {
        .top-brand {
          top: 8px;
        }

        .royal-line {
          gap: 7px;
        }

        .compact .royal-name {
          font-size: 61px;
        }

        .compact .crown-main,
        .compact .royal-xv {
          font-size: 25px;
        }

        .crown-star {
          display: none;
        }

        /*
         * En móvil las guardas quedan
         * mucho más finas.
         */
        .floral-side {
          width: 43px;
          opacity: .68;
        }

        .floral-vine {
          left: 12px;
        }

        .flower {
          transform: scale(.62);
        }

        .flower.small {
          transform: scale(.5);
        }

        .flower.tiny,
        .flower.mini {
          transform: scale(.43);
        }

        .flower-1,
        .flower-3,
        .flower-5 {
          left: 4px;
        }

        .flower-2,
        .flower-4 {
          left: 16px;
        }

        .leaf {
          font-size: 20px;
        }

        .border-butterfly {
          transform: scale(.72);
        }

        .hero {
          top: 51%;

          width: 82vw;
          height: 70vh;
        }

        .hero-frame,
        .video-frame {
          width: auto;

          max-width: 77vw;

          height: auto;

          max-height: 46vh;
        }

        .hero-media {
          max-width: 74vw;
          max-height: 43vh;
        }

        img.hero-media {
          min-width: 0;
          max-width: 74vw;
        }

        .hero-message {
          width: 94%;

          padding:
            15px 20px
            12px;
        }

        .text-memory {
          width: 78vw;

          min-height: 40vh;

          padding:
            45px 35px;
        }

        .floating-memory {
          width: 86px !important;
          height: 112px !important;

          padding: 4px;

          opacity: .82;
        }

        .guest-qr {
          left: 9px;
          bottom: 8px;
        }

        .qr-card svg {
          width: 64px;
          height: 64px;
        }

        .qr-label {
          margin-top: 3px;
          font-size: 6px;
        }

        .altex-credit {
          right: 10px;
          bottom: 10px;
        }

        .altex-credit span {
          font-size: 6px;
        }

        .altex-credit img {
          width: 76px;
        }
      }
    `}</style>
  );
}

export default Display;