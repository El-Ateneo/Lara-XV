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



function GuestControl({ mode = 'ingreso' }) {

  const [guests, setGuests] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [search, setSearch] = useState('');


  const [relationFilter, setRelationFilter] =
    useState('all');

  const [relationMenuOpen, setRelationMenuOpen] =
    useState(false);

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

  /* =========================================
   RESPALDO LOCAL PARA CONTROL DE INGRESO
   ========================================= */

  const [offlinePrepared, setOfflinePrepared] =
    useState(false);

  const [offlinePreparedAt, setOfflinePreparedAt] =
    useState(null);

  const [preparingOffline, setPreparingOffline] =
    useState(false);
  
  const [isOnline, setIsOnline] =
  useState(navigator.onLine);

const [pendingSyncCount, setPendingSyncCount] =
  useState(0);

  const [addGuestOpen, setAddGuestOpen] =
    useState(false);

  const [savingGuest, setSavingGuest] =
    useState(false);

  const [addGuestError, setAddGuestError] =
    useState('');

  const [newGuest, setNewGuest] = useState({
    nombre: '',
    whatsapp: '',
    relacion: '',
    mesa: '',
    email: '',
    mensaje: '',
  });

  const [editGuestOpen, setEditGuestOpen] =
    useState(false);

  const [savingEditGuest, setSavingEditGuest] =
    useState(false);

  const [editGuestError, setEditGuestError] =
    useState('');

  const [editingGuest, setEditingGuest] =
    useState(null);

  const [editGuest, setEditGuest] =
    useState({
      id_invitado: '',
      nombre: '',
      whatsapp: '',
      relacion: '',
      mesa: '',
      email: '',
    });




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

          mensaje,

          mensaje_display,

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

      console.warn(
        'No se pudo cargar desde Supabase. Intentando copia local:',
        err
      );

      const backup = getOfflineBackup();
      function updatePendingSyncCount() {
        const backup = getOfflineBackup();

        const pending =
          Array.isArray(backup?.pendingEntries)
            ? backup.pendingEntries.length
            : 0;

        setPendingSyncCount(pending);
      }

      if (
        backup &&
        Array.isArray(backup.guests) &&
        backup.guests.length > 0
      ) {
        setGuests(backup.guests);

        setError('');

        console.log(
          `✓ ${backup.guests.length} invitados cargados desde la copia local.`
        );
      } else {
        console.error(
          'No hay copia local disponible:',
          err
        );

        setError(
          err?.message ||
            'No se pudieron cargar los invitados.'
        );
      }

    } finally {

      setLoading(false);

    }

  }, []);

  async function prepareOfflineEntry() {
    try {
      setPreparingOffline(true);

      const { data, error } = await supabase
        .from('invitados')
        .select('*')
        .order('nombre', {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error(
          'No se encontraron invitados para preparar.'
        );
      }

      const preparedAt =
        new Date().toISOString();

      const existingBackup =
        getOfflineBackup();

      const pendingEntries =
        Array.isArray(
          existingBackup?.pendingEntries
        )
          ? existingBackup.pendingEntries
          : [];

      const backup = {
        version: 1,
        preparedAt,
        guests: data,
        pendingEntries,
      };

      localStorage.setItem(
        'lara_xv_ingreso_offline',
        JSON.stringify(backup)
      );

      setOfflinePrepared(true);
      setOfflinePreparedAt(preparedAt);

      window.alert(
        `✓ Ingreso preparado correctamente\n\n${data.length} invitados guardados en este dispositivo.`
      );
    } catch (err) {
      console.error(
        'Error preparando ingreso:',
        err
      );

      window.alert(
        err?.message ||
          'No se pudo preparar el ingreso.'
      );
    } finally {
      setPreparingOffline(false);
    }
  }

  function getOfflineBackup() {
    try {
      const saved = localStorage.getItem(
        'lara_xv_ingreso_offline'
      );

      if (!saved) {
        return null;
      }

      const parsed = JSON.parse(saved);

      if (!Array.isArray(parsed?.guests)) {
        return null;
      }

      return parsed;
    } catch (err) {
      console.error(
        'Error leyendo copia local:',
        err
      );

      return null;
    }
  }

  function updatePendingSyncCount() {
    const backup = getOfflineBackup();

    const pending =
      Array.isArray(backup?.pendingEntries)
        ? backup.pendingEntries.length
        : 0;

    setPendingSyncCount(pending);
  }

  function saveOfflineBackup(backup) {
    try {
      localStorage.setItem(
        'lara_xv_ingreso_offline',
        JSON.stringify(backup)
      );

      return true;
    } catch (err) {
      console.error(
        'Error guardando copia local:',
        err
      );

      return false;
    }
  }

  function registerOfflineEntry(guest) {
    const backup = getOfflineBackup();

    if (!backup) {
      throw new Error(
        'No hay una copia local preparada en este dispositivo.'
      );
    }

    const now = new Date().toISOString();

    const guestIndex =
      backup.guests.findIndex(
        item =>
          item.id === guest.id ||
          normalizeCode(item.id_invitado) ===
            normalizeCode(guest.id_invitado)
      );

    if (guestIndex === -1) {
      throw new Error(
        'El invitado no existe en la copia local.'
      );
    }

    const localGuest =
      backup.guests[guestIndex];

    if (localGuest.ingreso === true) {
      return {
        alreadyEntered: true,
        guest: localGuest,
      };
    }

    const updatedGuest = {
      ...localGuest,
      ingreso: true,
      ingreso_fecha: now,
    };

    backup.guests[guestIndex] =
      updatedGuest;

    if (!Array.isArray(backup.pendingEntries)) {
      backup.pendingEntries = [];
    }

    const alreadyPending =
      backup.pendingEntries.some(
        entry =>
          normalizeCode(
            entry.id_invitado
          ) ===
          normalizeCode(
            updatedGuest.id_invitado
          )
      );

    if (!alreadyPending) {
      backup.pendingEntries.push({
        id: updatedGuest.id,
        id_invitado:
          updatedGuest.id_invitado,
        ingreso_fecha: now,
      });
    }

    const saved =
      saveOfflineBackup(backup);

    if (!saved) {
      throw new Error(
        'No se pudo guardar el ingreso en este dispositivo.'
      );
    }
    setPendingSyncCount(
      backup.pendingEntries.length
    );

    return {
      alreadyEntered: false,
      guest: updatedGuest,
    };
  }

  async function syncPendingEntries() {
    const backup = getOfflineBackup();

    if (
      !backup ||
      !Array.isArray(backup.pendingEntries) ||
      backup.pendingEntries.length === 0
    ) {
      return {
        synced: 0,
        remaining: 0,
      };
    }

    const remainingEntries = [];
    let synced = 0;

    for (const entry of backup.pendingEntries) {
      try {
        const {
          data,
          error,
        } = await supabase
          .from('invitados')
          .update({
            ingreso: true,
            ingreso_fecha:
              entry.ingreso_fecha,
          })
          .eq(
            'id',
            entry.id
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

        /*
        * Si data existe, este dispositivo
        * acaba de sincronizar el ingreso.
        */
        if (data) {
          try {
            const {
              error: notificationError,
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

            if (notificationError) {
              console.error(
                'Error notificando ingreso sincronizado:',
                notificationError
              );
            }
          } catch (notificationError) {
            console.error(
              'Error notificando ingreso sincronizado:',
              notificationError
            );
          }

          synced += 1;
          continue;
        }

        /*
        * Si Supabase no actualizó ninguna fila,
        * comprobamos si ya figura ingresado.
        */
        const {
          data: currentGuest,
          error: currentGuestError,
        } = await supabase
          .from('invitados')
          .select(`
            id,
            id_invitado,
            ingreso,
            ingreso_fecha
          `)
          .eq(
            'id',
            entry.id
          )
          .maybeSingle();

        if (currentGuestError) {
          throw currentGuestError;
        }

        if (currentGuest?.ingreso === true) {
          /*
          * Ya estaba registrado en Supabase.
          * Lo consideramos sincronizado sin
          * volver a notificar.
          */
          synced += 1;
          continue;
        }

        /*
        * No pudimos confirmar el ingreso.
        * Conservamos el pendiente.
        */
        remainingEntries.push(entry);

      } catch (err) {
        console.error(
          'Error sincronizando ingreso pendiente:',
          err
        );

        /*
        * Ante cualquier error conservamos
        * este ingreso para otro intento.
        */
        remainingEntries.push(entry);
      }
    }

    backup.pendingEntries =
      remainingEntries;

    saveOfflineBackup(backup);

    return {
      synced,
      remaining:
        remainingEntries.length,
    };
  }

  useEffect(() => {

    loadGuests();

  }, [loadGuests]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        'lara_xv_ingreso_offline'
      );

      if (!saved) {
        setOfflinePrepared(false);
        setOfflinePreparedAt(null);
        updatePendingSyncCount();
        return;
      }

      const parsed = JSON.parse(saved);

      if (
        Array.isArray(parsed?.guests) &&
        parsed.guests.length > 0
      ) {
        setOfflinePrepared(true);
        setOfflinePreparedAt(
          parsed.preparedAt || null
        );
      } else {
        setOfflinePrepared(false);
        setOfflinePreparedAt(null);
      }
    } catch (err) {
      console.error(
        'Error leyendo respaldo local:',
        err
      );

      setOfflinePrepared(false);
      setOfflinePreparedAt(null);
    }
    updatePendingSyncCount();
  }, []);

  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      updatePendingSyncCount();
    };

    const handleOnline = async () => {
      setIsOnline(true);
      updatePendingSyncCount();

      try {
        const result =
          await syncPendingEntries();

        updatePendingSyncCount();

        if (result.synced > 0) {
          console.log(
            `✓ ${result.synced} ingreso(s) pendiente(s) sincronizado(s).`
          );

          await loadGuests();
        }

        if (result.remaining > 0) {
          console.log(
            `${result.remaining} ingreso(s) continúan pendientes.`
          );
        }
      } catch (err) {
        console.error(
          'Error sincronizando al recuperar conexión:',
          err
        );

        updatePendingSyncCount();
      }
    };

    setIsOnline(navigator.onLine);
    updatePendingSyncCount();

    if (navigator.onLine) {
      handleOnline();
    }

    window.addEventListener(
      'online',
      handleOnline
    );

    window.addEventListener(
      'offline',
      handleOffline
    );

    return () => {
      window.removeEventListener(
        'online',
        handleOnline
      );

      window.removeEventListener(
        'offline',
        handleOffline
      );
    };
  }, []);

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

📩 También te enviamos un correo electrónico con estos mismos datos y el acceso a tu pase.&#x20;

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

 const relationCounts = useMemo(() => {
    return {
      all: guests.length,

      familia: guests.filter(
        guest =>
          guest.relacion === 'Familia'
      ).length,

      lara: guests.filter(
        guest =>
          guest.relacion === 'Amigo/a de Lara'
      ).length,

      papa: guests.filter(
        guest =>
          guest.relacion === 'Amigo/a de Papá'
      ).length,

      mama: guests.filter(
        guest =>
          guest.relacion === 'Amiga/o de Mamá'
      ).length,
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

      if (
        relationFilter === 'familia' &&
        guest.relacion !== 'Familia'
      ) {
        return false;
      }

      if (
        relationFilter === 'lara' &&
        guest.relacion !== 'Amigo/a de Lara'
      ) {
        return false;
      }

      if (
        relationFilter === 'papa' &&
        guest.relacion !== 'Amigo/a de Papá'
      ) {
        return false;
      }

      if (
        relationFilter === 'mama' &&
        guest.relacion !== 'Amiga/o de Mamá'
      ) {
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

    relationFilter,

  ]);



  const messageGuests = useMemo(() => {

    const value = search

      .trim()

      .toLowerCase();



    return guests

      .filter(guest => {

        const message = String(

          guest.mensaje || ''

        ).trim();



        if (!message) {

          return false;

        }



        if (!value) {

          return true;

        }



        return [

          guest.nombre,

          guest.id_invitado,

          guest.mensaje,

        ].some(field =>

          String(field ?? '')

            .toLowerCase()

            .includes(value)

        );

      })

      .sort((a, b) => {

        if (

          Boolean(a.mensaje_display) !==

          Boolean(b.mensaje_display)

        ) {

          return a.mensaje_display ? -1 : 1;

        }



        return String(a.nombre || '')

          .localeCompare(

            String(b.nombre || ''),

            'es'

          );

      });

  }, [guests, search]);



  const messageCounts = useMemo(() => {

    const withMessage = guests.filter(

      guest =>

        String(guest.mensaje || '')

          .trim()

    );



    return {

      total: withMessage.length,

      display: withMessage.filter(

        guest =>

          guest.mensaje_display === true

      ).length,

    };

  }, [guests]);



  function cleanGuestMessage(value) {

    return String(value || '')

      .replace(/<br\s*\/?>/gi, '\n')

      .replace(/&nbsp;/gi, ' ')

      .trim();

  }



  async function toggleMessageDisplay(guest) {

    if (!guest?.id) return;



    try {

      setProcessingGuestId(guest.id);



      const nextValue =

        guest.mensaje_display !== true;



      const { error } = await supabase

        .from('invitados')

        .update({

          mensaje_display: nextValue,

        })

        .eq('id', guest.id);



      if (error) {

        throw error;

      }



      setGuests(current =>

        current.map(item =>

          item.id === guest.id

            ? {

                ...item,

                mensaje_display:

                  nextValue,

              }

            : item

        )

      );

    } catch (err) {

      console.error(

        'Error actualizando mensaje:',

        err

      );



      window.alert(

        err?.message ||

          'No se pudo actualizar el mensaje.'

      );

    } finally {

      setProcessingGuestId(null);

    }

  }



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

        let guest = null;
        let usingOfflineBackup = false;

        try {
          const {
            data,
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

          guest = data;
        } catch (onlineError) {
          console.warn(
            'Consulta online no disponible. Usando copia local.',
            onlineError
          );

          const backup = getOfflineBackup();

          if (!backup) {
            throw onlineError;
          }

          guest =
            backup.guests.find(
              item =>
                normalizeCode(
                  item.id_invitado
                ) === code
            ) || null;

          usingOfflineBackup = true;
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



      let data = null;
      let registeredOffline = false;

      try {
        const {
          data: onlineData,
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

        data = onlineData;
      } catch (onlineError) {
        console.warn(
          'Registro online no disponible. Guardando ingreso local.',
          onlineError
        );

        const localResult =
          registerOfflineEntry(guest);

        if (localResult.alreadyEntered) {
          if (!manualGuest) {
            setScanResult({
              type: 'already',
              title: 'Ingreso ya registrado',
              message:
                'Este invitado ya había ingresado.',
              guest: localResult.guest,
            });
          } else {
            window.alert(
              `El ingreso de ${localResult.guest.nombre} ya estaba registrado.`
            );
          }

          return;
        }

        data = localResult.guest;
        registeredOffline = true;
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
      if (!registeredOffline) {

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



      if (registeredOffline) {
        setGuests(current =>
          current.map(item =>
            item.id === data.id
              ? {
                  ...item,
                  ingreso: true,
                  ingreso_fecha:
                    data.ingreso_fecha,
                }
              : item
          )
        );
      } else {
        await loadGuests();
      }

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




  function openAddGuest() {
    setAddGuestError('');
    setAddGuestOpen(true);
  }

  function closeAddGuest() {
    if (savingGuest) return;
    setAddGuestOpen(false);
    setAddGuestError('');
  }

  function updateNewGuest(field, value) {
    setNewGuest(current => ({ ...current, [field]: value }));
  }

  function openEditGuest(guest) {
    setEditGuestError('');

    setEditingGuest(guest);

    setEditGuest({
      id_invitado: guest.id_invitado || '',
      nombre: guest.nombre || '',
      whatsapp: guest.whatsapp || '',
      relacion: guest.relacion || '',
      mesa: guest.mesa || '',
      email: guest.email || '',
    });

    setEditGuestOpen(true);
  }


  function closeEditGuest() {
    if (savingEditGuest) return;

    setEditGuestOpen(false);
    setEditGuestError('');
    setEditingGuest(null);

    setEditGuest({
      id_invitado: '',
      nombre: '',
      whatsapp: '',
      relacion: '',
      mesa: '',
      email: '',
    });
  }


  function updateEditGuest(field, value) {
    setEditGuest(current => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveEditGuest(event) {
    event.preventDefault();

    const idInvitado =
      editGuest.id_invitado.trim().toUpperCase();

    const nombre =
      editGuest.nombre.trim();

    const whatsapp =
      editGuest.whatsapp.trim();


    if (!idInvitado) {
      setEditGuestError(
        'No se pudo identificar al invitado.'
      );
      return;
    }


    if (!nombre) {
      setEditGuestError(
        'Ingresá el nombre y apellido del invitado.'
      );
      return;
    }


    if (!whatsapp) {
      setEditGuestError(
        'Ingresá un número de WhatsApp.'
      );
      return;
    }


    try {
      setSavingEditGuest(true);
      setEditGuestError('');


      const {
        data,
        error: functionError,
      } = await supabase.functions.invoke(
        'editar-invitado',
        {
          body: {
            id_invitado: idInvitado,
            nombre,
            whatsapp,
            relacion:
              editGuest.relacion.trim(),
            mesa:
              editGuest.mesa.trim(),
            email:
              editGuest.email.trim(),
          },
        }
      );


      if (functionError) {
        throw functionError;
      }


      if (!data?.ok) {
        throw new Error(
          data?.error ||
            'No se pudieron guardar los cambios.'
        );
      }


      setEditGuestOpen(false);
      setEditGuestError('');
      setEditingGuest(null);

      setEditGuest({
        id_invitado: '',
        nombre: '',
        whatsapp: '',
        relacion: '',
        mesa: '',
        email: '',
      });


      await loadGuests();


      window.alert(
        `✓ Datos actualizados correctamente\n\n${data?.invitado?.nombre || nombre}`
      );

    } catch (err) {
      console.error(
        'Error editando invitado:',
        err
      );

      setEditGuestError(
        err?.message ||
          'No se pudieron guardar los cambios.'
      );

    } finally {
      setSavingEditGuest(false);
    }
  }

  async function createGuest(event) {
    event.preventDefault();
    const nombre = newGuest.nombre.trim();
    const whatsapp = newGuest.whatsapp.trim();

    if (!nombre) {
      setAddGuestError('Ingresá el nombre y apellido del invitado.');
      return;
    }
    if (!whatsapp) {
      setAddGuestError('Ingresá un número de WhatsApp.');
      return;
    }

    try {
      setSavingGuest(true);
      setAddGuestError('');
      const { data, error: functionError } = await supabase.functions.invoke(
        'crear-invitado',
        {
          body: {
            nombre,
            whatsapp,
            relacion: newGuest.relacion.trim(),
            mesa: newGuest.mesa.trim(),
            email: newGuest.email.trim(),
            mensaje: newGuest.mensaje.trim(),
          },
        }
      );

      if (functionError) throw functionError;
      if (!data?.ok) {
        throw new Error(data?.error || 'No se pudo agregar el invitado.');
      }

      const createdGuest = data?.invitado;
      setNewGuest({ nombre: '', whatsapp: '', relacion: '', mesa: '', email: '', mensaje: '' });
      setAddGuestOpen(false);
      await loadGuests();

      window.alert(
        `✓ Invitado agregado correctamente\n\n${createdGuest?.nombre || nombre}${
          createdGuest?.id_invitado ? `\n${createdGuest.id_invitado}` : ''
        }\n\nYa está disponible en Control de ingreso.`
      );
    } catch (err) {
      console.error('Error agregando invitado:', err);
      setAddGuestError(err?.message || 'No se pudo agregar el invitado.');
    } finally {
      setSavingGuest(false);
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



  if (mode === 'mensajes') {

    return (

      <section className="guest-control">

        <header className="guest-control-header">

          <div>

            <span className="guest-control-kicker">

              ADMINISTRACIÓN · LARA XV

            </span>



            <h1>

              💛 Mensajes para Lara

            </h1>



            <p>

              Revisá los mensajes de las confirmaciones

              y elegí cuáles se mostrarán en Display.

            </p>

          </div>

        </header>


        <div className="guest-stats">

          <div className="guest-stat active">

            <span>Mensajes</span>

            <strong>{messageCounts.total}</strong>

          </div>



          <div className="guest-stat guest-stat-success">

            <span>En Display</span>

            <strong>{messageCounts.display}</strong>

          </div>



          <div className="guest-stat guest-stat-pending">

            <span>Ocultos</span>

            <strong>

              {messageCounts.total -

                messageCounts.display}

            </strong>

          </div>

        </div>



        <div className="guest-tools">

          <div className="guest-search">

            <span>⌕</span>



            <input

              type="search"

              value={search}

              onChange={event =>

                setSearch(event.target.value)

              }

              placeholder="Buscar por nombre o mensaje..."

            />



            {search && (

              <button

                type="button"

                onClick={() => setSearch('')}

                aria-label="Limpiar búsqueda"

              >

                ×

              </button>

            )}

          </div>

        </div>



        {error && (

          <div className="guest-error">

            <strong>

              No se pudieron cargar los mensajes.

            </strong>

            <span>{error}</span>

          </div>

        )}



        {!error &&

          loading &&

          guests.length === 0 && (

            <div className="guest-empty">

              Cargando mensajes...

            </div>

          )}



        {!error &&

          !loading &&

          messageGuests.length === 0 && (

            <div className="guest-empty">

              {search

                ? 'No encontramos mensajes con esa búsqueda.'

                : 'Todavía no hay mensajes para Lara.'}

            </div>

          )}



        {messageGuests.length > 0 && (

          <div

            style={{

              display: 'grid',

              gap: '16px',

              marginTop: '18px',

            }}

          >

            {messageGuests.map(guest => {

              const visible =

                guest.mensaje_display === true;



              const processing =

                processingGuestId === guest.id;



              return (

                <article

                  key={guest.id}

                  className="guest-card"

                  style={{

                    border: visible

                      ? '1px solid rgba(217,174,92,.75)'

                      : undefined,

                  }}

                >

                  <div className="guest-card-main">

                    <div

                      className={

                        visible

                          ? 'guest-avatar entered'

                          : 'guest-avatar'

                      }

                    >

                      {(guest.nombre || 'I')

                        .charAt(0)

                        .toUpperCase()}

                    </div>



                    <div className="guest-card-info">

                      <div className="guest-name-row">

                        <h3>{guest.nombre}</h3>



                        <span

                          className={

                            visible

                              ? 'guest-status entered'

                              : 'guest-status pending'

                          }

                        >

                          {visible

                            ? '● EN DISPLAY'

                            : '○ OCULTO'}

                        </span>

                      </div>



                      <div

                        style={{

                          whiteSpace: 'pre-wrap',

                          lineHeight: 1.65,

                          marginTop: '12px',

                          fontSize: '1rem',

                        }}

                      >

                        “{cleanGuestMessage(

                          guest.mensaje

                        )}”

                      </div>



                      <div

                        style={{

                          display: 'flex',

                          gap: '10px',

                          flexWrap: 'wrap',

                          marginTop: '16px',

                        }}

                      >

                        <button

                          type="button"

                          className={

                            visible

                              ? 'guest-whatsapp-button resend'

                              : 'guest-open-scanner'

                          }

                          disabled={processing}

                          onClick={() =>

                            toggleMessageDisplay(

                              guest

                            )

                          }

                        >

                          {processing

                            ? 'Guardando...'

                            : visible

                              ? 'Ocultar del Display'

                              : '✓ Mostrar en Display'}

                        </button>

                      </div>

                    </div>

                  </div>

                </article>

              );

            })}

          </div>

        )}

      </section>

    );

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

      <div
        className={
          offlinePrepared
            ? 'guest-offline-preparation prepared'
            : 'guest-offline-preparation'
        }
      >
        <div className="guest-offline-preparation-info">
          <span className="guest-offline-preparation-icon">
            {offlinePrepared ? '✓' : '↓'}
          </span>

          <div>
            <strong>
              {offlinePrepared
                ? 'Ingreso preparado'
                : 'Preparar ingreso'}
            </strong>

            <small>
              {offlinePrepared && offlinePreparedAt
                ? `Copia local actualizada ${formatDate(
                    offlinePreparedAt
                  )}`
                : 'Guardá los invitados en este dispositivo antes del evento.'}
            </small>
            <div className="guest-sync-status">
              <span
                className={
                  isOnline
                    ? 'guest-sync-dot online'
                    : 'guest-sync-dot offline'
                }
              />

              <span>
                {!isOnline
                  ? pendingSyncCount > 0
                    ? `Sin conexión · ${pendingSyncCount} ${
                        pendingSyncCount === 1
                          ? 'ingreso pendiente'
                          : 'ingresos pendientes'
                      }`
                    : 'Trabajando sin conexión'
                  : pendingSyncCount > 0
                    ? `Conectado · Sincronizando ${pendingSyncCount} ${
                        pendingSyncCount === 1
                          ? 'ingreso'
                          : 'ingresos'
                      }`
                    : 'Conectado · Todo sincronizado'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={prepareOfflineEntry}
          disabled={preparingOffline}
        >
          {preparingOffline
            ? 'Preparando...'
            : offlinePrepared
              ? 'Actualizar'
              : 'Preparar'}
        </button>
      </div>

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

      <div className="guest-relation-filter">
        <button
          type="button"
          className={
            relationMenuOpen
              ? 'guest-relation-toggle active'
              : 'guest-relation-toggle'
          }
          onClick={() =>
            setRelationMenuOpen(current => !current)
          }
          aria-expanded={relationMenuOpen}
        >
          <div>
            <span>CLASIFICAR INVITADOS</span>

            <strong>
              {relationFilter === 'all' && 'Todos'}
              {relationFilter === 'familia' && 'Familia'}
              {relationFilter === 'lara' && 'Amigos de Lara'}
              {relationFilter === 'papa' && 'Amigos de Papá'}
              {relationFilter === 'mama' && 'Amigos de Mamá'}
            </strong>
          </div>

          <span className="guest-relation-arrow">
            {relationMenuOpen ? '▲' : '▼'}
          </span>
        </button>

        {relationMenuOpen && (
          <div className="guest-relation-options">
            <button
              type="button"
              className={relationFilter === 'all' ? 'active' : ''}
              onClick={() => {
                setRelationFilter('all');
                setRelationMenuOpen(false);
              }}
            >
              <span>Todos</span>
              <strong>{relationCounts.all}</strong>
            </button>

            <button
              type="button"
              className={relationFilter === 'familia' ? 'active' : ''}
              onClick={() => {
                setRelationFilter('familia');
                setRelationMenuOpen(false);
              }}
            >
              <span>Familia</span>
              <strong>{relationCounts.familia}</strong>
            </button>

            <button
              type="button"
              className={relationFilter === 'lara' ? 'active' : ''}
              onClick={() => {
                setRelationFilter('lara');
                setRelationMenuOpen(false);
              }}
            >
              <span>Amigos de Lara</span>
              <strong>{relationCounts.lara}</strong>
            </button>

            <button
              type="button"
              className={relationFilter === 'papa' ? 'active' : ''}
              onClick={() => {
                setRelationFilter('papa');
                setRelationMenuOpen(false);
              }}
            >
              <span>Amigos de Papá</span>
              <strong>{relationCounts.papa}</strong>
            </button>

            <button
              type="button"
              className={relationFilter === 'mama' ? 'active' : ''}
              onClick={() => {
                setRelationFilter('mama');
                setRelationMenuOpen(false);
              }}
            >
              <span>Amigos de Mamá</span>
              <strong>{relationCounts.mama}</strong>
            </button>
          </div>
        )}
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
          className="guest-add-button"
          onClick={openAddGuest}
        >
          <span>＋</span>
          <div>
            <strong>Agregar invitado</strong>
            <small>Alta manual</small>
          </div>
        </button>


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



      {addGuestOpen && (
        <div className="guest-add-modal" role="dialog" aria-modal="true" aria-labelledby="guest-add-title">
          <div className="guest-add-backdrop" onClick={closeAddGuest} />
          <div className="guest-add-panel">
            <div className="guest-add-header">
              <div>
                <span>ADMINISTRACIÓN · LARA XV</span>
                <h2 id="guest-add-title">Agregar invitado</h2>
                <p>Creá un invitado sin usar el formulario de confirmación.</p>
              </div>
              <button type="button" className="guest-add-close" onClick={closeAddGuest} disabled={savingGuest} aria-label="Cerrar">×</button>
            </div>

            <form className="guest-add-form" onSubmit={createGuest}>
              <label className="guest-add-field guest-add-field-full">
                <span>Nombre y apellido *</span>
                <input type="text" value={newGuest.nombre} onChange={event => updateNewGuest('nombre', event.target.value)} placeholder="Ej. Juan Pérez" autoComplete="name" disabled={savingGuest} required />
              </label>

              <label className="guest-add-field guest-add-field-full">
                <span>WhatsApp *</span>
                <input type="tel" value={newGuest.whatsapp} onChange={event => updateNewGuest('whatsapp', event.target.value)} placeholder="Ej. 387 555 1234" autoComplete="tel" inputMode="tel" disabled={savingGuest} required />
              </label>

              <label className="guest-add-field guest-add-field-full">
                <span>Relación</span>
                <select value={newGuest.relacion} onChange={event => updateNewGuest('relacion', event.target.value)} disabled={savingGuest}>
                  <option value="">Sin especificar</option>
                  <option value="Familia">Familia</option>
                  <option value="Amigo/a de Lara">Amigo/a de Lara</option>
                  <option value="Amigo/a de Papá">Amigo/a de Papá</option>
                  <option value="Amiga/o de Mamá">Amiga/o de Mamá</option>
                </select>
              </label>

              <label className="guest-add-field">
                <span>Mesa</span>
                <input type="text" value={newGuest.mesa} onChange={event => updateNewGuest('mesa', event.target.value)} placeholder="Sin asignar" disabled={savingGuest} />
              </label>

              <label className="guest-add-field">
                <span>Email</span>
                <input type="email" value={newGuest.email} onChange={event => updateNewGuest('email', event.target.value)} placeholder="Opcional" autoComplete="email" disabled={savingGuest} />
              </label>

              <label className="guest-add-field guest-add-field-full">
                <span>Mensaje para Lara</span>
                <textarea value={newGuest.mensaje} onChange={event => updateNewGuest('mensaje', event.target.value)} placeholder="Opcional" rows="3" disabled={savingGuest} />
              </label>

              {addGuestError && (
                <div className="guest-add-error guest-add-field-full">{addGuestError}</div>
              )}

              <div className="guest-add-actions guest-add-field-full">
                <button type="button" className="guest-add-cancel" onClick={closeAddGuest} disabled={savingGuest}>Cancelar</button>
                <button type="submit" className="guest-add-submit" disabled={savingGuest}>
                  {savingGuest ? 'Agregando...' : '+ Agregar invitado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editGuestOpen && (
        <div
          className="guest-add-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-edit-title"
        >
          <div
            className="guest-add-backdrop"
            onClick={closeEditGuest}
          />

          <div className="guest-add-panel">
            <div className="guest-add-header">
              <div>
                <span>
                  ADMINISTRACIÓN · LARA XV
                </span>

                <h2 id="guest-edit-title">
                  Editar invitado
                </h2>

                <p>
                  Actualizá los datos del invitado sin modificar su pase ni código QR.
                </p>
              </div>

              <button
                type="button"
                className="guest-add-close"
                onClick={closeEditGuest}
                disabled={savingEditGuest}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>


            <form
              className="guest-add-form"
              onSubmit={saveEditGuest}
            >
              <label className="guest-add-field guest-add-field-full">
                <span>Nombre y apellido *</span>

                <input
                  type="text"
                  value={editGuest.nombre}
                  onChange={event =>
                    updateEditGuest(
                      'nombre',
                      event.target.value
                    )
                  }
                  autoComplete="name"
                  disabled={savingEditGuest}
                  required
                />
              </label>


              <label className="guest-add-field guest-add-field-full">
                <span>WhatsApp *</span>

                <input
                  type="tel"
                  value={editGuest.whatsapp}
                  onChange={event =>
                    updateEditGuest(
                      'whatsapp',
                      event.target.value
                    )
                  }
                  autoComplete="tel"
                  inputMode="tel"
                  disabled={savingEditGuest}
                  required
                />
              </label>


              <label className="guest-add-field guest-add-field-full">
                <span>Relación</span>

                <select
                  value={editGuest.relacion}
                  onChange={event =>
                    updateEditGuest(
                      'relacion',
                      event.target.value
                    )
                  }
                  disabled={savingEditGuest}
                >
                  <option value="">
                    Sin especificar
                  </option>

                  <option value="Familia">
                    Familia
                  </option>

                  <option value="Amigo/a de Lara">
                    Amigo/a de Lara
                  </option>

                  <option value="Amigo/a de Papá">
                    Amigo/a de Papá
                  </option>

                  <option value="Amiga/o de Mamá">
                    Amiga/o de Mamá
                  </option>
                </select>
              </label>


              <label className="guest-add-field">
                <span>Mesa</span>

                <input
                  type="text"
                  value={editGuest.mesa}
                  onChange={event =>
                    updateEditGuest(
                      'mesa',
                      event.target.value
                    )
                  }
                  placeholder="Sin asignar"
                  disabled={savingEditGuest}
                />
              </label>


              <label className="guest-add-field">
                <span>Email</span>

                <input
                  type="email"
                  value={editGuest.email}
                  onChange={event =>
                    updateEditGuest(
                      'email',
                      event.target.value
                    )
                  }
                  placeholder="Opcional"
                  autoComplete="email"
                  disabled={savingEditGuest}
                />
              </label>


              <div className="guest-add-field guest-add-field-full">
                <span>ID del invitado</span>

                <input
                  type="text"
                  value={editGuest.id_invitado}
                  disabled
                  readOnly
                />
              </div>


              {editGuestError && (
                <div className="guest-add-error guest-add-field-full">
                  {editGuestError}
                </div>
              )}


              <div className="guest-add-actions guest-add-field-full">
                <button
                  type="button"
                  className="guest-add-cancel"
                  onClick={closeEditGuest}
                  disabled={savingEditGuest}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="guest-add-submit"
                  disabled={savingEditGuest}
                >
                  {savingEditGuest
                    ? 'Guardando...'
                    : '✓ Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

                        <button
                          type="button"
                          className="guest-edit-button"
                          onClick={() => openEditGuest(guest)}
                          disabled={savingEditGuest}
                        >
                          <span>✎</span>
                          Editar datos
                        </button>

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

                              className={

                                guest.whatsapp_enviado

                                  ? 'guest-whatsapp-button resend'

                                  : 'guest-whatsapp-button'

                              }

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
