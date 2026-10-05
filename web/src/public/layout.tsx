import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowRight, Menu, X, Ellipsis } from 'lucide-react'
import { publicBrand } from './content'
import { contactLinks, usePublic, type Business } from './data'
const routes = [{ label: 'Studio', path: '/' }, { label: 'Servizi', path: '/services' }, { label: 'Gallery', path: '/gallery' }, { label: 'Contatti', path: '/contact' }]
const metadata: Record<string, [string, string]> = {
  '/': ['Welcome', 'Explore services, availability and contact information.'], '/services': ['Services', 'Published services, prices and durations.'], '/products': ['Products', 'Explore the public product catalog.'], '/gallery': ['Gallery', 'Photographs from the business.'], '/availability': ['Disponibilità', 'Consulta gli orari disponibili e contatta il salone per concordare la tua visita.'], '/feedback': ['Feedback', 'Read public reviews and leave feedback.'], '/faq': ['FAQ', 'Answers to common questions before your visit.'], '/contact': ['Contact', 'Contact information, location and opening hours.'],
}
export function PublicLayout() {
  const [open, setOpen] = useState(false); const toggle = useRef<HTMLButtonElement>(null); const { pathname } = useLocation()
  useEffect(() => { setOpen(false); const [title, description] = metadata[pathname] || ['Page not found', 'Return home to explore the website.']; document.title = pathname === '/' ? publicBrand.title : `${title} | ${publicBrand.title}`; let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]'); if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.append(meta) } meta.content = description }, [pathname])
  const business = usePublic<Business>('/public/business')
  const socials = business.data ? contactLinks(business.data).filter(link => ['Instagram', 'WhatsApp'].includes(link.label)) : []
  const footerSocials = ['Instagram', 'WhatsApp'].map(label => socials.find(link => link.label === label) || { label, href: '/contact' })
  const brand = <><span>{publicBrand.name}</span><small>{publicBrand.descriptor}</small></>
  return <div className="public-site"><a className="skip-link" href="#public-main">Skip to content</a>
    <header className="public-header" onKeyDown={event => { if (event.key === 'Escape' && open) { setOpen(false); toggle.current?.focus() } }}>
      <Link className="public-brand" to="/" aria-label={`${publicBrand.title} — Home`}>{brand}</Link>
      <button ref={toggle} className="menu-toggle" aria-label="Menu" aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      <nav id="public-navigation" className={open ? 'public-nav open' : 'public-nav'} aria-label="Public">{routes.map(route => <NavLink end={route.path === '/'} key={route.path} to={route.path}>{route.label}</NavLink>)}<NavLink className="public-mobile-availability" to="/availability">Disponibilità <ArrowRight size={16} /></NavLink></nav>
      <Link className="public-header-cta" to="/availability">Disponibilità <ArrowRight size={16} /></Link>
    </header>
    <main id="public-main" tabIndex={-1} className={`public-main${pathname === '/availability' ? ' public-main-availability' : ''}`}><Outlet /></main>
    <footer className="public-footer"><div className="public-footer-primary">
      <Link className="public-brand" to="/">{brand}</Link>
      <nav aria-label="Footer">{routes.map(route => <Link key={route.path} to={route.path}>{route.label}</Link>)}<details className="public-footer-more"><summary aria-label="Altre pagine"><Ellipsis size={16} /></summary><nav aria-label="More information"><Link to="/products">Prodotti</Link><Link to="/availability">Disponibilità</Link><Link to="/faq">FAQ</Link><Link to="/feedback">Feedback</Link><Link to="/login">Staff login</Link></nav></details></nav>
      <div className="public-socials">{footerSocials.map(link => <a key={link.label} aria-label={link.label} title={link.href === '/contact' ? `Informazioni di contatto: ${link.label}` : link.label} href={link.href} {...(link.href.startsWith('https:') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{link.label === 'Instagram' ? <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /></svg> : <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.7 7.4L3 20l1.2-4.6A8.5 8.5 0 1 1 20.5 11.5Z" /><path d="m8 7 1.8 2.7-1 1.2c.8 1.6 1.8 2.6 3.5 3.4l1.2-1 2.6 1.7c-.3 1.6-1.3 2.2-2.8 1.8-3.6-.9-6.3-3.8-7-6.9C6 8.5 6.6 7.5 8 7Z" /></svg>}</a>)}</div>
      <p>© {new Date().getFullYear()} {publicBrand.title}</p>
    </div></footer>
  </div>
}
