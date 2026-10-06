import { ContactHelp } from './contact-help'
import { HistoryPreview } from './history'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatHours } from '@/lib/business-hours'
import { faq, gallery, homeHero, availabilityHero, publicBrand } from './content'
import { contactLinks, usePublic, type Business, type Item, type Page, type Review } from './data'

function State({ error, retry }: { error: boolean; retry: () => void }) {
  return error ? (
    <div role="alert">
      Non è stato possibile caricare questa sezione. <button onClick={retry}>Riprova</button>
    </div>
  ) : (
    <p role="status" className="public-loading">
      Caricamento…
    </p>
  )
}
function ProductSelection({ items }: { items: Item[] }) {
  return (
    <div className="home-product-selection">
      {items.map((item, i) => (
        <article className="home-product-tile" key={`${item.name}-${i}`}>
          <div className="home-product-emblem" aria-hidden="true">
            <span>{String(i + 1).padStart(2, '0')}</span>
            <Sparkles size={42} strokeWidth={1} />
            <span>I MINATI</span>
          </div>
          <div className="home-product-copy">
            {item.brand && <p className="home-product-brand">{item.brand}</p>}
            <h3>{item.name}</h3>
            {item.category && <p className="home-product-category">{item.category}</p>}
            {item.description && <p className="home-product-description">{item.description}</p>}
          </div>
        </article>
      ))}
    </div>
  )
}
export function Faq() {
  return (
    <div className="faq-list">
      {faq.map((item) => (
        <details key={item.question}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  )
}
export function Gallery() {
  return gallery.length ? (
    <div className="public-grid">
      {gallery.map((item) => (
        <figure key={item.src}>
          <img
            src={item.src}
            srcSet={item.srcSet}
            sizes="(min-width: 768px) 33vw, 100vw"
            alt={item.alt}
            width={item.width}
            height={item.height}
            loading="lazy"
          />
          <figcaption>{item.caption}</figcaption>
        </figure>
      ))}
    </div>
  ) : (
    <p>Gallery photographs are not available yet.</p>
  )
}
export function Contact({ business }: { business: Business }) {
  return (
    <div className="public-grid">
      <div className="public-card">
        <h3>Find us</h3>
        <p>{business.address || 'Location information is not available yet.'}</p>
        <div className="public-actions">
          {contactLinks(business).map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...(link.href.startsWith('https:')
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              {link.label}
            </a>
          ))}
        </div>
        {!contactLinks(business).length && <p>Contact details are not available yet.</p>}
      </div>
      <div className="public-card">
        <h3>Opening hours</h3>
        <p>Local time: {business.timezone}</p>
        <dl>
          {business.hours.map((hour) => (
            <div className="hours-row" key={hour.day_of_week}>
              <dt>
                {
                  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][
                    hour.day_of_week
                  ]
                }
              </dt>
              <dd>{formatHours(hour)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
export function HomePage() {
  const business = usePublic<Business>('/public/business'),
    services = usePublic<Page<Item>>('/public/services?limit=3'),
    products = usePublic<Page<Item>>('/public/products?limit=3'),
    reviews = usePublic<Page<Review>>('/public/feedback?limit=3')
  return (
    <>
      <section className="home-hero">
        <img
          className="home-hero-photo"
          src={homeHero.src}
          srcSet={homeHero.srcSet}
          sizes="100vw"
          alt={homeHero.alt}
          width={homeHero.width}
          height={homeHero.height}
          fetchPriority="high"
        />
        <div className="home-hero-copy">
          <h1>
            Capelli.
            <br />
            Cura.
            <br />
            Identità.
          </h1>
          <p>
            Più di un taglio.
            <br />
            Un’esperienza pensata intorno a te.
          </p>
          <div className="public-actions">
            <Link className="primary-link" to="/availability">
              Scopri disponibilità <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <p className="home-hero-signature">
          {publicBrand.title}
          <br />
          Grigno, TN
        </p>
      </section>
      <div className="home-content">
        <section id="studio" className="home-studio">
          <p className="eyebrow">01 / Studio</p>
          <img
            src={availabilityHero.src}
            srcSet={availabilityHero.srcSet}
            sizes="(min-width: 900px) 34vw, 100vw"
            alt={availabilityHero.alt}
            width={availabilityHero.width}
            height={availabilityHero.height}
            loading="lazy"
          />
          <div className="home-studio-copy">
            <h2>Il tuo stile, la nostra cura.</h2>
            <p>
              Da {publicBrand.title}, tecnica, estetica e attenzione si incontrano. Ogni servizio
              parte dall’ascolto, per creare un risultato che valorizzi la tua identità, non solo il
              momento.
            </p>
            <Link className="home-text-link" to="/contact">
              Scopri di più <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
        <HistoryPreview />
        <section className="home-services">
          <div>
            <p className="eyebrow">02 / Servizi</p>
            <h2>
              Servizi essenziali.
              <br />
              Risultati straordinari.
            </h2>
          </div>
          <div>
            {services.data ? (
              services.data.items.length ? (
                <ol className="home-service-list">
                  {services.data.items.map((item, index) => (
                    <li key={index}>
                      <Link to="/services">
                        <span className="home-service-number">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="home-service-description">
                          <h3>{item.name}</h3>
                          {item.description && <span>{item.description}</span>}
                        </span>
                        <span className="home-service-duration">
                          {item.duration_minutes != null && `${item.duration_minutes} min`}
                        </span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>Contattaci per conoscere i nostri servizi.</p>
              )
            ) : services.error ? (
              <div role="alert">
                Non è stato possibile caricare i servizi.{' '}
                <button onClick={services.retry}>Riprova</button>
              </div>
            ) : (
              <p role="status">Caricamento dei servizi…</p>
            )}
            <Link className="home-text-link home-all-services" to="/services">
              Tutti i servizi <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
        <div className="home-more">
          {(!products.data || products.data.items.length > 0) && (
            <section className="home-editorial home-products">
              <div className="home-section-heading">
                <p className="eyebrow">03 / Prodotti</p>
                <h2>
                  La cura continua.
                  <br />
                  Anche a casa.
                </h2>
                <p>
                  Scopri i prodotti del salone. Ti aiutiamo a scegliere quelli più adatti alla tua
                  routine.
                </p>
                <Link className="home-text-link" to="/products">
                  Esplora i prodotti <span aria-hidden="true">→</span>
                </Link>
              </div>
              <div className="home-section-body">
                {products.data ? (
                  <ProductSelection items={products.data.items} />
                ) : (
                  <State {...products} />
                )}
              </div>
            </section>
          )}
          {(!reviews.data || reviews.data.items.length > 0) && (
            <section className="home-editorial home-reviews">
              <div className="home-section-heading">
                <p className="eyebrow">04 / Esperienze</p>
                <h2>Le vostre esperienze</h2>
                <Link className="home-text-link" to="/feedback">
                  Leggi e condividi la tua esperienza <span aria-hidden="true">→</span>
                </Link>
              </div>
              <div className="home-section-body">
                {reviews.data ? (
                  <div className="home-review-list">
                    {reviews.data.items.map((review, i) => (
                      <blockquote key={i}>
                        <p className="home-review-rating">
                          <span aria-hidden="true">★</span> {review.rating} / 5
                        </p>
                        <p className="home-review-comment">{review.comment}</p>
                        <cite>{review.name}</cite>
                      </blockquote>
                    ))}
                  </div>
                ) : (
                  <State {...reviews} />
                )}
              </div>
            </section>
          )}
          <section className="home-editorial home-faq">
            <div className="home-section-heading">
              <p className="eyebrow">05 / Domande</p>
              <h2>Prima di venirci a trovare</h2>
              <Link className="home-text-link" to="/faq">
                Tutte le risposte <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="home-section-body">
              <Faq />
            </div>
          </section>
        </div>
      </div>
      <ContactHelp business={business} />
    </>
  )
}
export function PublicCatalog({ resource }: { resource: 'services' | 'products' }) {
  const [offset, setOffset] = useState(0)
  const page = usePublic<Page<Item>>(`/public/${resource}?limit=12&offset=${offset}`)
  const products = resource === 'products'
  return (
    <section
      className={`public-catalog ${products ? 'public-product-catalog' : 'public-service-catalog'}`}
    >
      <header className="catalog-intro">
        <div>
          <p className="eyebrow">I Minati / {products ? 'Prodotti' : 'Servizi'}</p>
          <h1>
            {products ? (
              <>
                La cura continua.
                <br />
                Anche a casa.
              </>
            ) : (
              <>
                Servizi essenziali.
                <br />
                Risultati straordinari.
              </>
            )}
          </h1>
        </div>
        <div>
          <p>
            {products
              ? 'Scopri i prodotti del salone. Ti aiutiamo a scegliere quelli più adatti alla tua routine.'
              : 'Ogni servizio parte dall’ascolto. Trova il trattamento più adatto a te e contattaci per concordare la tua visita.'}
          </p>
          <Link className="home-text-link" to="/contact">
            Parliamone insieme <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>
      {page.data ? (
        <>
          {page.data.items.length ? (
            products ? (
              <ProductSelection items={page.data.items} />
            ) : (
              <ol className="catalog-service-list">
                {page.data.items.map((item, i) => (
                  <li key={`${item.name}-${i}`}>
                    <span className="catalog-service-number">
                      {String(offset + i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h2>{item.name}</h2>
                      {item.description && <p>{item.description}</p>}
                    </div>
                    <span className="catalog-service-duration">
                      {item.duration_minutes != null && `${item.duration_minutes} min`}
                    </span>
                  </li>
                ))}
              </ol>
            )
          ) : (
            <div className="catalog-empty">
              <h2>
                {products
                  ? 'Il catalogo è in preparazione.'
                  : 'I servizi saranno disponibili presto.'}
              </h2>
              <p>Contattaci per informazioni e consigli.</p>
              <Link className="home-text-link" to="/contact">
                Contatta il salone →
              </Link>
            </div>
          )}
          <div className="catalog-pagination">
            <p>
              {page.data.total} {products ? 'prodotti' : 'servizi'}
              {page.data.items.length > 0 && ` · ${offset + 1}–${offset + page.data.items.length}`}
            </p>
            <div>
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 12))}>
                Precedenti
              </button>
              <button
                disabled={offset + 12 >= page.data.total}
                onClick={() => setOffset(offset + 12)}
              >
                Successivi
              </button>
            </div>
          </div>
        </>
      ) : (
        <State {...page} />
      )}
      <aside className="catalog-help">
        <h2>{products ? 'Una routine su misura per te.' : 'Il prossimo passo, insieme.'}</h2>
        <p>
          {products
            ? 'Hai dubbi su quale prodotto scegliere? Chiedici un consiglio.'
            : 'Consulta le disponibilità indicative e contattaci per confermare il tuo appuntamento.'}
        </p>
        <Link className="home-text-link" to={products ? '/contact' : '/availability'}>
          {products ? 'Chiedi un consiglio' : 'Scopri disponibilità'}{' '}
          <span aria-hidden="true">→</span>
        </Link>
      </aside>
    </section>
  )
}
export function ContactPage() {
  const business = usePublic<Business>('/public/business')
  const address = 'Via Vittorio Emanuele 114, 38055 Grigno (TN), Italia'
  const query = encodeURIComponent(address)
  return (
    <div className="public-contact-page">
      <header className="contact-intro">
        <p className="eyebrow">I Minati / Contatti</p>
        <h1>
          Ci vediamo
          <br />
          in salone.
        </h1>
        <p>Una domanda, un consiglio o il tuo prossimo appuntamento. Siamo qui per te.</p>
      </header>
      <ContactHelp business={business} />
      <section className="contact-location" aria-labelledby="contact-location-title">
        <div className="contact-location-heading">
          <div>
            <p className="eyebrow">Nel cuore di Grigno</p>
            <h2 id="contact-location-title">Vieni a trovarci.</h2>
            <address>{address}</address>
          </div>
          <a
            className="home-text-link"
            href={`https://www.google.com/maps/dir/?api=1&destination=${query}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Indicazioni stradali <span aria-hidden="true">→</span>
          </a>
        </div>
        <iframe
          className="contact-map"
          title="Mappa del salone — Via Vittorio Emanuele 114, Grigno"
          src={`https://www.google.com/maps?q=${query}&z=17&hl=it&output=embed`}
          width="1200"
          height="480"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
        <p className="contact-map-caption">I Minati Parrucchieri · Grigno, Trentino</p>
      </section>
    </div>
  )
}
export function GalleryPage() {
  return (
    <section>
      <h1>Gallery</h1>
      <Gallery />
    </section>
  )
}
export function FaqPage() {
  return (
    <section>
      <h1>Frequently asked questions</h1>
      <Faq />
    </section>
  )
}
export function NotFoundPage() {
  return (
    <section>
      <h1>Page not found</h1>
      <p>This page is not available.</p>
      <Link to="/">Return home</Link> · <Link to="/contact">Contact</Link>
    </section>
  )
}
