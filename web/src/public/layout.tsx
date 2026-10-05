import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowRight, Menu, X, Camera } from 'lucide-react'
import { contactLinks, usePublic, type Business } from './data'
const routes = [{ label: 'Studio', path: '/' }, { label: 'Servizi', path: '/services' }, { label: 'Gallery', path: '/gallery' }, { label: 'Contatti', path: '/contact' }]
const metadata: Record<string, [string, string]> = {
  '/': ['Welcome', 'Explore services, availability and contact information.'], '/services': ['Services', 'Published services, prices and durations.'], '/products': ['Products', 'Explore the public product catalog.'], '/gallery': ['Gallery', 'Photographs from the business.'], '/availability': ['Disponibilità', 'Consulta gli orari disponibili e contatta il salone per concordare la tua visita.'], '/feedback': ['Feedback', 'Read public reviews and leave feedback.'], '/faq': ['FAQ', 'Answers to common questions before your visit.'], '/contact': ['Contact', 'Contact information, location and opening hours.'],
}
export function PublicLayout() {
  const [open, setOpen] = useState(false); const toggle = useRef<HTMLButtonElement>(null); const { pathname } = useLocation()
  useEffect(() => { setOpen(false); const [title, description] = metadata[pathname] || ['Page not found', 'Return home to explore the website.']; document.title = title; let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]'); if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.append(meta) } meta.content = description }, [pathname])
  const business = usePublic<Business>('/public/business')
  const socials = business.data ? contactLinks(business.data).filter(link => ['Instagram', 'WhatsApp'].includes(link.label)) : []
  const brand = <><span>{business.data?.name || 'Studio'}</span><small>Parrucchieri</small></>
  return <div className="public-site"><a className="skip-link" href="#public-main">Skip to content</a>
    <header className="public-header" onKeyDown={event => { if (event.key === 'Escape' && open) { setOpen(false); toggle.current?.focus() } }}>
      <Link className="public-brand" to="/" aria-label={`${business.data?.name || 'Studio'} — Home`}>{brand}</Link>
      <button ref={toggle} className="menu-toggle" aria-label="Menu" aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      <nav id="public-navigation" className={open ? 'public-nav open' : 'public-nav'} aria-label="Public">{routes.map(route => <NavLink end={route.path === '/'} key={route.path} to={route.path}>{route.label}</NavLink>)}<NavLink className="public-mobile-availability" to="/availability">Disponibilità <ArrowRight size={16} /></NavLink></nav>
      <Link className="public-header-cta" to="/availability">Disponibilità <ArrowRight size={16} /></Link>
    </header>
    <main id="public-main" tabIndex={-1} className={`public-main${pathname === '/availability' ? ' public-main-availability' : ''}`}><Outlet /></main>
    <footer className="public-footer"><div className="public-footer-primary"><Link className="public-brand" to="/">{brand}</Link><nav aria-label="Footer">{routes.map(route => <Link key={route.path} to={route.path}>{route.label}</Link>)}</nav><div className="public-socials">{socials.map(link => <a key={link.label} aria-label={link.label} href={link.href} target="_blank" rel="noopener noreferrer">{link.label === 'Instagram' ? <Camera size={19} /> : 'WhatsApp'}</a>)}</div><p>© {new Date().getFullYear()} {business.data?.name || 'Studio'}</p></div><nav className="public-footer-secondary" aria-label="More information"><Link to="/products">Prodotti</Link><Link to="/availability">Disponibilità</Link><Link to="/faq">FAQ</Link><Link to="/feedback">Feedback</Link><Link to="/login">Staff login</Link></nav></footer>
  </div>
}
