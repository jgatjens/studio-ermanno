import { publicBrand } from './content'
import { Link } from 'react-router-dom'

export function HistoryPage() {
  return (
    <div className="home-content history-page">
      <FamilyHistory />
    </div>
  )
}

export function HistoryPreview() {
  return (
    <section className="history-preview" aria-labelledby="history-preview-title">
      <img
        src="/images/history-storefront-480.webp"
        alt="Fotografia d’archivio della bottega di famiglia"
        width={480}
        height={728}
        loading="lazy"
      />
      <div>
        <p className="history-eyebrow">La nostra storia</p>
        <h2 id="history-preview-title">Una storia di famiglia</h2>
        <p>
          Dal mio trisnonno, a mio nonno, a mio papà, fino a me, Fabio: una tradizione di famiglia
          che si tramanda da oltre 70 anni.
        </p>
        <Link className="home-text-link" to="/history">
          Scopri la nostra storia <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  )
}

function ArchivePhoto({
  name,
  alt,
  width,
  height,
  main = false,
}: {
  name: string
  alt: string
  width: number
  height: number
  main?: boolean
}) {
  return (
    <figure className={`history-photo${main ? ' history-photo-main' : ''}`}>
      <img
        src={`/images/history-${name}-960.webp`}
        srcSet={`/images/history-${name}-480.webp 480w, /images/history-${name}-960.webp 960w`}
        sizes={
          main
            ? '(min-width: 900px) 40vw, (min-width: 600px) 70vw, 100vw'
            : '(min-width: 900px) 26vw, 45vw'
        }
        width={width}
        height={height}
        alt={alt}
        loading="lazy"
      />
    </figure>
  )
}

export function FamilyHistory() {
  return (
    <section id="storia" className="family-history" aria-labelledby="history-title">
      <ArchivePhoto
        name="storefront"
        alt="Fotografia d’archivio di un uomo davanti alla bottega con l’insegna Pettinatrice e un cane"
        width={960}
        height={1456}
        main
      />
      <div className="history-story">
        <p className="history-eyebrow">La nostra storia</p>
        <h1 id="history-title">
          Una storia
          <br />
          di famiglia
        </h1>
        <p>
          La nostra storia nasce con il mio trisnonno, che proprio qui aprì una piccola barberia.
        </p>
        <p>
          Nel 1953, a soli 18 anni, mio nonno Olivo ampliò la bottega, lavorando con passione al
          fianco della sorella Vittorina. In seguito, mio papà Ermanno ha raccolto il testimone, e
          oggi tocca a me continuare a scrivere questo racconto.
        </p>
        <p className="history-closing">
          Dal mio trisnonno, a mio nonno, a mio papà, fino a me, Fabio: una tradizione di famiglia
          che si tramanda da oltre 70 anni.
        </p>
      </div>
      <div className="history-album">
        <ArchivePhoto
          name="portrait"
          alt="Fotografia d’archivio di due persone in piedi accanto a una donna seduta in salone"
          width={960}
          height={1305}
        />
        <ArchivePhoto
          name="team"
          alt="Fotografia d’archivio di un gruppo di cinque persone in salone"
          width={960}
          height={1182}
        />
      </div>
      <div className="history-signature">
        <p>Oltre 70 anni di storia</p>
      </div>
    </section>
  )
}
