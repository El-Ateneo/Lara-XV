import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

import { supabase } from '../lib/supabase';
import AltexBrand from '../components/AltexBrand';

import './Pase.css';

const AUTO_REFRESH_MS = 10000;

export default function Pase() {
  const { id } = useParams();

  const [guest, setGuest] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [downloading, setDownloading] =
    useState(false);

  const qrContainerRef =
    useRef(null);

  const guestRef =
    useRef(null);

  useEffect(() => {
    guestRef.current = guest;
  }, [guest]);

  const cargarPase =
    useCallback(
      async ({
        initial = false,
      } = {}) => {
        const code =
          String(id || '')
            .trim()
            .toUpperCase();

        if (!code) {
          setGuest(null);
          setError(
            'El código del pase no es válido.'
          );
          setLoading(false);
          return;
        }

        if (initial) {
          setLoading(true);
          setError('');
        }

        try {
          const {
            data,
            error: rpcError,
          } =
            await supabase.rpc(
              'obtener_pase',
              {
                p_id_invitado:
                  code,
              }
            );

          if (rpcError) {
            throw rpcError;
          }

          const result =
            Array.isArray(data)
              ? data[0]
              : data;

          if (!result) {
            setGuest(null);

            if (initial) {
              setError(
                'No encontramos este pase.'
              );
            }

            return;
          }

          const estado =
            String(
              result.estado || ''
            )
              .trim()
              .toUpperCase();

          if (
            estado !==
            'CONFIRMADO'
          ) {
            setGuest(null);
            setError(
              'Este pase no se encuentra habilitado.'
            );
            return;
          }

          /*
           * Solo actualizamos el estado
           * si realmente cambió algo.
           *
           * Esto evita renders innecesarios
           * cada 10 segundos.
           */
          const previous =
            guestRef.current;

          const changed =
            !previous ||
            previous.id_invitado !==
              result.id_invitado ||
            previous.nombre !==
              result.nombre ||
            previous.mesa !==
              result.mesa ||
            previous.estado !==
              result.estado;

          if (changed) {
            setGuest(result);
          }

          setError('');
        } catch (err) {
          console.error(
            'Error cargando pase:',
            err
          );

          /*
           * Si el pase ya estaba cargado,
           * no lo ocultamos por un fallo
           * momentáneo de conexión.
           */
          if (!guestRef.current) {
            setError(
              'No pudimos cargar el pase. Intentá nuevamente.'
            );
          }
        } finally {
          if (initial) {
            setLoading(false);
          }
        }
      },
      [id]
    );

  /*
   * Primera carga.
   */
  useEffect(() => {
    cargarPase({
      initial: true,
    });
  }, [cargarPase]);

  /*
   * Actualización automática.
   *
   * Consultamos nuevamente el RPC
   * seguro cada 10 segundos.
   *
   * De esta forma los cambios de MESA
   * aparecen sin refrescar la página.
   */
  useEffect(() => {
    if (!id) {
      return undefined;
    }

    const interval =
      window.setInterval(
        () => {
          /*
           * Si la pestaña está visible,
           * verificamos cambios.
           */
          if (
            document.visibilityState ===
            'visible'
          ) {
            cargarPase();
          }
        },
        AUTO_REFRESH_MS
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    id,
    cargarPase,
  ]);

  /*
   * Cuando el invitado vuelve a la
   * pestaña también comprobamos cambios
   * inmediatamente.
   */
  useEffect(() => {
    const handleVisibility =
      () => {
        if (
          document.visibilityState ===
          'visible'
        ) {
          cargarPase();
        }
      };

    document.addEventListener(
      'visibilitychange',
      handleVisibility
    );

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      );
    };
  }, [cargarPase]);

  const descargarQR =
    async () => {
      if (
        !guest ||
        !qrContainerRef.current
      ) {
        return;
      }

      try {
        setDownloading(true);

        const svg =
          qrContainerRef.current
            .querySelector('svg');

        if (!svg) {
          throw new Error(
            'No se encontró el QR.'
          );
        }

        /*
         * Copiamos el SVG para no modificar
         * el QR visible en pantalla.
         */
        const clonedSvg =
          svg.cloneNode(true);

        const qrSize = 900;
        const margin = 90;
        const canvasSize =
          qrSize +
          margin * 2;

        clonedSvg.setAttribute(
          'width',
          String(qrSize)
        );

        clonedSvg.setAttribute(
          'height',
          String(qrSize)
        );

        /*
         * El namespace ayuda a que el SVG
         * pueda renderizarse correctamente
         * como imagen.
         */
        clonedSvg.setAttribute(
          'xmlns',
          'http://www.w3.org/2000/svg'
        );

        const serializer =
          new XMLSerializer();

        const svgString =
          serializer
            .serializeToString(
              clonedSvg
            );

        const blob =
          new Blob(
            [svgString],
            {
              type:
                'image/svg+xml;charset=utf-8',
            }
          );

        const objectUrl =
          URL.createObjectURL(
            blob
          );

        const image =
          new Image();

        await new Promise(
          (
            resolve,
            reject
          ) => {
            image.onload =
              resolve;

            image.onerror =
              reject;

            image.src =
              objectUrl;
          }
        );

        const canvas =
          document.createElement(
            'canvas'
          );

        canvas.width =
          canvasSize;

        canvas.height =
          canvasSize;

        const ctx =
          canvas.getContext(
            '2d'
          );

        if (!ctx) {
          throw new Error(
            'No se pudo preparar la imagen.'
          );
        }

        /*
         * Fondo blanco.
         *
         * Esto es importante para asegurar
         * una buena lectura del QR cuando
         * se guarda o comparte.
         */
        ctx.fillStyle =
          '#ffffff';

        ctx.fillRect(
          0,
          0,
          canvasSize,
          canvasSize
        );

        ctx.drawImage(
          image,
          margin,
          margin,
          qrSize,
          qrSize
        );

        URL.revokeObjectURL(
          objectUrl
        );

        const pngBlob =
          await new Promise(
            resolve => {
              canvas.toBlob(
                resolve,
                'image/png',
                1
              );
            }
          );

        if (!pngBlob) {
          throw new Error(
            'No se pudo generar el PNG.'
          );
        }

        const downloadUrl =
          URL.createObjectURL(
            pngBlob
          );

        const link =
          document.createElement(
            'a'
          );

        link.href =
          downloadUrl;

        link.download =
          `QR-${guest.id_invitado}.png`;

        document.body.appendChild(
          link
        );

        link.click();

        link.remove();

        window.setTimeout(
          () => {
            URL.revokeObjectURL(
              downloadUrl
            );
          },
          1000
        );
      } catch (err) {
        console.error(
          'Error descargando QR:',
          err
        );

        window.alert(
          'No se pudo descargar el QR. Intentá nuevamente.'
        );
      } finally {
        setDownloading(false);
      }
    };

  if (loading) {
    return (
      <main className="pass-page">
        <div className="pass-shell">
          <div className="pass-loading">
            <div className="pass-crown">
              ♕
            </div>

            <p>
              Cargando pase...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (
    error ||
    !guest
  ) {
    return (
      <main className="pass-page">
        <div className="pass-shell">
          <section className="pass-error">
            <div className="pass-crown">
              ♕
            </div>

            <div className="pass-name">
              LARA
            </div>

            <div className="pass-xv">
              XV
            </div>

            <div className="pass-rule">
              <span />
              ✦ ✦ ✦
              <span />
            </div>

            <h1>
              Pase no disponible
            </h1>

            <p>
              {error ||
                'No encontramos este pase.'}
            </p>
          </section>

          <footer className="pass-footer">
            <AltexBrand variant="guest" />
          </footer>
        </div>
      </main>
    );
  }

  const mesa =
    String(
      guest.mesa || ''
    ).trim();

  return (
    <main className="pass-page">
      <div className="pass-shell">
        <header className="pass-hero">
          <div className="pass-crown">
            ♕
          </div>

          <div className="pass-name">
            LARA
          </div>

          <div className="pass-xv">
            XV
          </div>

          <div className="pass-rule">
            <span />
            ✦ ✦ ✦
            <span />
          </div>

          <p className="pass-kicker">
            PASE PERSONAL
          </p>

          <h1>
            {guest.nombre}
          </h1>
        </header>

        <section className="pass-card">
          <p className="pass-label">
            MESA
          </p>

          <div className="pass-table-number">
            {mesa ||
              'A confirmar'}
          </div>

          <div
            className="pass-qr"
            ref={
              qrContainerRef
            }
          >
            <QRCodeSVG
              value={
                guest.id_invitado
              }
              size={230}
              level="H"
              includeMargin={
                false
              }
              bgColor="#ffffff"
              fgColor="#111318"
            />
          </div>

          <p className="pass-id">
            {
              guest.id_invitado
            }
          </p>

          <button
            type="button"
            className="pass-download-button"
            onClick={
              descargarQR
            }
            disabled={
              downloading
            }
          >
            {downloading
              ? 'Preparando QR...'
              : '↓ Descargar QR'}
          </button>

          <p className="pass-download-note">
            Guardá este QR para presentarlo al ingresar.
          </p>

          <p className="pass-note">
            Este pase es personal.
            Presentá el código QR
            al momento de ingresar.
          </p>
        </section>

        <footer className="pass-footer">
          <div className="pass-rule">
            <span />
            ♕ ♕ ♕
            <span />
          </div>

          <AltexBrand variant="guest" />
        </footer>
      </div>
    </main>
  );
}