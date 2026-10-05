import { ContactHelp } from './contact-help'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatHours } from '@/lib/business-hours'
import { faq, gallery, homeHero, availabilityHero, publicBrand } from './content'
import {
  contactLinks,
  price,
  usePublic,
  type Business,
  type Item,
  type Page,
  type Review,
} from './data'

function State({ error, retry }: { error: boolean; retry: () => void }) {
  return error ? (
    <div role="alert">
      This section could not load. <button onClick={retry}>Try again</button>
    </div>
  ) : (
    <p role="status" className="public-loading">
      Loading…
    </p>
  )
}
function Cards({ items, business }: { items: Item[]; business?: Business }) {
  return (
    <div className="public-grid">
      {items.map((item, i) => (
        <article className="public-card" key={`${item.name}-${i}`}>
          <h3>{item.name}</h3>
          {item.brand && <p>{item.brand}</p>}
          {item.category && <p>{item.category}</p>}
          <p>{item.description}</p>
          {item.duration_minutes !== undefined && <p>{item.duration_minutes} minutes</p>}
          {/* <p>{price(item.price ?? item.retail_price, business?.currency)}</p> */}
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
            <a href="#studio">
              Esplora lo studio <span aria-hidden="true">→</span>
            </a>
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
            <h2>Un taglio non dovrebbe semplicemente seguire uno stile. Dovrebbe appartenerti.</h2>
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
          {/* <section className="public-callout">
            <h2>Plan your visit</h2>
            <p>Explore informational availability, then contact us to arrange a visit.</p>
            <Link to="/availability">Check availability</Link>
          </section>
          <section>
            <h2>A look around</h2>
            <Gallery />
            <Link to="/gallery">View gallery</Link>
          </section> */}
          {(!products.data || products.data.items.length > 0) && (
            <section>
              <h2>Featured products</h2>
              <p>Explore our informational product catalog.</p>
              {products.data ? (
                <Cards items={products.data.items} business={business.data} />
              ) : (
                <State {...products} />
              )}
              <Link to="/products">View products</Link>
            </section>
          )}
          {(!reviews.data || reviews.data.items.length > 0) && (
            <section>
              <h2>Customer feedback</h2>
              {reviews.data ? (
                <div className="public-grid">
                  {reviews.data.items.map((review, i) => (
                    <blockquote className="public-card" key={i}>
                      <p>{review.rating} / 5</p>
                      <p>{review.comment}</p>
                      <cite>{review.name}</cite>
                    </blockquote>
                  ))}
                </div>
              ) : (
                <State {...reviews} />
              )}
              <Link to="/feedback">Read reviews and leave feedback</Link>
            </section>
          )}
          <section>
            <h2>Questions before your visit</h2>
            <Faq />
            <Link to="/faq">View FAQ</Link>
          </section>
        </div>
      </div>
      <ContactHelp business={business} />
    </>
  )
}
export function PublicCatalog({ resource }: { resource: 'services' | 'products' }) {
  const [offset, setOffset] = useState(0)
  const business = usePublic<Business>('/public/business')
  const page = usePublic<Page<Item>>(`/public/${resource}?limit=12&offset=${offset}`)
  return (
    <section>
      <h1>{resource === 'services' ? 'Services' : 'Products'}</h1>
      <p>
        {resource === 'products'
          ? 'An informational catalog. Contact us for product guidance.'
          : 'Explore published services, prices and durations.'}
      </p>
      {business.error && <State {...business} />}
      {page.data ? (
        <>
          {page.data.items.length ? (
            <Cards items={page.data.items} business={business.data} />
          ) : (
            <p>
              No {resource} are currently published. <Link to="/contact">Contact us</Link> for more
              information.
            </p>
          )}
          <div className="public-actions">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 12))}>
              Previous
            </button>
            <span>
              {page.data.total} {resource}
            </span>
            <button
              disabled={offset + 12 >= page.data.total}
              onClick={() => setOffset(offset + 12)}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <State {...page} />
      )}
    </section>
  )
}
export function ContactPage() {
  const business = usePublic<Business>('/public/business')
  return (
    <section>
      <h1>Contact</h1>
      {business.data ? <Contact business={business.data} /> : <State {...business} />}
    </section>
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
