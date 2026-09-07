import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '../lib/supabase';
import { isAdmin } from '../lib/admin';

import {
  getPostMediaUrl,
  movePostToTrash,
  restorePost,
  deletePostPermanently,
} from '../lib/posts';

import AltexBrand from '../components/AltexBrand';

const EVENT_ID =
  '90eabcfb-7104-4ebf-bd46-401d416f0c83';

const TABS = [
  {
    id: 'pending',
    label: 'Pendientes',
    icon: '⏳',
  },
  {
    id: 'approved',
    label: 'Aprobados',
    icon: '✓',
  },
  {
    id: 'rejected',
    label: 'Rechazados',
    icon: '×',
  },
  {
    id: 'trashed',
    label: 'Papelera',
    icon: '⌫',
  },
];

function Admin() {
  const [user, setUser] =
    useState(null);

  const [checkingSession, setCheckingSession] =
    useState(true);

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [loadingPosts, setLoadingPosts] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const [posts, setPosts] =
    useState([]);

  const [mediaUrls, setMediaUrls] =
    useState({});

  const [activeTab, setActiveTab] =
    useState('pending');

  const [
    processingPostId,
    setProcessingPostId,
  ] = useState(null);

  const loadPosts =
    useCallback(async () => {
      try {
        setLoadingPosts(true);
        setError('');

        const {
          data,
          error,
        } = await supabase
          .from('event_posts')
          .select(`
            id,
            event_id,
            user_id,
            author_name,
            message,
            file_type,
            file_name,
            original_file_name,
            file_size,
            storage_path,
            status,
            ai_status,
            ai_score,
            ai_reason,
            ai_checked_at,
            ai_model,
            moderation_source,
            moderated_by,
            moderated_at,
            created_at,
            deleted_at,
            deleted_by,
            previous_status
          `)
          .eq(
            'event_id',
            EVENT_ID
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          );

        if (error) {
          throw error;
        }

        const loaded =
          data ?? [];

        setPosts(
          loaded
        );

        const urls = {};

        for (
          const post of loaded
        ) {
          if (
            !post.storage_path
          ) {
            continue;
          }

          try {
            const url =
              await getPostMediaUrl(
                post.id
              );

            if (url) {
              urls[
                post.id
              ] = url;
            }
          } catch (
            mediaError
          ) {
            console.error(
              mediaError
            );
          }
        }

        setMediaUrls(
          urls
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        setError(
          error.message ||
            'No se pudieron cargar los recuerdos.'
        );
      } finally {
        setLoadingPosts(
          false
        );
      }
    }, []);

  useEffect(() => {
    const checkSession =
      async () => {
        try {
          const {
            data: {
              session,
            },
          } =
            await supabase.auth.getSession();

          if (
            !session?.user
          ) {
            setCheckingSession(
              false
            );

            return;
          }

          const admin =
            await isAdmin();

          if (!admin) {
            await supabase.auth.signOut();

            setError(
              'Esta cuenta no tiene permisos de administrador.'
            );

            return;
          }

          setUser(
            session.user
          );
        } catch (
          error
        ) {
          console.error(
            error
          );

          setError(
            error.message ||
              'No se pudo comprobar la sesión.'
          );
        } finally {
          setCheckingSession(
            false
          );
        }
      };

    checkSession();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    loadPosts();
  }, [
    user,
    loadPosts,
  ]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const channel =
      supabase
        .channel(
          'admin-event-posts'
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'event_posts',
            filter:
              `event_id=eq.${EVENT_ID}`,
          },
          () => {
            loadPosts();
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    user,
    loadPosts,
  ]);

  const handleLogin =
    async (event) => {
      event.preventDefault();

      setError('');
      setSuccess('');

      try {
        setLoading(true);

        const {
          data,
          error:
            loginError,
        } =
          await supabase.auth.signInWithPassword({
            email:
              email.trim(),
            password,
          });

        if (loginError) {
          throw loginError;
        }

        if (!data.user) {
          throw new Error(
            'No se pudo obtener el usuario.'
          );
        }

        const admin =
          await isAdmin();

        if (!admin) {
          await supabase.auth.signOut();

          throw new Error(
            'La cuenta es válida, pero no tiene permisos de administrador.'
          );
        }

        setUser(
          data.user
        );

        setPassword('');
      } catch (
        error
      ) {
        console.error(
          error
        );

        setError(
          error.message ||
            'No se pudo iniciar sesión.'
        );
      } finally {
        setLoading(false);
      }
    };

  const handleLogout =
    async () => {
      await supabase.auth.signOut();

      setUser(null);
      setPosts([]);
      setMediaUrls({});
    };

  const changeStatus =
    async (
      postId,
      status
    ) => {
      try {
        setProcessingPostId(
          postId
        );

        setError('');
        setSuccess('');

        const {
          error,
        } =
          await supabase
            .from('event_posts')
            .update({
              status,
              moderation_source:
                'manual',
              moderated_by:
                user.id,
              moderated_at:
                new Date().toISOString(),
            })
            .eq(
              'id',
              postId
            )
            .eq(
              'event_id',
              EVENT_ID
            );

        if (error) {
          throw error;
        }

        await loadPosts();

        setSuccess(
          status === 'approved'
            ? 'Recuerdo aprobado manualmente. ✓'
            : 'Recuerdo rechazado manualmente. ×'
        );
      } catch (
        error
      ) {
        setError(
          error.message ||
            'No se pudo actualizar.'
        );
      } finally {
        setProcessingPostId(
          null
        );
      }
    };

  const sendToTrash =
    async (
      post
    ) => {
      const confirmed =
        window.confirm(
          '¿Enviar este recuerdo a la papelera?\n\nPodrás restaurarlo posteriormente.'
        );

      if (!confirmed) {
        return;
      }

      try {
        setProcessingPostId(
          post.id
        );

        await movePostToTrash(
          post.id
        );

        await loadPosts();

        setSuccess(
          'Recuerdo enviado a la papelera. 🗑️'
        );
      } catch (
        error
      ) {
        setError(
          error.message ||
            'No se pudo enviar a la papelera.'
        );
      } finally {
        setProcessingPostId(
          null
        );
      }
    };

  const restore =
    async (
      post
    ) => {
      const confirmed =
        window.confirm(
          '¿Restaurar este recuerdo?'
        );

      if (!confirmed) {
        return;
      }

      try {
        setProcessingPostId(
          post.id
        );

        const result =
          await restorePost(
            post.id
          );

        await loadPosts();

        setSuccess(
          `Recuerdo restaurado como ${result?.restoredStatus || 'pending'}. ↩️`
        );
      } catch (
        error
      ) {
        setError(
          error.message ||
            'No se pudo restaurar.'
        );
      } finally {
        setProcessingPostId(
          null
        );
      }
    };

  const permanentDelete =
    async (
      post
    ) => {
      const confirmed =
        window.confirm(
          '🚨 ELIMINAR DEFINITIVAMENTE\n\nSe eliminarán el recuerdo y su archivo.\n\nEsta acción no se puede deshacer.\n\n¿Continuar?'
        );

      if (!confirmed) {
        return;
      }

      try {
        setProcessingPostId(
          post.id
        );

        await deletePostPermanently(
          post.id
        );

        await loadPosts();

        setSuccess(
          'Recuerdo eliminado definitivamente. 🗑️'
        );
      } catch (
        error
      ) {
        setError(
          error.message ||
            'No se pudo eliminar.'
        );
      } finally {
        setProcessingPostId(
          null
        );
      }
    };

  const counts =
    useMemo(
      () => ({
        pending:
          posts.filter(
            p =>
              p.status ===
              'pending'
          ).length,

        approved:
          posts.filter(
            p =>
              p.status ===
              'approved'
          ).length,

        rejected:
          posts.filter(
            p =>
              p.status ===
              'rejected'
          ).length,

        trashed:
          posts.filter(
            p =>
              p.status ===
              'trashed'
          ).length,
      }),
      [posts]
    );

  const aiCounts =
    useMemo(
      () => ({
        safe:
          posts.filter(
            p =>
              p.ai_status ===
              'safe'
          ).length,

        review:
          posts.filter(
            p =>
              p.ai_status ===
              'review'
          ).length,

        blocked:
          posts.filter(
            p =>
              p.ai_status ===
              'blocked'
          ).length,
      }),
      [posts]
    );

  const currentPosts =
    posts.filter(
      p =>
        p.status ===
        activeTab
    );

  const formatDate =
    date =>
      date
        ? new Date(
            date
          ).toLocaleString(
            'es-AR'
          )
        : '';

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
        ).toFixed(1)} KB`;
      }

      return `${(
        bytes /
        1024 /
        1024
      ).toFixed(2)} MB`;
    };

  const renderMedia =
    post => {
      const url =
        mediaUrls[
          post.id
        ];

      if (!url) {
        return null;
      }

      if (
        post.file_type?.startsWith(
          'video/'
        )
      ) {
        return (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            className="admin-media"
          />
        );
      }

      return (
        <img
          src={url}
          alt={`Recuerdo de ${post.author_name}`}
          className="admin-media"
        />
      );
    };

  if (
    checkingSession
  ) {
    return (
      <Shell>
        <div className="center-state">
          <div className="brand-mark">
            L15
          </div>

          <h1>
            Lara XV
          </h1>

          <p>
            Comprobando acceso...
          </p>
        </div>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <div className="auth-page">
          <div className="auth-orb orb-one" />
          <div className="auth-orb orb-two" />

          <div className="auth-card">
            <div className="brand-mark">
              L15
            </div>

            <div className="eyebrow">
              LARA XV
            </div>

            <h1>
              Centro de
              administración
            </h1>

            <p className="auth-description">
              Gestioná recuerdos,
              moderación y contenido
              del evento.
            </p>

            <form
              onSubmit={
                handleLogin
              }
              className="auth-form"
            >
              <label>
                Email

                <input
                  type="email"
                  value={email}
                  onChange={e =>
                    setEmail(
                      e.target.value
                    )
                  }
                  autoComplete="email"
                  placeholder="admin@email.com"
                />
              </label>

              <label>
                Contraseña

                <input
                  type="password"
                  value={password}
                  onChange={e =>
                    setPassword(
                      e.target.value
                    )
                  }
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                />
              </label>

              {error && (
                <div className="alert error">
                  {error}
                </div>
              )}

              <button
                className="primary-button"
                disabled={
                  loading
                }
              >
                {loading
                  ? 'Ingresando...'
                  : 'Ingresar al panel'}
              </button>
            </form>

            <div className="secure-text">
              ● Acceso protegido
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div>
            <div className="sidebar-brand">
              <div className="brand-mark small">
                L15
              </div>

              <div className="sidebar-brand-text">
                <strong>
                  LARA XV
                </strong>

                <span>
                  Administración
                </span>
              </div>
            </div>

            <div className="sidebar-title">
              MODERACIÓN
            </div>

            <nav className="nav">
              {TABS.map(
                tab => (
                  <button
                    key={
                      tab.id
                    }
                    className={
                      activeTab ===
                      tab.id
                        ? 'nav-item active'
                        : 'nav-item'
                    }
                    onClick={() =>
                      setActiveTab(
                        tab.id
                      )
                    }
                  >
                    <span className="nav-icon">
                      {
                        tab.icon
                      }
                    </span>

                    <span className="nav-label">
                      {
                        tab.label
                      }
                    </span>

                    <span className="nav-count">
                      {
                        counts[
                          tab.id
                        ]
                      }
                    </span>
                  </button>
                )
              )}
            </nav>

            <div className="sidebar-title">
              INTELIGENCIA ARTIFICIAL
            </div>

            <div className="ai-sidebar-stats">
              <div>
                <span>
                  <i className="dot safe" />
                  SAFE
                </span>

                <strong>
                  {
                    aiCounts.safe
                  }
                </strong>
              </div>

              <div>
                <span>
                  <i className="dot review" />
                  REVIEW
                </span>

                <strong>
                  {
                    aiCounts.review
                  }
                </strong>
              </div>

              <div>
                <span>
                  <i className="dot blocked" />
                  BLOCKED
                </span>

                <strong>
                  {
                    aiCounts.blocked
                  }
                </strong>
              </div>
            </div>
          </div>

          <div className="sidebar-bottom">
            <AltexBrand variant="admin" />

            <div className="admin-user">
              <div className="avatar">
                {(user.email ||
                  'A')
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <strong>
                  Administrador
                </strong>

                <span>
                  {
                    user.email ||
                    ''
                  }
                </span>
              </div>
            </div>

            <button
              className="logout-button"
              onClick={
                handleLogout
              }
            >
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="admin-main">
          <header className="topbar">
            <div>
              <div className="eyebrow">
                CONTROL CENTER
              </div>

              <h1>
                {
                  TABS.find(
                    tab =>
                      tab.id ===
                      activeTab
                  )?.label
                }
              </h1>

              <p>
                Gestioná los recuerdos
                del evento en tiempo real.
              </p>
            </div>

            <button
              className="refresh-button"
              onClick={
                loadPosts
              }
              disabled={
                loadingPosts
              }
            >
              ↻{' '}
              {loadingPosts
                ? 'Actualizando'
                : 'Actualizar'}
            </button>
          </header>

          {error && (
            <div className="alert error">
              {error}
            </div>
          )}

          {success && (
            <div className="alert success">
              {success}
            </div>
          )}

          <section className="stats-grid">
            {TABS.map(
              tab => (
                <button
                  key={
                    tab.id
                  }
                  className={
                    activeTab ===
                    tab.id
                      ? 'stat-card active'
                      : 'stat-card'
                  }
                  onClick={() =>
                    setActiveTab(
                      tab.id
                    )
                  }
                >
                  <span>
                    {
                      tab.icon
                    }{' '}
                    {
                      tab.label
                    }
                  </span>

                  <strong>
                    {
                      counts[
                        tab.id
                      ]
                    }
                  </strong>
                </button>
              )
            )}
          </section>

          <section className="ai-summary">
            <div className="ai-summary-main">
              <div className="ai-orb">
                ✦
              </div>

              <div>
                <strong>
                  Moderación inteligente
                </strong>

                <p>
                  IA analizando contenido
                  automáticamente.
                </p>
              </div>
            </div>

            <div className="ai-summary-data">
              <span>
                <b>
                  {
                    aiCounts.safe
                  }
                </b>{' '}
                seguros
              </span>

              <span>
                <b>
                  {
                    aiCounts.review
                  }
                </b>{' '}
                revisión
              </span>

              <span>
                <b>
                  {
                    aiCounts.blocked
                  }
                </b>{' '}
                bloqueados
              </span>
            </div>
          </section>

          <section className="posts-section">
            <div className="section-heading">
              <div>
                <h2>
                  {
                    TABS.find(
                      tab =>
                        tab.id ===
                        activeTab
                    )?.icon
                  }{' '}
                  {
                    TABS.find(
                      tab =>
                        tab.id ===
                        activeTab
                    )?.label
                  }
                </h2>

                <span>
                  {
                    currentPosts.length
                  }{' '}
                  {currentPosts.length ===
                  1
                    ? 'recuerdo'
                    : 'recuerdos'}
                </span>
              </div>
            </div>

            {loadingPosts &&
              currentPosts.length ===
                0 && (
              <EmptyState
                title="Cargando recuerdos"
                text="Preparando contenido."
              />
            )}

            {!loadingPosts &&
              currentPosts.length ===
                0 && (
              <EmptyState
                title={
                  activeTab ===
                  'trashed'
                    ? 'La papelera está vacía'
                    : 'No hay recuerdos aquí'
                }
                text={
                  activeTab ===
                  'pending'
                    ? 'Los nuevos recuerdos aparecerán automáticamente.'
                    : 'Esta sección todavía no tiene contenido.'
                }
              />
            )}

            <div className="posts-grid">
              {currentPosts.map(
                post => {
                  const processing =
                    processingPostId ===
                    post.id;

                  const confidence =
                    typeof post.ai_score ===
                    'number'
                      ? `${Math.round(
                          post.ai_score *
                            100
                        )}%`
                      : '—';

                  const autoApproved =
                    post.status ===
                      'approved' &&
                    post.moderation_source ===
                      'ai';

                  const aiLabel =
                    post.ai_status ===
                    'safe'
                      ? 'SAFE'
                      : post.ai_status ===
                        'review'
                      ? 'REVIEW'
                      : post.ai_status ===
                        'blocked'
                      ? 'BLOCKED'
                      : post.ai_status ===
                        'error'
                      ? 'ERROR'
                      : 'ANALIZANDO';

                  return (
                    <article
                      key={
                        post.id
                      }
                      className={
                        processing
                          ? 'post-card processing'
                          : 'post-card'
                      }
                    >
                      <header className="post-card-header">
                        <div className="author">
                          <div className="avatar post">
                            {(post.author_name ||
                              'I')
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {
                                post.author_name
                              }
                            </strong>

                            <span>
                              {
                                formatDate(
                                  post.created_at
                                )
                              }
                            </span>
                          </div>
                        </div>

                        <span
                          className={`status-pill ${post.status}`}
                        >
                          {
                            post.status
                          }
                        </span>
                      </header>

                      <div className="ai-box">
                        <div className="ai-row">
                          <strong>
                            ✦ Análisis IA
                          </strong>

                          <span
                            className={`ai-pill ${post.ai_status || 'pending'}`}
                          >
                            {
                              aiLabel
                            }
                          </span>
                        </div>

                        <div className="ai-details">
                          <span>
                            Confianza
                          </span>

                          <strong>
                            {
                              confidence
                            }
                          </strong>
                        </div>

                        {post.ai_reason && (
                          <p>
                            {
                              post.ai_reason
                            }
                          </p>
                        )}
                      </div>

                      {autoApproved && (
                        <div className="decision ai">
                          ✦ Aprobado automáticamente
                          por IA
                        </div>
                      )}

                      {post.moderation_source ===
                        'manual' &&
                        post.status !==
                          'pending' && (
                          <div className="decision manual">
                            ✓ Decisión manual del administrador
                          </div>
                        )}

                      {post.storage_path && (
                        <div className="media-box">
                          {
                            renderMedia(
                              post
                            )}

                          <small>
                            {
                              post.file_type
                            }{' '}
                            ·{' '}
                            {
                              formatSize(
                                post.file_size
                              )
                            }
                          </small>
                        </div>
                      )}

                      {post.message && (
                        <div className="message-box">
                          <span>
                            MENSAJE
                          </span>

                          <p>
                            {
                              post.message
                            }
                          </p>
                        </div>
                      )}

                      <div className="actions">
                        {post.status ===
                          'pending' && (
                          <>
                            <button
                              className="approve"
                              disabled={
                                processing
                              }
                              onClick={() =>
                                changeStatus(
                                  post.id,
                                  'approved'
                                )
                              }
                            >
                              ✓ Aprobar
                            </button>

                            <button
                              className="reject"
                              disabled={
                                processing
                              }
                              onClick={() =>
                                changeStatus(
                                  post.id,
                                  'rejected'
                                )
                              }
                            >
                              × Rechazar
                            </button>
                          </>
                        )}

                        {post.status !==
                          'trashed' && (
                          <button
                            className="trash"
                            disabled={
                              processing
                            }
                            onClick={() =>
                              sendToTrash(
                                post
                              )
                            }
                          >
                            ⌫ Papelera
                          </button>
                        )}

                        {post.status ===
                          'trashed' && (
                          <>
                            <button
                              className="restore"
                              disabled={
                                processing
                              }
                              onClick={() =>
                                restore(
                                  post
                                )
                              }
                            >
                              ↩ Restaurar
                            </button>

                            <button
                              className="delete"
                              disabled={
                                processing
                              }
                              onClick={() =>
                                permanentDelete(
                                  post
                                )
                              }
                            >
                              × Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          </section>
        </main>
      </div>
    </Shell>
  );
}

function Shell({
  children,
}) {
  return (
    <>
      <style>{CSS}</style>
      {children}
    </>
  );
}

function EmptyState({
  title,
  text,
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        ✦
      </div>

      <h3>
        {title}
      </h3>

      <p>
        {text}
      </p>
    </div>
  );
}

const CSS = `
  * {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    margin: 0;
    min-height: 100%;
    background: #080b15;
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
    color: #f4f0e9;
  }

  button,
  input {
    font: inherit;
  }

  button {
    -webkit-tap-highlight-color: transparent;
  }

  .admin-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    background:
      radial-gradient(
        circle at 85% 5%,
        rgba(215, 163, 190, .12),
        transparent 25%
      ),
      radial-gradient(
        circle at 30% 100%,
        rgba(227, 191, 119, .07),
        transparent 25%
      ),
      #080b15;
  }

  .admin-sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 24px 17px;
    border-right:
      1px solid rgba(255,255,255,.07);
    background:
      rgba(8,11,21,.78);
    backdrop-filter:
      blur(24px);
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 2px 7px;
  }

  .sidebar-brand-text {
    display: grid;
    gap: 3px;
  }

  .sidebar-brand-text strong {
    font-size: 12px;
    letter-spacing: 3px;
  }

  .sidebar-brand-text span {
    color: #737b8e;
    font-size: 11px;
  }

  .brand-mark {
    width: 62px;
    height: 62px;
    display: grid;
    place-items: center;
    border-radius: 18px;
    background:
      linear-gradient(
        135deg,
        #efd094,
        #d3a1ba
      );
    color: #0a0d16;
    font-weight: 950;
    letter-spacing: 2px;
    box-shadow:
      0 15px 35px rgba(213,169,118,.12);
  }

  .brand-mark.small {
    width: 44px;
    height: 44px;
    border-radius: 13px;
    font-size: 12px;
  }

  .sidebar-title {
    margin: 30px 10px 10px;
    color: #60687b;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 2.5px;
  }

  .nav {
    display: grid;
    gap: 5px;
  }

  .nav-item {
    width: 100%;
    display: grid;
    grid-template-columns: 27px 1fr auto;
    align-items: center;
    gap: 7px;
    padding: 11px;
    border: 1px solid transparent;
    border-radius: 12px;
    background: transparent;
    color: #858da0;
    text-align: left;
    cursor: pointer;
  }

  .nav-item:hover {
    background:
      rgba(255,255,255,.035);
    color: #ddd9d2;
  }

  .nav-item.active {
    border-color:
      rgba(238,202,139,.13);
    background:
      linear-gradient(
        90deg,
        rgba(238,202,139,.10),
        rgba(211,161,186,.045)
      );
    color: #fff;
  }

  .nav-icon {
    text-align: center;
    font-size: 16px;
  }

  .nav-label {
    font-size: 13px;
    font-weight: 700;
  }

  .nav-count {
    min-width: 25px;
    padding: 4px 6px;
    border-radius: 8px;
    background:
      rgba(255,255,255,.05);
    text-align: center;
    font-size: 11px;
    font-weight: 800;
  }

  .ai-sidebar-stats {
    display: grid;
    gap: 9px;
    padding: 6px 10px;
  }

  .ai-sidebar-stats > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #858da0;
    font-size: 11px;
  }

  .ai-sidebar-stats span {
    display: flex;
    align-items: center;
  }

  .dot {
    width: 6px;
    height: 6px;
    display: inline-block;
    margin-right: 7px;
    border-radius: 50%;
  }

  .dot.safe { background: #76d5a0; }
  .dot.review { background: #e7bb6e; }
  .dot.blocked { background: #df7987; }

  .sidebar-bottom {
    display: grid;
    gap: 11px;
  }

  .admin-user {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 10px;
    border:
      1px solid rgba(255,255,255,.06);
    border-radius: 13px;
    background:
      rgba(255,255,255,.025);
  }

  .admin-user > div:last-child {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .admin-user strong {
    font-size: 11px;
  }

  .admin-user span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #70788b;
    font-size: 10px;
  }

  .avatar {
    width: 33px;
    height: 33px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background:
      linear-gradient(
        135deg,
        #d5a6bc,
        #e8ca91
      );
    color: #0a0d16;
    font-weight: 900;
  }

  .avatar.post {
    width: 36px;
    height: 36px;
    border-radius: 11px;
  }

  .logout-button,
  .refresh-button {
    border:
      1px solid rgba(255,255,255,.08);
    border-radius: 11px;
    background:
      rgba(255,255,255,.035);
    color: #b4bac6;
    cursor: pointer;
  }

  .logout-button {
    width: 100%;
    padding: 10px;
    font-size: 12px;
    font-weight: 700;
  }

  .admin-main {
    min-width: 0;
    padding: 34px clamp(18px, 4vw, 48px) 70px;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    flex-wrap: wrap;
  }

  .eyebrow {
    color: #c2a76f;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 3px;
  }

  .topbar h1 {
    margin: 8px 0 5px;
    color: #fff;
    font-size: clamp(30px, 4vw, 45px);
    line-height: 1;
    letter-spacing: -1.5px;
  }

  .topbar p {
    margin: 0;
    color: #80899b;
    font-size: 13px;
  }

  .refresh-button {
    padding: 11px 14px;
  }

  .alert {
    margin-top: 20px;
    padding: 13px 15px;
    border-radius: 12px;
    font-size: 13px;
  }

  .alert.error {
    border:
      1px solid rgba(225,119,134,.15);
    background:
      rgba(225,119,134,.08);
    color: #ffadb7;
  }

  .alert.success {
    border:
      1px solid rgba(119,214,161,.14);
    background:
      rgba(119,214,161,.065);
    color: #9de6ba;
  }

  .stats-grid {
    margin-top: 28px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0,1fr));
    gap: 12px;
  }

  .stat-card {
    min-width: 0;
    min-height: 92px;
    padding: 16px;
    display: grid;
    align-content: space-between;
    text-align: left;
    border:
      1px solid rgba(255,255,255,.06);
    border-radius: 17px;
    background:
      linear-gradient(
        145deg,
        rgba(255,255,255,.055),
        rgba(255,255,255,.018)
      );
    color: #8c94a7;
    cursor: pointer;
  }

  .stat-card.active {
    border-color:
      rgba(235,201,140,.20);
    color: #e9e4dc;
    background:
      linear-gradient(
        145deg,
        rgba(235,201,140,.09),
        rgba(211,161,186,.04)
      );
  }

  .stat-card span {
    font-size: 11px;
    font-weight: 800;
  }

  .stat-card strong {
    color: #fff;
    font-size: 30px;
  }

  .ai-summary {
    margin-top: 12px;
    padding: 16px 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
    border:
      1px solid rgba(211,161,186,.09);
    border-radius: 17px;
    background:
      linear-gradient(
        135deg,
        rgba(211,161,186,.08),
        rgba(235,201,140,.045)
      );
  }

  .ai-summary-main {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .ai-orb {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 13px;
    background:
      linear-gradient(
        135deg,
        #d4a5bb,
        #e8ca90
      );
    color: #0b0e17;
    font-weight: 900;
  }

  .ai-summary strong {
    color: #eee9e2;
    font-size: 13px;
  }

  .ai-summary p {
    margin: 3px 0 0;
    color: #858d9f;
    font-size: 11px;
  }

  .ai-summary-data {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
    color: #868ea1;
    font-size: 11px;
  }

  .ai-summary-data b {
    color: #e8e3db;
  }

  .posts-section {
    margin-top: 30px;
  }

  .section-heading h2 {
    margin: 0;
    font-size: 21px;
    color: #fff;
  }

  .section-heading span {
    display: block;
    margin-top: 4px;
    color: #70798c;
    font-size: 12px;
  }

  .posts-grid {
    margin-top: 17px;
    display: grid;
    grid-template-columns:
      repeat(auto-fit, minmax(350px, 1fr));
    gap: 17px;
  }

  .post-card {
    overflow: hidden;
    border:
      1px solid rgba(255,255,255,.06);
    border-radius: 21px;
    background:
      linear-gradient(
        145deg,
        rgba(255,255,255,.05),
        rgba(255,255,255,.018)
      );
    box-shadow:
      0 16px 55px rgba(0,0,0,.16);
    transition:
      transform .2s ease,
      border-color .2s ease;
  }

  .post-card:hover {
    transform: translateY(-2px);
    border-color:
      rgba(255,255,255,.10);
  }

  .post-card.processing {
    opacity: .58;
  }

  .post-card-header {
    padding: 17px 17px 0;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
  }

  .author {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .author > div:last-child {
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .author strong {
    color: #f3efe8;
    font-size: 13px;
  }

  .author span {
    color: #727b8f;
    font-size: 10px;
  }

  .status-pill,
  .ai-pill {
    padding: 6px 8px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 1px;
  }

  .status-pill.pending {
    background: rgba(231,187,110,.10);
    color: #e5c17d;
  }

  .status-pill.approved {
    background: rgba(118,213,160,.09);
    color: #9de3b7;
  }

  .status-pill.rejected {
    background: rgba(225,119,134,.09);
    color: #efa2ab;
  }

  .status-pill.trashed {
    background: rgba(255,255,255,.05);
    color: #a5acb9;
  }

  .ai-box {
    margin: 15px 17px 0;
    padding: 12px;
    border:
      1px solid rgba(255,255,255,.05);
    border-radius: 14px;
    background: rgba(4,7,14,.30);
  }

  .ai-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .ai-row strong {
    color: #d4d0ca;
    font-size: 11px;
  }

  .ai-pill.safe {
    background: rgba(118,213,160,.09);
    color: #9de3b7;
  }

  .ai-pill.review {
    background: rgba(231,187,110,.09);
    color: #e3bf7a;
  }

  .ai-pill.blocked,
  .ai-pill.error {
    background: rgba(225,119,134,.09);
    color: #efa2ab;
  }

  .ai-pill.pending {
    background: rgba(255,255,255,.05);
    color: #9ba2af;
  }

  .ai-details {
    margin-top: 9px;
    display: flex;
    gap: 8px;
    color: #656e80;
    font-size: 10px;
  }

  .ai-details strong {
    color: #e7e1d9;
  }

  .ai-box p {
    margin: 7px 0 0;
    color: #959cac;
    line-height: 1.5;
    font-size: 10px;
  }

  .decision {
    margin: 11px 17px 0;
    padding: 8px 10px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 800;
  }

  .decision.ai {
    border:
      1px solid rgba(118,213,160,.12);
    background:
      rgba(118,213,160,.07);
    color: #9de4b8;
  }

  .decision.manual {
    border:
      1px solid rgba(255,255,255,.06);
    background:
      rgba(255,255,255,.03);
    color: #bfc4cd;
  }

  .media-box {
    margin-top: 14px;
    padding: 0 17px;
  }

  .admin-media {
    width: 100%;
    aspect-ratio: 16/11;
    display: block;
    object-fit: cover;
    border-radius: 15px;
    background: #04070d;
    border:
      1px solid rgba(255,255,255,.05);
  }

  .media-box small {
    display: block;
    margin-top: 6px;
    color: #626b7d;
    font-size: 9px;
  }

  .message-box {
    margin: 14px 17px 0;
    padding: 12px;
    border:
      1px solid rgba(255,255,255,.05);
    border-radius: 13px;
    background: rgba(255,255,255,.022);
  }

  .message-box span {
    color: #6a7386;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 2px;
  }

  .message-box p {
    margin: 7px 0 0;
    color: #d2d5db;
    white-space: pre-wrap;
    line-height: 1.55;
    font-size: 11px;
  }

  .actions {
    display: grid;
    grid-template-columns:
      repeat(auto-fit, minmax(110px,1fr));
    gap: 8px;
    padding: 15px 17px 17px;
  }

  .actions button {
    padding: 10px 9px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 800;
  }

  .approve {
    border: 1px solid rgba(118,213,160,.15);
    background: rgba(118,213,160,.08);
    color: #9de2b6;
  }

  .reject {
    border: 1px solid rgba(225,119,134,.15);
    background: rgba(225,119,134,.07);
    color: #efa1ab;
  }

  .trash {
    border: 1px solid rgba(255,255,255,.07);
    background: rgba(255,255,255,.03);
    color: #a9afbb;
  }

  .restore {
    border: 1px solid rgba(232,200,138,.15);
    background: rgba(232,200,138,.07);
    color: #e6c77f;
  }

  .delete {
    border: 1px solid rgba(225,119,134,.15);
    background: rgba(225,119,134,.07);
    color: #efa1ab;
  }

  .empty-state,
  .center-state {
    min-height: 280px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .empty-state {
    margin-top: 17px;
    padding: 35px;
    border:
      1px dashed rgba(255,255,255,.08);
    border-radius: 21px;
    background:
      rgba(255,255,255,.018);
  }

  .empty-icon {
    width: 58px;
    height: 58px;
    display: grid;
    place-items: center;
    border-radius: 18px;
    background:
      rgba(232,200,138,.07);
    color: #d8b97b;
  }

  .empty-state h3 {
    margin: 17px 0 6px;
    font-size: 18px;
  }

  .empty-state p {
    max-width: 430px;
    margin: 0;
    color: #727b8f;
    font-size: 12px;
    line-height: 1.6;
  }

  .auth-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    position: relative;
    overflow: hidden;
    padding: 24px;
    background:
      radial-gradient(
        circle at 80% 20%,
        rgba(211,161,186,.12),
        transparent 28%
      ),
      radial-gradient(
        circle at 20% 80%,
        rgba(232,202,144,.08),
        transparent 25%
      ),
      #080b15;
  }

  .auth-card {
    position: relative;
    z-index: 2;
    width: 100%;
    max-width: 460px;
    padding: 40px;
    border:
      1px solid rgba(255,255,255,.08);
    border-radius: 26px;
    background:
      rgba(255,255,255,.045);
    box-shadow:
      0 28px 90px rgba(0,0,0,.42);
    backdrop-filter:
      blur(24px);
  }

  .auth-card h1 {
    margin: 12px 0;
    max-width: 370px;
    color: #fff;
    font-size: 34px;
    line-height: 1.07;
  }

  .auth-description {
    margin: 0;
    color: #929aab;
    line-height: 1.65;
    font-size: 13px;
  }

  .auth-form {
    margin-top: 26px;
    display: grid;
    gap: 16px;
  }

  .auth-form label {
    display: grid;
    gap: 8px;
    color: #e8e4dd;
    font-size: 13px;
    font-weight: 700;
  }

  .auth-form input {
    width: 100%;
    padding: 13px 14px;
    border:
      1px solid rgba(255,255,255,.10);
    border-radius: 12px;
    outline: none;
    background:
      rgba(255,255,255,.045);
    color: #fff;
  }

  .primary-button {
    margin-top: 4px;
    padding: 14px 18px;
    border: none;
    border-radius: 12px;
    background:
      linear-gradient(
        135deg,
        #eed092,
        #d4a2bb
      );
    color: #0b0e17;
    font-weight: 900;
    cursor: pointer;
  }

  .secure-text {
    margin-top: 18px;
    text-align: center;
    color: #6f7789;
    font-size: 11px;
  }

  .auth-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
  }

  .orb-one {
    width: 420px;
    height: 420px;
    right: -120px;
    top: -170px;
    background: rgba(214,165,189,.12);
  }

  .orb-two {
    width: 360px;
    height: 360px;
    left: -160px;
    bottom: -160px;
    background: rgba(232,201,142,.08);
  }

  @media (max-width: 1050px) {
    .admin-shell {
      grid-template-columns: 88px minmax(0,1fr);
    }

    .sidebar-brand-text,
    .sidebar-title,
    .nav-label,
    .ai-sidebar-stats,
    .admin-user,
    .logout-button,
    .admin-sidebar .guest-develop,
    .admin-sidebar .admin-wrapper {
      display: none !important;
    }

    .admin-sidebar {
      padding: 18px 10px;
    }

    .sidebar-brand {
      justify-content: center;
    }

    .nav-item {
      grid-template-columns: 1fr;
      justify-items: center;
      padding: 11px 7px;
    }

    .nav-count {
      min-width: 24px;
    }

    .stats-grid {
      grid-template-columns:
        repeat(2, minmax(0,1fr));
    }
  }

  @media (max-width: 720px) {
    .admin-shell {
      display: block;
    }

    .admin-sidebar {
      position: sticky;
      top: 0;
      z-index: 50;
      width: 100%;
      height: auto;
      min-height: auto;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px;
      border-right: none;
      border-bottom:
        1px solid rgba(255,255,255,.07);
    }

    .sidebar-brand-text {
      display: none !important;
    }

    .nav {
      display: flex;
      gap: 5px;
      overflow-x: auto;
      flex: 1;
    }

    .nav-item {
      flex: 0 0 auto;
      width: auto;
      display: flex;
      grid-template-columns: none;
      padding: 8px 10px;
    }

    .nav-label {
      display: none !important;
    }

    .nav-count {
      min-width: 22px;
    }

    .sidebar-bottom {
      display: flex;
      align-items: center;
    }

    .admin-sidebar .admin-wrapper {
      display: grid !important;
      padding: 0;
    }

    .admin-sidebar .admin-logo {
      width: 58px;
      max-height: 28px;
    }

    .admin-sidebar .admin-text,
    .admin-sidebar .admin-link {
      display: none;
    }

    .admin-main {
      padding: 22px 14px 45px;
    }

    .stats-grid {
      grid-template-columns:
        repeat(2, minmax(0,1fr));
    }

    .posts-grid {
      grid-template-columns: 1fr;
    }

    .auth-card {
      padding: 28px 22px;
    }

    .auth-card h1 {
      font-size: 29px;
    }
  }
`;

export default Admin;