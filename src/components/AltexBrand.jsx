import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const PORTFOLIO_URL =
  'https://cloud-ready-ops.vercel.app/';

const LOGO_PRIMARY =
  'https://res.cloudinary.com/dl81eetla/image/upload/q_auto/f_auto/v1775768400/logo2_rfm9jf.png';

const LOGO_FALLBACK =
  'https://github.com/El-Ateneo/altex-servicio-tecnico/blob/main/web-app-manifest-512x512.png?raw=true';

function AltexBrand({
  variant = 'guest',
  showQr = false,
}) {
  const [logoSrc, setLogoSrc] =
    useState(LOGO_PRIMARY);

  if (variant === 'display') {
    return (
      <div style={styles.displayWrapper}>
        <div style={styles.displayQrCard}>
          {showQr && (
            <div style={styles.qrFrame}>
              <QRCodeSVG
                value={PORTFOLIO_URL}
                size={112}
                bgColor="#ffffff"
                fgColor="#10131d"
                level="H"
              />
            </div>
          )}

          <img
            src={logoSrc}
            alt="AlTeX"
            onError={() => {
              if (logoSrc !== LOGO_FALLBACK) {
                setLogoSrc(LOGO_FALLBACK);
              }
            }}
            style={styles.displayLogo}
          />

          <div style={styles.displayText}>
            Desarrollado por AlTeX
          </div>

          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noreferrer"
            style={styles.displayLink}
          >
            Ver portfolio ↗
          </a>
        </div>
      </div>
    );
  }

  if (variant === 'admin') {
    return (
      <div style={styles.adminWrapper}>
        <img
          src={logoSrc}
          alt="AlTeX"
          onError={() => {
            if (logoSrc !== LOGO_FALLBACK) {
              setLogoSrc(LOGO_FALLBACK);
            }
          }}
          style={styles.adminLogo}
        />

        <span style={styles.adminText}>
          Desarrollado por AlTeX
        </span>

        <a
          href={PORTFOLIO_URL}
          target="_blank"
          rel="noreferrer"
          style={styles.adminLink}
        >
          Portfolio ↗
        </a>
      </div>
    );
  }

  return (
    <div style={styles.guestWrapper}>
      <div style={styles.guestLine} />

      <span style={styles.guestDeveloped}>
        Desarrollado por
      </span>

      <a
        href={PORTFOLIO_URL}
        target="_blank"
        rel="noreferrer"
        style={styles.guestBrandLink}
      >
        <img
          src={logoSrc}
          alt="AlTeX"
          onError={() => {
            if (logoSrc !== LOGO_FALLBACK) {
              setLogoSrc(LOGO_FALLBACK);
            }
          }}
          style={styles.guestLogo}
        />
      </a>

      <a
        href={PORTFOLIO_URL}
        target="_blank"
        rel="noreferrer"
        style={styles.guestPortfolio}
      >
        Ver portfolio ↗
      </a>
    </div>
  );
}

const styles = {
  guestWrapper: {
    marginTop: '45px',
    paddingBottom: '15px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    color: '#777',
  },

  guestLine: {
    width: '100%',
    maxWidth: '420px',
    height: '1px',
    background:
      'linear-gradient(90deg, transparent, rgba(212,170,116,.35), transparent)',
    marginBottom: '12px',
  },

  guestDeveloped: {
    fontSize: '11px',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },

  guestBrandLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  guestLogo: {
    width: '78px',
    height: 'auto',
    maxHeight: '42px',
    objectFit: 'contain',
    opacity: 0.9,
  },

  guestPortfolio: {
    color: '#9a7b4f',
    textDecoration: 'none',
    fontSize: '12px',
    fontWeight: 700,
  },

  displayWrapper: {
    position: 'fixed',
    right: '24px',
    bottom: '22px',
    zIndex: 20,
  },

  displayQrCard: {
    minWidth: '155px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '7px',
    border:
      '1px solid rgba(255,255,255,.10)',
    borderRadius: '18px',
    background:
      'rgba(7,10,18,.78)',
    boxShadow:
      '0 18px 50px rgba(0,0,0,.35)',
    backdropFilter: 'blur(18px)',
  },

  qrFrame: {
    padding: '7px',
    borderRadius: '11px',
    background: '#fff',
  },

  displayLogo: {
    width: '74px',
    height: 'auto',
    maxHeight: '38px',
    objectFit: 'contain',
    opacity: 0.92,
  },

  displayText: {
    color: '#e4dfd7',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '.7px',
  },

  displayLink: {
    color: '#c8a86f',
    textDecoration: 'none',
    fontSize: '10px',
    fontWeight: 700,
  },

  adminWrapper: {
    display: 'grid',
    justifyItems: 'center',
    gap: '7px',
    padding:
      '14px 8px 4px',
  },

  adminLogo: {
    width: '82px',
    height: 'auto',
    maxHeight: '42px',
    objectFit: 'contain',
    opacity: 0.88,
  },

  adminText: {
    color: '#777f91',
    fontSize: '10px',
    textAlign: 'center',
  },

  adminLink: {
    color: '#c8a86f',
    textDecoration: 'none',
    fontSize: '11px',
    fontWeight: 800,
  },
};

export default AltexBrand;