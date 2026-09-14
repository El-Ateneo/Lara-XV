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
import GuestControl from '../components/admin/GuestControl';
import './Admin.css';

const EVENT_ID =
  '90eabcfb-7104-4ebf-bd46-401d416f0c83';

const TABS = [
  {
    id: 'pending',
    label: 'Pendientes',
    shortLabel: 'Pendientes',
    icon: '◷',
  },
  {
    id: 'approved',
    label: 'Aprobados',
    shortLabel: 'Aprobados',
    icon: '✓',
  },
  {
    id: 'rejected',
    label: 'Rechazados',
    shortLabel: 'Rechazados',
    icon: '✕',
  },
  {
    id: 'trashed',
    label: 'Papelera',
    shortLabel: 'Papelera',
    icon: '🗑',
  },
];

const STATUS_LABELS = {
  pending: 'PENDIENTE',
  approved: 'APROBADO',
  rejected: 'RECHAZADO',
  trashed: 'PAPELERA',
};

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

  const [adminSection, setAdminSection] =
    useState('recuerdos');

  const [
    processingPostId,
    setProcessingPostId,
  ] = useState(null);

  /*
   * ==========================================
   * CARGAR RECUERDOS
   * ==========================================
   */

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

        setPosts(loaded);

        const urls = {};

        for (const post of loaded) {
          if (!post.storage_path) {
            continue;
          }

          try {
            const url =
              await getPostMediaUrl(
                post.id
              );

            if (url) {
              urls[post.id] =
                url;
            }
          } catch (
            mediaError
          ) {
            console.error(
              'Error obteniendo multimedia:',
              mediaError
            );
          }
        }

        setMediaUrls(urls);
      } catch (error) {
        console.error(error);

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

  /*
   * ==========================================
   * SESIÓN
   * ==========================================
   */

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
        } catch (error) {
          console.error(error);

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

  /*
   * ==========================================
   * REALTIME
   * ==========================================
   */

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

  /*
   * ==========================================
   * LOGIN
   * ==========================================
   */

  const handleLogin =
    async event => {
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
      } catch (error) {
        console.error(error);

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
      setSuccess('');
      setError('');
    };

  /*
   * ==========================================
   * MODERACIÓN MANUAL
   * ==========================================
   */

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
            .from(
              'event_posts'
            )
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
          status ===
            'approved'
            ? 'Recuerdo aprobado correctamente. ✓'
            : 'Recuerdo rechazado correctamente.'
        );
      } catch (error) {
        setError(
          error.message ||
            'No se pudo actualizar el recuerdo.'
        );
      } finally {
        setProcessingPostId(
          null
        );
      }
    };

  /*
   * ==========================================
   * PAPELERA
   * ==========================================
   */

  const sendToTrash =
    async post => {
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

        setError('');
        setSuccess('');

        await movePostToTrash(
          post.id
        );

        await loadPosts();

        setSuccess(
          'Recuerdo enviado a la papelera.'
        );
      } catch (error) {
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
    async post => {
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

        setError('');
        setSuccess('');

        await restorePost(
          post.id
        );

        await loadPosts();

        setSuccess(
          'Recuerdo restaurado correctamente.'
        );
      } catch (error) {
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
    async post => {
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

        setError('');
        setSuccess('');

        await deletePostPermanently(
          post.id
        );

        await loadPosts();

        setSuccess(
          'Recuerdo eliminado definitivamente.'
        );
      } catch (error) {
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

  /*
   * ==========================================
   * CONTADORES
   * ==========================================
   */

  const counts =
    useMemo(
      () => ({
        pending:
          posts.filter(
            post =>
              post.status ===
              'pending'
          ).length,

        approved:
          posts.filter(
            post =>
              post.status ===
              'approved'
          ).length,

        rejected:
          posts.filter(
            post =>
              post.status ===
              'rejected'
          ).length,

        trashed:
          posts.filter(
            post =>
              post.status ===
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
            post =>
              post.ai_status ===
              'safe'
          ).length,

        review:
          posts.filter(
            post =>
              post.ai_status ===
              'review'
          ).length,

        blocked:
          posts.filter(
            post =>
              post.ai_status ===
              'blocked'
          ).length,
      }),
      [posts]
    );

  const currentPosts =
    posts.filter(
      post =>
        post.status ===
        activeTab
    );

  const activeTabData =
    TABS.find(
      tab =>
        tab.id ===
        activeTab
    );

  /*
   * ==========================================
   * UTILIDADES
   * ==========================================
   */

  const formatDate =
    date =>
      date
        ? new Date(
            date
          ).toLocaleString(
            'es-AR',
            {
              dateStyle:
                'short',
              timeStyle:
                'short',
            }
          )
        : '';

  const formatSize =
    bytes => {
      if (!bytes) {
        return '0 B';
      }

      if (bytes < 1024) {
        return `${bytes} B`;
      }

      if (
        bytes <
        1024 * 1024
      ) {
        return `${(
          bytes / 1024
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

  const getModerationView =
    post => {
      const isVideo =
        post.file_type?.startsWith(
          'video/'
        );

      if (isVideo) {
        return {
          type: 'manual',
          title:
            'Revisión manual',
          badge: 'MANUAL',
          text:
            'Los videos se revisan manualmente.',
          showConfidence:
            false,
        };
      }

      switch (
        post.ai_status
      ) {
        case 'safe':
          return {
            type: 'safe',
            title:
              'Seguro por Gemini',
            badge: 'SEGURO',
            text:
              post.ai_reason ||
              'El contenido fue considerado seguro.',
            showConfidence:
              true,
          };

        case 'review':
          return {
            type: 'review',
            title:
              'Revisión recomendada',
            badge: 'REVISAR',
            text:
              post.ai_reason ||
              'Conviene revisar este contenido antes de aprobarlo.',
            showConfidence:
              true,
          };

        case 'blocked':
          return {
            type:
              'blocked',
            title:
              'Revisión necesaria',
            badge: 'REVISAR',
            text:
              post.ai_reason ||
              'Gemini detectó contenido que requiere revisión.',
            showConfidence:
              true,
          };

        case 'error':
          return {
            type: 'manual',
            title:
              'IA no disponible',
            badge: 'MANUAL',
            text:
              'El recuerdo quedó pendiente para revisión manual.',
            showConfidence:
              false,
          };

        default:
          return {
            type:
              'pending',
            title:
              'Analizando con Gemini',
            badge:
              'ANALIZANDO',
            text:
              'La revisión automática está en proceso.',
            showConfidence:
              false,
          };
      }
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
            className="admin-media video"
          />
        );
      }

      return (
        <img
          src={url}
          alt={`Recuerdo de ${
            post.author_name ||
            'invitado'
          }`}
          className="admin-media"
          loading="lazy"
          decoding="async"
        />
      );
    };

  /*
   * ==========================================
   * CARGANDO SESIÓN
   * ==========================================
   */

  if (
    checkingSession
  ) {
    return (
      <Shell>
        <div className="center-state">
          <div className="loading-symbol">
            ✦
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

  /*
   * ==========================================
   * LOGIN
   * ==========================================
   */

  if (!user) {
    return (
      <Shell>
        <div className="auth-page">
          <div className="auth-orb orb-one" />
          <div className="auth-orb orb-two" />

          <div className="auth-card">
            <div className="auth-crown">
              ♕
            </div>

            <div className="auth-name">
              LARA
            </div>

            <div className="auth-xv">
              XV
            </div>

            <div className="auth-decoration">
              <span />
              ✦
              <span />
            </div>

            <h1>
              Administración
            </h1>

            <p className="auth-description">
              Ingresá para gestionar
              los recuerdos del evento.
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
                  onChange={
                    event =>
                      setEmail(
                        event
                          .target
                          .value
                      )
                  }
                  autoComplete="email"
                  placeholder="admin@email.com"
                  required
                />
              </label>

              <label>
                Contraseña

                <input
                  type="password"
                  value={
                    password
                  }
                  onChange={
                    event =>
                      setPassword(
                        event
                          .target
                          .value
                      )
                  }
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                  required
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
                  : 'Ingresar'}
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

  /*
   * ==========================================
   * PANEL
   * ==========================================
   */

  return (
    <Shell>
      <div className="admin-shell">

        {/* =====================================
            SIDEBAR ESCRITORIO
        ===================================== */}

        <aside className="admin-sidebar">
          <div>
            <div className="sidebar-brand">
              <div className="brand-mark">
                L15
              </div>

              <div>
                <strong>
                  LARA XV
                </strong>

                <span>
                  Administración
                </span>
              </div>
            </div>

            <div className="sidebar-title">
              RECUERDOS
            </div>

            <nav className="desktop-nav">
              {TABS.map(
                tab => (
                  <button
                    key={
                      tab.id
                    }
                    className={
                      activeTab ===
                      tab.id
                        ? 'desktop-nav-item active'
                        : 'desktop-nav-item'
                    }
                    onClick={() =>
                      setActiveTab(
                        tab.id
                      )
                    }
                  >
                    <span className="desktop-nav-icon">
                      {
                        tab.icon
                      }
                    </span>

                    <span>
                      {
                        tab.label
                      }
                    </span>

                    <b>
                      {
                        counts[
                          tab.id
                        ]
                      }
                    </b>
                  </button>
                )
              )}
            </nav>

            <div className="sidebar-title">
              GEMINI
            </div>

            <div className="ai-sidebar">
              <div>
                <span>
                  <i className="dot safe" />
                  Seguros
                </span>

                <b>
                  {
                    aiCounts.safe
                  }
                </b>
              </div>

              <div>
                <span>
                  <i className="dot review" />
                  Revisar
                </span>

                <b>
                  {
                    aiCounts.review
                  }
                </b>
              </div>

              <div>
                <span>
                  <i className="dot blocked" />
                  Bloqueados
                </span>

                <b>
                  {
                    aiCounts.blocked
                  }
                </b>
              </div>
            </div>
          </div>

          <div className="sidebar-account">
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
                    user.email
                  }
                </span>
              </div>
            </div>

            <button
              className="desktop-logout"
              onClick={
                handleLogout
              }
            >
              ↪ Cerrar sesión
            </button>
          </div>
        </aside>

        {/* =====================================
            CONTENIDO
        ===================================== */}

        <main className="admin-main">

          {/* ===================================
              HEADER MÓVIL
          =================================== */}

          <header className="mobile-header">
            <div className="mobile-header-title">
              <span>
                ADMINISTRACIÓN
              </span>

              <strong>
                Lara XV
              </strong>
            </div>

            <div className="mobile-header-actions">
              <button
                onClick={
                  loadPosts
                }
                disabled={
                  loadingPosts
                }
                aria-label="Actualizar recuerdos"
              >
                ↻
              </button>

              <button
                className="mobile-logout"
                onClick={
                  handleLogout
                }
              >
                Salir ↪
              </button>
            </div>
          </header>

          {/* ===================================
              SECCIONES DEL PANEL
          =================================== */}

          <nav className="admin-section-switcher">
            <button
              type="button"
              className={
                adminSection === 'recuerdos'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setAdminSection('recuerdos')
              }
            >
              📸 Recuerdos
            </button>

            <button
              type="button"
              className={
                adminSection === 'ingreso'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setAdminSection('ingreso')
              }
            >
              🎟️ Control de ingreso
            </button>
          </nav>

          {adminSection === 'recuerdos' ? (
            <>

          {/* ===================================
              HEADER ESCRITORIO
          =================================== */}

          <header className="desktop-header">
            <div>
              <span className="page-kicker">
                ADMINISTRACIÓN · LARA XV
              </span>

              <h1>
                {
                  activeTabData
                    ?.label
                }
              </h1>

              <p>
                Gestioná los recuerdos
                compartidos por los invitados.
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
                ? 'Actualizando...'
                : 'Actualizar'}
            </button>
          </header>

          {/* ===================================
              NAVEGACIÓN MÓVIL
          =================================== */}

          <nav className="mobile-tabs">
            {TABS.map(
              tab => (
                <button
                  key={
                    tab.id
                  }
                  className={
                    activeTab ===
                    tab.id
                      ? 'mobile-tab active'
                      : 'mobile-tab'
                  }
                  onClick={() =>
                    setActiveTab(
                      tab.id
                    )
                  }
                >
                  <span className="mobile-tab-top">
                    <span>
                      {
                        tab.icon
                      }
                    </span>

                    <b>
                      {
                        counts[
                          tab.id
                        ]
                      }
                    </b>
                  </span>

                  <small>
                    {
                      tab.shortLabel
                    }
                  </small>
                </button>
              )
            )}
          </nav>

          {/* ===================================
              MENSAJES
          =================================== */}

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

          {/* ===================================
              RESUMEN ESCRITORIO
          =================================== */}

          <section className="desktop-stats">
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

          <section className="desktop-ai-summary">
            <div className="ai-summary-title">
              <div className="ai-orb">
                ✦
              </div>

              <div>
                <strong>
                  Moderación asistida
                </strong>

                <p>
                  Gemini revisa texto y fotos.
                  Los videos se revisan
                  manualmente.
                </p>
              </div>
            </div>

            <div className="ai-summary-values">
              <span>
                <b>
                  {
                    aiCounts.safe
                  }
                </b>
                seguros
              </span>

              <span>
                <b>
                  {
                    aiCounts.review
                  }
                </b>
                revisar
              </span>

              <span>
                <b>
                  {
                    aiCounts.blocked
                  }
                </b>
                bloqueados
              </span>
            </div>
          </section>

          {/* ===================================
              LISTADO
          =================================== */}

          <section className="posts-section">
            <div className="section-heading">
              <div>
                <span className="section-icon">
                  {
                    activeTabData
                      ?.icon
                  }
                </span>

                <div>
                  <h2>
                    {
                      activeTabData
                        ?.label
                    }
                  </h2>

                  <p>
                    {
                      currentPosts.length
                    }{' '}
                    {currentPosts.length ===
                    1
                      ? 'recuerdo'
                      : 'recuerdos'}
                  </p>
                </div>
              </div>
            </div>

            {loadingPosts &&
              currentPosts.length ===
                0 && (
              <EmptyState
                title="Cargando recuerdos"
                text="Preparando contenido..."
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

                  const moderation =
                    getModerationView(
                      post
                    );

                  const confidence =
                    typeof post.ai_score ===
                    'number'
                      ? `${Math.round(
                          post.ai_score *
                            100
                        )}%`
                      : null;

                  const autoApproved =
                    post.status ===
                      'approved' &&
                    post.moderation_source ===
                      'ai';

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
                      {/* CABECERA */}

                      <header className="post-card-header">
                        <div className="author">
                          <div className="avatar post">
                            {(post.author_name ||
                              'I')
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div className="author-data">
                            <strong>
                              {post.author_name ||
                                'Invitado'}
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
                            STATUS_LABELS[
                              post.status
                            ] ||
                            post.status
                          }
                        </span>
                      </header>

                      {/* MULTIMEDIA */}

                      {post.storage_path && (
                        <div className="media-box">
                          {
                            renderMedia(
                              post
                            )
                          }

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

                      {/* MENSAJE */}

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

                      {/* MODERACIÓN */}

                      <div
                        className={`moderation-box ${moderation.type}`}
                      >
                        <div className="moderation-header">
                          <div>
                            <span className="moderation-symbol">
                              {moderation.type ===
                              'manual'
                                ? '👤'
                                : '✦'}
                            </span>

                            <strong>
                              {
                                moderation.title
                              }
                            </strong>
                          </div>

                          <span
                            className={`moderation-pill ${moderation.type}`}
                          >
                            {
                              moderation.badge
                            }
                          </span>
                        </div>

                        {moderation.showConfidence &&
                          confidence && (
                          <div className="confidence-row">
                            <span>
                              Confianza
                            </span>

                            <strong>
                              {
                                confidence
                              }
                            </strong>
                          </div>
                        )}

                        <p>
                          {
                            moderation.text
                          }
                        </p>
                      </div>

                      {/* DECISIÓN */}

                      {autoApproved && (
                        <div className="decision ai">
                          ✦ Aprobado automáticamente
                          por Gemini
                        </div>
                      )}

                      {post.moderation_source ===
                        'manual' &&
                        post.status !==
                          'pending' && (
                          <div className="decision manual">
                            ✓ Decisión manual del
                            administrador
                          </div>
                        )}

                      {/* ACCIONES */}

                      <div className="actions">
                        {post.status !== 'approved' &&
                          post.status !== 'trashed' && (
                            <button
                              className="approve"
                              disabled={processing}
                              onClick={() =>
                                changeStatus(
                                  post.id,
                                  'approved'
                                )
                              }
                            >
                              ✓ Aprobar
                            </button>
                          )}

                        {post.status !== 'rejected' &&
                          post.status !== 'trashed' && (
                            <button
                              className="reject"
                              disabled={processing}
                              onClick={() =>
                                changeStatus(
                                  post.id,
                                  'rejected'
                                )
                              }
                            >
                              ✕ Rechazar
                            </button>
                          )}

                        {(post.status === 'approved' ||
                          post.status === 'rejected') && (
                            <button
                              className="pending-button"
                              disabled={processing}
                              onClick={() =>
                                changeStatus(
                                  post.id,
                                  'pending'
                                )
                              }
                            >
                              ↶ Volver a pendiente
                            </button>
                          )}

                        {post.status !== 'trashed' && (
                          <button
                            className="trash"
                            disabled={processing}
                            onClick={() =>
                              sendToTrash(post)
                            }
                          >
                            🗑 Enviar a papelera
                          </button>
                        )}

                        {post.status === 'trashed' && (
                          <>
                            <button
                              className="restore"
                              disabled={processing}
                              onClick={() =>
                                restore(post)
                              }
                            >
                              ↩ Restaurar
                            </button>

                            <button
                              className="delete"
                              disabled={processing}
                              onClick={() =>
                                permanentDelete(post)
                              }
                            >
                              ✕ Eliminar definitivamente
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

            </>
          ) : (
            <GuestControl />
          )}

          {/* ===================================
              FIRMA ALTEX
          =================================== */}

          <footer className="admin-footer">
            <div className="footer-line" />

            <AltexBrand variant="admin" />
          </footer>
        </main>
      </div>
    </Shell>
  );
}

/*
 * ==========================================
 * COMPONENTES
 * ==========================================
 */

function Shell({
  children,
}) {
  return <>{children}</>;
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

export default Admin;
