import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Scanner,
} from '@yudiel/react-qr-scanner';

import { supabase } from '../../lib/supabase';

import './GuestControl.css';

function GuestControl() {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [guestFilter, setGuestFilter] =
    useState('all');

  
  const [
    whatsappFilter,
    setWhatsappFilter,
  ] = useState('all');

  const [
    processingGuestId,
    setProcessingGuestId,
  ] = useState(null);

  const [
    whatsappPendingGuest,
    setWhatsappPendingGuest,
  ] = useState(null);

  const [scannerOpen, setScannerOpen] =
    useState(false);

  const [scannerPaused, setScannerPaused] =
    useState(false);

  const [scannerError, setScannerError] =
    useState('');

  const [scanResult, setScanResult] =
    useState(null);

  const [processingScan, setProcessingScan] =
    useState(false);

  const [lastScannedCode, setLastScannedCode] =
    useState('');

  const lastScanRef = useRef('');

  const loadGuests = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('invitados')
        .select(`
          id,
          id_invitado,
          nombre,
          asistencia,
          whatsapp,
          whatsapp_enviado,
          whatsapp_enviado_fecha,
          email,
          relacion,
          mesa,
          estado,
          ingreso,
          ingreso_fecha,
          pase_url,
          created_at
        `)
        .order('nombre', {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      setGuests(data ?? []);
    } catch (err) {
      console.error(
        'Error cargando invitados:',
        err
      );

      setError(
        err?.message ||
          'No se pudieron cargar los invitados.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGuests();
  }, [loadGuests]);
  useEffect(() => {
    const channel = supabase
      .channel('invitados-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invitados',
        },
        payload => {
          console.log(
            'Cambio en invitados:',
            payload
          );

          loadGuests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadGuests]);


  const abrirWhatsApp = guest => {
    const rawPhone = String(
      guest.whatsapp || ''
    ).replace(/\D/g, '');

    if (!rawPhone) {
      window.alert(
        'Este invitado no tiene un número de WhatsApp registrado.'
      );
      return;
    }

    let phone = rawPhone;

    if (!phone.startsWith('54')) {
      phone = `549${phone}`;
    }

    const firstName =
      String(guest.nombre || '')
        .trim()
        .split(/\s+/)[0] ||
      'invitado';

    const paseUrl =
      guest.pase_url ||
      `https://recuerdos-lara-mis-xv.vercel.app/pase/${encodeURIComponent(
        guest.id_invitado
      )}`;

    const mensaje =
`Hola ${firstName} 👋

Gracias por confirmar tu asistencia a los XV de Lara. 💛

Te compartimos tu pase personal para este día tan especial:

${paseUrl}

Desde el enlace podés ver y descargar tu código QR. Guardalo para presentarlo al momento de ingresar.
📩 También te enviamos un correo electrónico con estos mismos datos y el acceso a tu pase. 
Si no lo encontrás en tu bandeja de entrada, revisá la carpeta de Spam o Correo no deseado.


¡Te esperamos! ✨
Lara · Mis XV`;

    const url =
      `https://wa.me/${phone}?text=${encodeURIComponent(
        mensaje
      )}`;

    window.open(
      url,
      '_blank',
      'noopener,noreferrer'
    );

    setWhatsappPendingGuest(guest);
  };
  async function marcarWhatsAppEnviado(
  guest
) {
  if (!guest?.id) return;

  try {
    setProcessingGuestId(
      guest.id
    );

    const now =
      new Date().toISOString();

    const { error } =
      await supabase
        .from('invitados')
        .update({
          whatsapp_enviado: true,
          whatsapp_enviado_fecha: now,
        })
        .eq('id', guest.id);

    if (error) {
      throw error;
    }

    setWhatsappPendingGuest(
      null
    );

    await loadGuests();
  } catch (err) {
    console.error(
      'Error actualizando WhatsApp:',
      err
    );

    window.alert(
      err?.message ||
        'No se pudo marcar el WhatsApp como enviado.'
    );
  } finally {
    setProcessingGuestId(
      null
    );
  }
}

  const counts = useMemo(() => {
    const confirmed = guests.filter(
      guest => isConfirmedGuest(guest)
    );

    const entered = guests.filter(
      guest => guest.ingreso === true
    );

    const pending = confirmed.filter(
      guest => guest.ingreso !== true
    );
    const whatsappSent =
      confirmed.filter(
        guest =>
          guest.whatsapp &&
          guest.whatsapp_enviado ===
            true
      );

    const whatsappPending =
      confirmed.filter(
        guest =>
          guest.whatsapp &&
          guest.whatsapp_enviado !==
            true
      );

    return {
      total: guests.length,
      confirmados: confirmed.length,
      ingresaron: entered.length,
      pendientes: pending.length,
      whatsappEnviados: whatsappSent.length,
      whatsappPendientes: whatsappPending.length,
    };
  }, [guests]);

  const filteredGuests = useMemo(() => {
    const value = search
      .trim()
      .toLowerCase();

    return guests.filter(guest => {
      const confirmed =
        isConfirmedGuest(guest);

      const entered =
        guest.ingreso === true;

      let matchesFilter = true;

      if (
        guestFilter === 'confirmed'
      ) {
        matchesFilter =
          confirmed;
      }

      if (
        guestFilter === 'entered'
      ) {
        matchesFilter =
          entered;
      }

      if (
        guestFilter === 'pending'
      ) {
        matchesFilter =
          confirmed &&
          !entered;
      }

      if (
        whatsappFilter ===
        'sent'
      ) {
        matchesFilter =
          matchesFilter &&
          guest.whatsapp &&
          guest.whatsapp_enviado ===
            true;
      }

      if (
        whatsappFilter ===
        'pending'
      ) {
        matchesFilter =
          matchesFilter &&
          confirmed &&
          guest.whatsapp &&
          guest.whatsapp_enviado !==
            true;
      }

      if (!matchesFilter) {
        return false;
      }

      if (!value) {
        return true;
      }

      const fields = [
        guest.nombre,
        guest.id_invitado,
        guest.relacion,
        guest.whatsapp,
        guest.email,
        guest.mesa,
      ];

      return fields.some(field =>
        String(field ?? '')
          .toLowerCase()
          .includes(value)
      );
    });
  }, [
    guests,
    search,
    guestFilter,
    whatsappFilter,
  ]);

  function formatDate(value) {
    if (!value) {
      return null;
    }

    return new Intl.DateTimeFormat(
      'es-AR',
      {
        timeZone:
          'America/Argentina/Salta',
        dateStyle: 'short',
        timeStyle: 'short',
      }
    ).format(
      new Date(value)
    );
  }

  function normalizeCode(value) {
    if (!value) {
      return '';
    }

    let code =
      String(value).trim();

    try {
      if (
        code.startsWith('http://') ||
        code.startsWith('https://')
      ) {
        const url =
          new URL(code);

        const parts =
          url.pathname
            .split('/')
            .filter(Boolean);

        const paseIndex =
          parts.indexOf('pase');

        if (
          paseIndex !== -1 &&
          parts[paseIndex + 1]
        ) {
          code =
            parts[paseIndex + 1];
        }
      }
    } catch {
      // Si no es una URL válida,
      // usamos el contenido tal cual.
    }

    return code
      .trim()
      .toUpperCase();
  }

  const verifyGuest = useCallback(
    async rawCode => {
      const code =
        normalizeCode(rawCode);

      if (!code) {
        return;
      }

      if (
        processingScan ||
        lastScanRef.current === code
      ) {
        return;
      }

      lastScanRef.current = code;

      setLastScannedCode(code);
      setProcessingScan(true);
      setScannerPaused(true);
      setScannerError('');
      setScanResult(null);

      try {
        const {
          data: guest,
          error: guestError,
        } = await supabase
          .from('invitados')
          .select(`
            id,
            id_invitado,
            nombre,
            asistencia,
            whatsapp,
            email,
            relacion,
            mesa,
            estado,
            ingreso,
            ingreso_fecha
          `)
          .eq(
            'id_invitado',
            code
          )
          .maybeSingle();

        if (guestError) {
          throw guestError;
        }

        if (!guest) {
          setScanResult({
            type: 'invalid',
            title: 'QR inválido',
            message:
              'No encontramos ningún invitado asociado a este código.',
            code,
          });

          return;
        }

        const confirmado =
          isConfirmedGuest(guest);

        if (!confirmado) {
          setScanResult({
            type: 'invalid',
            title:
              'Invitado no confirmado',
            message:
              'Este invitado no figura como confirmado.',
            guest,
            code,
          });

          return;
        }

        if (
          guest.ingreso === true
        ) {
          setScanResult({
            type: 'already',
            title:
              'Ingreso ya registrado',
            message:
              'Este QR ya fue utilizado.',
            guest,
            code,
          });

          return;
        }

        setScanResult({
          type: 'valid',
          title:
            'Invitado válido',
          message:
            'QR verificado correctamente. Podés registrar el ingreso.',
          guest,
          code,
        });
      } catch (err) {
        console.error(
          'Error verificando QR:',
          err
        );

        setScanResult({
          type: 'error',
          title:
            'Error de verificación',
          message:
            err?.message ||
            'No se pudo verificar el invitado.',
          code,
        });
      } finally {
        setProcessingScan(false);
      }
    },
    [processingScan]
  );

  async function registerEntry(
    manualGuest = null
  ) {
    const guest =
      manualGuest ||
      scanResult?.guest;

    if (!guest?.id) {
      return;
    }

    if (
      guest.ingreso === true
    ) {
      window.alert(
        `El ingreso de ${guest.nombre} ya está registrado${
          guest.ingreso_fecha
            ? ` desde ${formatDate(
                guest.ingreso_fecha
              )}`
            : ''
        }.`
      );

      return;
    }

    if (manualGuest) {
      const confirmed =
        window.confirm(
          `¿Registrar el ingreso de ${guest.nombre}?\n\nCódigo: ${guest.id_invitado}\nMesa: ${
            guest.mesa ||
            'Sin asignar'
          }`
        );

      if (!confirmed) {
        return;
      }
    }

    try {
      if (manualGuest) {
        setProcessingGuestId(
          guest.id
        );
      } else {
        setProcessingScan(true);
      }

      const now =
        new Date().toISOString();

      const {
        data,
        error,
      } = await supabase
        .from('invitados')
        .update({
          ingreso: true,
          ingreso_fecha: now,
        })
        .eq(
          'id',
          guest.id
        )
        .eq(
          'ingreso',
          false
        )
        .select(`
          id,
          id_invitado,
          nombre,
          asistencia,
          whatsapp,
          whatsapp_enviado,
          whatsapp_enviado_fecha,
          email,
          relacion,
          mesa,
          estado,
          ingreso,
          ingreso_fecha
        `)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        const {
          data: currentGuest,
          error: currentError,
        } = await supabase
          .from('invitados')
          .select(`
            id,
            id_invitado,
            nombre,
            mesa,
            estado,
            ingreso,
            ingreso_fecha
          `)
          .eq(
            'id',
            guest.id
          )
          .maybeSingle();

        if (currentError) {
          throw currentError;
        }

        if (
          currentGuest?.ingreso
        ) {
          if (!manualGuest) {
            setScanResult({
              type: 'already',
              title:
                'Ingreso ya registrado',
              message:
                'Este invitado ya había ingresado.',
              guest:
                currentGuest,
            });
          } else {
            window.alert(
              `El ingreso de ${currentGuest.nombre} ya estaba registrado.`
            );
          }

          await loadGuests();

          return;
        }

        throw new Error(
          'No se pudo registrar el ingreso.'
        );
      }

      /*
      * Tanto QR como ingreso manual
      * utilizan la misma notificación.
      */
      try {
        const {
          error:
            notificationError,
        } =
          await supabase
            .functions
            .invoke(
              'notificar-ingreso',
              {
                body: {
                  id_invitado:
                    data.id_invitado,
                },
              }
            );

        if (
          notificationError
        ) {
          console.error(
            'Error notificando ingreso:',
            notificationError
          );
        }
      } catch (
        notificationError
      ) {
        console.error(
          'Error notificando ingreso:',
          notificationError
        );
      }

      if (manualGuest) {
        window.alert(
          `✓ Ingreso registrado\n\n${data.nombre}${
            data.mesa
              ? `\nMesa ${data.mesa}`
              : ''
          }`
        );
      } else {
        setScanResult({
          type: 'success',
          title:
            'Ingreso registrado',
          message:
            'El invitado puede ingresar.',
          guest: data,
        });
      }

      await loadGuests();
    } catch (err) {
      console.error(
        'Error registrando ingreso:',
        err
      );

      if (manualGuest) {
        window.alert(
          err?.message ||
            'No se pudo registrar el ingreso.'
        );
      } else {
        setScanResult(prev => ({
          ...prev,
          type: 'error',
          title:
            'No se pudo registrar',
          message:
            err?.message ||
            'Ocurrió un error al registrar el ingreso.',
        }));
      }
    } finally {
      setProcessingScan(false);
      setProcessingGuestId(
        null
      );
    }
  }

  function resetScanner() {
    setScanResult(null);
    setScannerError('');
    setLastScannedCode('');
    lastScanRef.current = '';
    setScannerPaused(false);
  }

  function closeScanner() {
    setScannerOpen(false);
    resetScanner();
  }

  function openScanner() {
    resetScanner();
    setScannerOpen(true);
  }

  return (
    <section className="guest-control">
      <header className="guest-control-header">
        <div>
          <span className="guest-control-kicker">
            ADMINISTRACIÓN · LARA XV
          </span>

          <h1>
            Control de ingreso
          </h1>

          <p>
            Escaneá el QR del invitado
            o buscá sus datos manualmente.
          </p>
        </div>


      </header>

      <div className="guest-stats">
        <button
          type="button"
          className={
            guestFilter === 'all'
              ? 'guest-stat active'
              : 'guest-stat'
          }
          onClick={() =>
            setGuestFilter('all')
          }
        >
          <span>
            Invitados
          </span>

          <strong>
            {counts.total}
          </strong>
        </button>

        <button
          type="button"
          className={
            guestFilter ===
            'confirmed'
              ? 'guest-stat active'
              : 'guest-stat'
          }
          onClick={() =>
            setGuestFilter(
              'confirmed'
            )
          }
        >
          <span>
            Confirmados
          </span>

          <strong>
            {counts.confirmados}
          </strong>
        </button>

        <button
          type="button"
          className={
            guestFilter ===
            'entered'
              ? 'guest-stat guest-stat-success active'
              : 'guest-stat guest-stat-success'
          }
          onClick={() =>
            setGuestFilter(
              'entered'
            )
          }
        >
          <span>
            Ingresaron
          </span>

          <strong>
            {counts.ingresaron}
          </strong>
        </button>

        <button
          type="button"
          className={
            guestFilter ===
            'pending'
              ? 'guest-stat guest-stat-pending active'
              : 'guest-stat guest-stat-pending'
          }
          onClick={() =>
            setGuestFilter(
              'pending'
            )
          }
        >
          <span>
            Pendientes
          </span>

          <strong>
            {counts.pendientes}
          </strong>
        </button>
      </div>

      <div className="guest-whatsapp-filters">
        <button
          type="button"
          className={
            whatsappFilter === 'all'
              ? 'active'
              : ''
          }
          onClick={() =>
            setWhatsappFilter('all')
          }
        >
          Todos los WhatsApp
        </button>

        <button
          type="button"
          className={
            whatsappFilter ===
            'pending'
              ? 'active'
              : ''
          }
          onClick={() =>
            setWhatsappFilter(
              'pending'
            )
          }
        >
          ⏳ Pendientes (
          {counts.whatsappPendientes})
        </button>

        <button
          type="button"
          className={
            whatsappFilter === 'sent'
              ? 'active'
              : ''
          }
          onClick={() =>
            setWhatsappFilter(
              'sent'
            )
          }
        >
          ✓ Enviados (
          {counts.whatsappEnviados})
        </button>
      </div>

      <div className="guest-tools">
        <div className="guest-search">
          <span>
            ⌕
          </span>

          <input
            type="search"
            value={search}
            onChange={event =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Buscar por nombre, QR, WhatsApp o mesa..."
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch('')
              }
              aria-label="Limpiar búsqueda"
            >
              ×
            </button>
          )}
        </div>

        <button
          type="button"
          className="guest-open-scanner"
          onClick={openScanner}
        >
          <span>
            ▣
          </span>

          <div>
            <strong>
              Escanear QR
            </strong>

            <small>
              Abrir cámara
            </small>
          </div>
        </button>
      </div>

      {scannerOpen && (
        <div
          className="scanner-modal"
          role="dialog"
          aria-modal="true"
        >
          <div className="scanner-backdrop" />

          <div className="scanner-panel">
            <div className="scanner-header">
              <div>
                <span>
                  CONTROL DE INGRESO
                </span>

                <h2>
                  Escanear invitación
                </h2>
              </div>

              <button
                type="button"
                className="scanner-close"
                onClick={
                  closeScanner
                }
                aria-label="Cerrar escáner"
              >
                ×
              </button>
            </div>

            {!scanResult && (
              <>
                <div className="scanner-camera">
                  <Scanner
                    formats={[
                      'qr_code',
                    ]}
                    onScan={codes => {
                      const value =
                        codes?.[0]
                          ?.rawValue;

                      if (value) {
                        verifyGuest(
                          value
                        );
                      }
                    }}
                    onError={err => {
                      console.error(
                        'Error de cámara:',
                        err
                      );

                      setScannerError(
                        err?.message ||
                          'No se pudo acceder a la cámara.'
                      );
                    }}
                    constraints={{
                      facingMode:
                        'environment',
                      width: {
                        ideal: 1280,
                      },
                      height: {
                        ideal: 1280,
                      },
                    }}
                    paused={
                      scannerPaused
                    }
                    scanDelay={500}
                    allowMultiple={
                      false
                    }
                    components={{
                      finder: true,
                      torch: true,
                      zoom: false,
                      onOff: false,
                    }}
                  />

                  <div className="scanner-guide">
                    Apuntá la cámara
                    al código QR
                  </div>
                </div>

                {scannerError && (
                  <div className="scanner-error">
                    {scannerError}
                  </div>
                )}
              </>
            )}

            {processingScan && (
              <div className="scan-loading">
                Verificando invitado...
              </div>
            )}

            {scanResult && (
              <ScanResultCard
                result={
                  scanResult
                }
                processing={
                  processingScan
                }
                onRegister={() =>
                  registerEntry()
                }
                onScanAnother={
                  resetScanner
                }
                onClose={
                  closeScanner
                }
                formatDate={
                  formatDate
                }
              />
            )}

            {!scanResult &&
              lastScannedCode && (
                <div className="scanner-code">
                  {
                    lastScannedCode
                  }
                </div>
              )}
          </div>
        </div>
      )}

      {error && (
        <div className="guest-error">
          <strong>
            No se pudieron cargar los invitados.
          </strong>

          <span>
            {error}
          </span>
        </div>
      )}

      {!error &&
        loading &&
        guests.length === 0 && (
          <div className="guest-empty">
            Cargando invitados...
          </div>
        )}

      {!error &&
        !loading &&
        filteredGuests.length ===
          0 && (
          <div className="guest-empty">
            {search
              ? 'No encontramos invitados con esa búsqueda.'
              : 'No hay invitados en este filtro.'}
          </div>
        )}

      {filteredGuests.length >
        0 && (
        <>
          <div className="guest-results-heading">
            <span>
              {getFilterTitle(
                guestFilter
              )}
            </span>

            <strong>
              {
                filteredGuests.length
              }
            </strong>
          </div>

          <div className="guest-list">
            {filteredGuests.map(
              guest => {
                const entered =
                  guest.ingreso ===
                  true;

                return (
                  <article
                    className="guest-card"
                    key={guest.id}
                  >
                    <div className="guest-card-main">
                      <div
                        className={
                          entered
                            ? 'guest-avatar entered'
                            : 'guest-avatar'
                        }
                      >
                        {(guest.nombre ||
                          'I')
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="guest-card-info">
                        <div className="guest-name-row">
                          <h3>
                            {
                              guest.nombre
                            }
                          </h3>

                          <span
                            className={
                              entered
                                ? 'guest-status entered'
                                : 'guest-status pending'
                            }
                          >
                            {entered
                              ? '● INGRESÓ'
                              : '○ PENDIENTE'}
                          </span>
                        </div>

                        <div className="guest-meta">
                          <span>
                            <small>
                              ID
                            </small>

                            <b>
                              {
                                guest.id_invitado
                              }
                            </b>
                          </span>

                          <span>
                                <small>RELACIÓN</small>
                                <b>
                                {guest.relacion || 'Sin especificar'}
                                </b>
                            </span>

                          <span>
                            <small>
                              MESA
                            </small>

                            <b>
                              {guest.mesa ||
                                'Sin asignar'}
                            </b>
                          </span>

                          {guest.whatsapp && (
                            <span>
                              <small>
                                WHATSAPP
                              </small>

                              <b>
                                {
                                  guest.whatsapp
                                }
                              </b>
                            </span>
                          )}
                        </div>

                        {entered &&
                          guest.ingreso_fecha && (
                            <p className="guest-entry-date">
                              Ingreso registrado:{' '}
                              <strong>
                                {formatDate(
                                  guest.ingreso_fecha
                                )}
                              </strong>
                            </p>
                          )}
                        
                        {isConfirmedGuest(guest) &&
                          !entered && (
                            <button
                              type="button"
                              className="guest-manual-entry-button"
                              disabled={
                                processingGuestId ===
                                guest.id
                              }
                              onClick={() =>
                                registerEntry(guest)
                              }
                            >
                              {processingGuestId ===
                              guest.id
                                ? 'Registrando...'
                                : '✓ Registrar ingreso'}
                            </button>
                          )}

                        {guest.whatsapp && (
                          <div className="guest-contact-actions">
                            <div
                              className={
                                guest.whatsapp_enviado
                                  ? 'guest-whatsapp-state sent'
                                  : 'guest-whatsapp-state pending'
                              }
                            >
                              <strong>
                                {guest.whatsapp_enviado
                                  ? '✓ WhatsApp enviado'
                                  : '⏳ WhatsApp pendiente'}
                              </strong>

                              {guest.whatsapp_enviado &&
                                guest.whatsapp_enviado_fecha && (
                                  <small>
                                    {formatDate(
                                      guest.whatsapp_enviado_fecha
                                    )}
                                  </small>
                                )}
                            </div>

                            <button
                              type="button"
                              className="guest-whatsapp-button"
                              onClick={() =>
                                abrirWhatsApp(guest)
                              }
                            >
                              {guest.whatsapp_enviado
                                ? 'Reenviar pase por WhatsApp'
                                : 'Enviar pase por WhatsApp'}
                            </button>

                            {whatsappPendingGuest?.id ===
                              guest.id && (
                              <button
                                type="button"
                                className="guest-whatsapp-confirm"
                                disabled={
                                  processingGuestId ===
                                  guest.id
                                }
                                onClick={() =>
                                  marcarWhatsAppEnviado(
                                    guest
                                  )
                                }
                              >
                                {processingGuestId ===
                                guest.id
                                  ? 'Guardando...'
                                  : '✓ Marcar como enviado'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </>
      )}
    </section>
  );
}

function isConfirmedGuest(
  guest
) {
  const asistencia =
    String(
      guest?.asistencia ?? ''
    )
      .trim()
      .toLowerCase();

  return (
    guest?.estado ===
      'CONFIRMADO' ||
    asistencia.startsWith('sí') ||
    asistencia.startsWith('si')
  );
}

function getFilterTitle(
  filter
) {
  if (
    filter === 'confirmed'
  ) {
    return 'Invitados confirmados';
  }

  if (
    filter === 'entered'
  ) {
    return 'Invitados que ingresaron';
  }

  if (
    filter === 'pending'
  ) {
    return 'Pendientes de ingreso';
  }

  return 'Lista de invitados';
}

function ScanResultCard({
  result,
  processing,
  onRegister,
  onScanAnother,
  onClose,
  formatDate,
}) {
  const guest = result?.guest;

  const statusConfig = {
    valid: {
      icon: '✓',
      label: 'INVITADO VÁLIDO',
    },

    success: {
      icon: '✓',
      label: 'PUEDE INGRESAR',
    },

    already: {
      icon: '!',
      label: 'YA INGRESÓ',
    },

    invalid: {
      icon: '×',
      label: 'NO AUTORIZADO',
    },

    error: {
      icon: '×',
      label: 'ERROR',
    },
  };

  const config =
    statusConfig[result.type] ||
    statusConfig.error;

  return (
    <div
      className={`scan-result scan-result-${result.type}`}
    >
      <div className="scan-result-status">
        <div className="scan-result-icon">
          {config.icon}
        </div>

        <span className="scan-result-label">
          {config.label}
        </span>
      </div>

      <h3 className="scan-result-title">
        {result.title}
      </h3>

      <p className="scan-result-message">
        {result.message}
      </p>

      {guest && (
        <div className="scan-guest">
          <div className="scan-guest-name">
            {guest.nombre}
          </div>

          {guest.relacion && (
            <div className="scan-guest-relation">
              {guest.relacion}
            </div>
          )}

          <div className="scan-guest-divider" />

          <div className="scan-guest-table">
            <span>MESA</span>

            <strong>
              {guest.mesa ||
                'SIN ASIGNAR'}
            </strong>
          </div>

          <div className="scan-guest-details">
            <div>
              <span>ID INVITADO</span>

              <strong>
                {guest.id_invitado}
              </strong>
            </div>

            {guest.ingreso_fecha && (
              <div>
                <span>
                  HORA DE INGRESO
                </span>

                <strong>
                  {formatDate(
                    guest.ingreso_fecha
                  )}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="scan-result-actions">
        {result.type === 'valid' && (
          <button
            type="button"
            className="scan-confirm"
            onClick={onRegister}
            disabled={processing}
          >
            {processing
              ? 'Registrando...'
              : '✓ Registrar ingreso'}
          </button>
        )}

        <button
          type="button"
          className="scan-again"
          onClick={onScanAnother}
          disabled={processing}
        >
          ▣ Escanear otro
        </button>

        <button
          type="button"
          className="scan-finish"
          onClick={onClose}
          disabled={processing}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

export default GuestControl;
