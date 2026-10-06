import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowRight, Menu, X, Ellipsis } from 'lucide-react'
import { publicBrand, publicSocialLinks } from './content'
const routes = [
  { label: 'La nostra storia', path: '/history' },
  { label: 'Servizi', path: '/services' },
  { label: 'Prodotti', path: '/products' },
  { label: 'Contatti', path: '/contact' },
]
const metadata: Record<string, [string, string]> = {
  '/history': [
    'Una storia di famiglia',
    'Scopri la storia di I Minati Parrucchieri a Grigno: una tradizione di famiglia che si tramanda da oltre 70 anni, fino a Fabio.',
  ],
  '/': [
    'Parrucchieri a Grigno',
    'I Minati Parrucchieri a Grigno, in Trentino. Scopri il salone, i servizi, gli orari e le disponibilità. Contattaci per concordare la tua visita.',
  ],
  '/services': [
    'Servizi e prezzi',
    'Scopri i servizi di I Minati Parrucchieri a Grigno, con prezzi e durata. Contatta il salone per scegliere il servizio più adatto a te.',
  ],
  '/products': [
    'Prodotti per capelli',
    'Esplora i prodotti per capelli di I Minati Parrucchieri a Grigno. Consulta il catalogo e contattaci per informazioni e consigli.',
  ],
  '/gallery': [
    'Gallery del salone',
    'Dai uno sguardo a I Minati Parrucchieri e ai dintorni del salone a Grigno. Esplora la gallery e scopri dove trovarci.',
  ],
  '/availability': [
    'Disponibilità e orari',
    'Consulta le disponibilità di I Minati Parrucchieri a Grigno in fasce di 30 minuti. Contattaci per concordare e confermare il tuo appuntamento.',
  ],
  '/feedback': [
    'Recensioni dei clienti',
    'Leggi le recensioni pubblicate dei clienti di I Minati Parrucchieri a Grigno e condividi la tua esperienza con il salone.',
  ],
  '/faq': [
    'Domande frequenti',
    'Trova risposte alle domande su servizi, prezzi, disponibilità e contatti di I Minati Parrucchieri a Grigno. Organizza la tua visita al salone.',
  ],
  '/contact': [
    'Contatti e indirizzo',
    'Trova I Minati Parrucchieri in Via Vittorio Emanuele 114, 38055 Grigno (TN). Consulta gli orari e contatta il salone per concordare la tua visita.',
  ],
}
export function PublicLayout() {
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const footerMore = useRef<HTMLDetailsElement>(null)
  const { pathname } = useLocation()
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (footerMore.current?.open && event.target instanceof Node && !footerMore.current.contains(event.target)) {
        footerMore.current.open = false
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && footerMore.current?.open) {
        const focusInside = footerMore.current.contains(document.activeElement)
        footerMore.current.open = false
        if (focusInside) footerMore.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])
  useEffect(() => {
    setOpen(false)
    if (footerMore.current) footerMore.current.open = false
    const [title, description] = metadata[pathname] || [
      'Pagina non trovata',
      'La pagina richiesta non è disponibile. Esplora i servizi e i contatti di I Minati Parrucchieri.',
    ]
    document.title = `${title} | ${publicBrand.title}`
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.append(meta)
    }
    meta.content = description
    for (const [property, content] of Object.entries({
      'og:title': document.title,
      'og:description': description,
      'og:site_name': publicBrand.title,
      'og:type': 'website',
      'og:locale': 'it_IT',
    })) {
      let tag = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('property', property)
        document.head.append(tag)
      }
      tag.content = content
    }
  }, [pathname])
  const brand = (
    <>
      <span>{publicBrand.name}</span>
      <small>{publicBrand.descriptor}</small>
    </>
  )
  return (
    <div className="public-site">
      <a className="skip-link" href="#public-main">
        Vai al contenuto
      </a>
      <header
        className="public-header"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            setOpen(false)
            toggle.current?.focus()
          }
        }}
      >
        <Link className="public-brand" to="/" aria-label={`${publicBrand.title} — Home`}>
          {brand}
        </Link>
        <button
          ref={toggle}
          className="menu-toggle"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="public-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav
          id="public-navigation"
          className={open ? 'public-nav open' : 'public-nav'}
          aria-label="Public"
        >
          {routes.map((route) => (
            <NavLink end={route.path === '/'} key={route.path} to={route.path}>
              {route.label}
            </NavLink>
          ))}
          <NavLink className="public-mobile-availability" to="/availability">
            Disponibilità <ArrowRight size={16} />
          </NavLink>
        </nav>
        <Link className="public-header-cta" to="/availability">
          Disponibilità <ArrowRight size={16} />
        </Link>
      </header>
      <main
        id="public-main"
        tabIndex={-1}
        className={`public-main${pathname === '/availability' ? ' public-main-availability' : pathname === '/' ? ' public-main-home' : pathname === '/history' ? ' public-main-history' : pathname === '/feedback' ? ' max-w-none! px-[max(1rem,calc((100%-1160px)/2))]!' : ''}`}
      >
        <Outlet />
      </main>
      <footer className="public-footer">
        <div className="public-footer-primary">
          <Link className="public-brand" to="/">
            {brand}
          </Link>
          <nav aria-label="Footer">
            {routes.map((route) => (
              <Link key={route.path} to={route.path}>
                {route.label}
              </Link>
            ))}
            <details ref={footerMore} className="public-footer-more">
              <summary aria-label="Altre pagine">
                <Ellipsis size={16} />
              </summary>
              <nav aria-label="More information">
                <Link to="/availability">Disponibilità</Link>
                <Link to="/faq">FAQ</Link>
                <Link to="/feedback">Feedback</Link>
                <Link to="/login">Staff login</Link>
              </nav>
            </details>
          </nav>
          <div className="public-socials">
            {publicSocialLinks.map((link) => (
              <a
                key={link.label}
                aria-label={link.label}
                title={link.label}
                href={link.href}
                {...(link.href.startsWith('https:')
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {link.label === 'Instagram' ? (
                  <svg
                    viewBox="0 0 24 24"
                    width="19"
                    height="19"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width="19"
                    height="19"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20.5 11.5a8.5 8.5 0 0 1-12.7 7.4L3 20l1.2-4.6A8.5 8.5 0 1 1 20.5 11.5Z" />
                    <path d="m8 7 1.8 2.7-1 1.2c.8 1.6 1.8 2.6 3.5 3.4l1.2-1 2.6 1.7c-.3 1.6-1.3 2.2-2.8 1.8-3.6-.9-6.3-3.8-7-6.9C6 8.5 6.6 7.5 8 7Z" />
                  </svg>
                )}
              </a>
            ))}
          </div>
          <p>
            © {new Date().getFullYear()} {publicBrand.title}
          </p>
        </div>
      </footer>
    </div>
  )
}
