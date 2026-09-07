import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getApprovedPosts, getPostMediaUrl } from '../lib/posts';

const EVENT_ID =
  '90eabcfb-7104-4ebf-bd46-401d416f0c83';

function Display() {
  const [posts, setPosts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mediaUrls, setMediaUrls] = useState({});
  const [loading, setLoading] = useState(true);

  async function loadPosts() {
    try {
      const approvedPosts = await getApprovedPosts();

      setPosts(approvedPosts);

      const urls = {};

      for (const post of approvedPosts) {
        if (post.storage_path) {
          try {
            urls[post.id] = await getPostMediaUrl(post.id);
          } catch (error) {
            console.error(
              `No se pudo cargar el archivo ${post.id}:`,
              error
            );
          }
        }
      }

      setMediaUrls(urls);
    } catch (error) {
      console.error(
        'Error cargando recuerdos:',
        error
      );
    } finally {
      setLoading(false);
    }
  }

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

  useEffect(() => {
    if (posts.length <= 1) {
      setCurrentIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentIndex((current) => {
        return (current + 1) % posts.length;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [posts.length]);

  useEffect(() => {
    if (currentIndex >= posts.length) {
      setCurrentIndex(0);
    }
  }, [posts.length, currentIndex]);

  if (loading) {
    return (
      <main style={styles.screen}>
        <div style={styles.loading}>
          <div style={styles.logo}>LARA XV</div>
          <p>Cargando recuerdos...</p>
        </div>
      </main>
    );
  }

  if (posts.length === 0) {
    return (
      <main style={styles.screen}>
        <div style={styles.empty}>
          <div style={styles.logo}>LARA XV</div>

          <h1>Los recuerdos aparecerán aquí</h1>

          <p>
            Compartí tus fotos y mensajes para
            formar parte de este momento.
          </p>
        </div>
      </main>
    );
  }

  const post = posts[currentIndex];
  const mediaUrl = mediaUrls[post.id];

  return (
    <main style={styles.screen}>
      <div style={styles.background} />

      <section style={styles.content}>
        <div style={styles.mediaContainer}>
          {mediaUrl && post.file_type?.startsWith('video/') ? (
            <video
              key={post.id}
              src={mediaUrl}
              autoPlay
              muted
              playsInline
              controls={false}
              style={styles.media}
            />
          ) : mediaUrl ? (
            <img
              key={post.id}
              src={mediaUrl}
              alt={`Recuerdo de ${post.author_name}`}
              style={styles.media}
            />
          ) : null}
        </div>

        <div style={styles.info}>
          <div style={styles.logoSmall}>
            LARA XV
          </div>

          <h2>{post.author_name}</h2>

          {post.message && (
            <p>{post.message}</p>
          )}
        </div>

        <div style={styles.counter}>
          {currentIndex + 1} / {posts.length}
        </div>
      </section>
    </main>
  );
}

const styles = {
  screen: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#090909',
    color: '#fff',
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },

  background: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at center, #252525 0%, #090909 70%)',
    opacity: 0.9,
  },

  content: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    boxSizing: 'border-box',
  },

  mediaContainer: {
    width: 'min(90vw, 1400px)',
    height: '70vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: '24px',
    background: '#111',
    boxShadow:
      '0 20px 80px rgba(0, 0, 0, 0.55)',
  },

  media: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },

  info: {
    textAlign: 'center',
    marginTop: '22px',
    maxWidth: '900px',
  },

  logo: {
    fontSize: '52px',
    fontWeight: 800,
    letterSpacing: '8px',
    marginBottom: '25px',
  },

  logoSmall: {
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '4px',
    opacity: 0.65,
    marginBottom: '6px',
  },

  infoH2: {
    margin: 0,
  },

  counter: {
    position: 'absolute',
    right: '25px',
    bottom: '20px',
    fontSize: '13px',
    opacity: 0.35,
  },

  loading: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '30px',
    boxSizing: 'border-box',
  },
};

export default Display;