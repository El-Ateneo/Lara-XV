import { useState } from 'react';
import AltexBrand from '../components/AltexBrand';
import './Regalo.css';

const LARA_PHOTO_URL =
  'https://res.cloudinary.com/dl81eetla/image/upload/v1788752908/IMG-20260525-WA0088_tm8ya1.jpg';

const DATA = {
  titular: 'Hortensia Barja',
  cuit: '27-31066688-8',
  cbu: '2850100640094072127198',
  alias: 'lara-frias-mis-xv',
  cuenta: 'CA ARS 410009407212719',
  entidad: 'Banco Macro S.A.',
  concepto: '15 Lara',
};

export default function Regalo() {
  const [copied, setCopied] = useState('');

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopied('error');
      setTimeout(() => setCopied(''), 1800);
    }
  };

  return (
    <div className="gift-page">
      <div
        className="gift-photo"
        style={{ backgroundImage: `url("${LARA_PHOTO_URL}")` }}
      />
      <div className="gift-overlay" />
      <div className="gift-butterfly b1">🦋</div>
      <div className="gift-butterfly b2">🦋</div>
      <div className="gift-butterfly b3">🦋</div>
      <div className="gift-butterfly b4">🦋</div>

      <main className="gift-container">
        <header className="gift-hero">
          <div className="gift-crown">♕</div>
          <div className="gift-name">LARA</div>
          <div className="gift-xv">XV</div>
          <div className="gift-rule"><span />✦ ✦ ✦<span /></div>

          <p className="gift-kicker">UN DETALLE PARA MÍ</p>
          <h1>Tu presencia es mi mejor regalo</h1>
          <p className="gift-intro">
            Lo más importante para mí es poder compartir este momento con vos.
            <br />
            Si además deseás hacerme un regalo, podés hacerlo a través de estos datos.
          </p>
        </header>

        <section className="gift-card">
          <div className="gift-icon">🎁</div>

          <CopyBox
            label="ALIAS"
            value={DATA.alias}
            copied={copied === 'alias'}
            buttonLabel="Copiar alias"
            onClick={() => copy(DATA.alias, 'alias')}
          />

          <CopyBox
            label="CBU"
            value={DATA.cbu}
            copied={copied === 'cbu'}
            buttonLabel="Copiar CBU"
            onClick={() => copy(DATA.cbu, 'cbu')}
          />

          <div className="gift-details">
            <Row label="Titular" value={DATA.titular} />
            <Row label="CUIT/CUIL" value={DATA.cuit} />
            <Row label="Cuenta" value={DATA.cuenta} />
            <Row label="Entidad" value={DATA.entidad} />
          </div>

          <div className="gift-concept">
            <small>REFERENCIA O MOTIVO</small>
            <strong>{DATA.concepto}</strong>
            <p>
              Si tu banco permite agregar una referencia motivo o,
              podés escribir “15 Lara”.
            </p>
          </div>

          {copied === 'error' && (
            <p className="gift-error">
              No se pudo copiar automáticamente. Mantené presionado el dato para copiarlo.
            </p>
          )}
        </section>

        <section className="gift-clothing">
          <div className="gift-clothing-icon">👗</div>

          <p className="gift-clothing-kicker">OTRA OPCIÓN DE REGALO</p>

          <h2>Si preferís regalarme ropa</h2>

          <p className="gift-clothing-intro">
            Podés tener en cuenta estas referencias de talle:
          </p>

          <div className="gift-clothing-sizes">
            <div className="gift-size-row">
              <span>Remeras e indumentaria</span>
              <strong>Talle M</strong>
            </div>

            <div className="gift-size-row">
              <span>Pantalones</span>
              <strong>Talle 38–40</strong>
            </div>
          </div>

          <p className="gift-clothing-note">
            Los talles son orientativos y pueden variar según la confección
            de cada prenda.
          </p>
        </section>


        <p className="gift-thanks">
          Gracias por acompañarme en un momento tan especial ✨
        </p>

        <footer className="gift-footer">
          <div className="gift-rule"><span />♕ ♕ ♕<span /></div>
          <AltexBrand variant="guest" />
        </footer>
      </main>
    </div>
  );
}

function CopyBox({ label, value, copied, buttonLabel, onClick }) {
  return (
    <div className="gift-copybox">
      <small>{label}</small>
      <strong>{value}</strong>
      <button type="button" onClick={onClick}>
        {copied ? '✓ Copiado' : `⧉ ${buttonLabel}`}
      </button>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="gift-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
