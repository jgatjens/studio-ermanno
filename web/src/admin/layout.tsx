import { useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ProtectedRoute } from '@/auth/protected-route'
import { LogoutButton } from '@/auth/logout-button'
import { useAuth } from '@/auth/auth-provider'
import { AdminQueryProvider } from './query-provider'
const primary = [['Dashboard','/admin'],['Clients','/admin/clients'],['Calendar','/admin/appointments'],['Inventory','/admin/inventory'],['More','/admin/more']]
const secondary = [['Products','/admin/products'],['Feedback','/admin/feedback'],['Services','/admin/services'],['Barbers','/admin/barbers'],['Business hours','/admin/business-hours'],['Access checks','/admin/access']]
function Shell() {
  const { actor } = useAuth(); const { pathname } = useLocation(); const main = useRef<HTMLElement>(null)
  useEffect(() => { document.title = 'Admin'; main.current?.focus() }, [pathname])
  const moreActive = secondary.some(([,path]) => pathname.startsWith(path))
  return <div className="admin-site"><a className="skip-link" href="#admin-main">Skip to admin content</a><header className="admin-header"><Link to="/admin">Admin</Link><span>{actor?.role === 'OWNER' ? 'Owner' : 'Staff'} access</span><Link to="/">Public website</Link><LogoutButton /></header><nav className="admin-navigation" aria-label="Admin">{primary.map(([label,path]) => { const active=path==='/admin'?pathname===path:pathname.startsWith(path)||(label==='More'&&moreActive);return <Link key={path} to={path} className={active?'active':''} aria-current={active?'page':undefined}>{label}</Link> })}</nav><main id="admin-main" className="admin-main" tabIndex={-1} ref={main}><Outlet /></main></div>
}
export function AdminLayout() { return <ProtectedRoute><AdminQueryProvider><Shell /></AdminQueryProvider></ProtectedRoute> }
export function MorePage() { return <section><h1>More</h1><nav className="admin-more" aria-label="More sections">{secondary.map(([label,path])=><Link key={path} to={path}>{label}</Link>)}</nav></section> }
