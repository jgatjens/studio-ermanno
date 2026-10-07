import { t, useAdminLanguage, LanguageSelector } from '@/admin/i18n'
import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Package,
  MoreHorizontal,
  ShoppingBag,
  MessageSquare,
  Scissors,
  UserRound,
  Clock,
  ShieldCheck,
  Globe,
  X,
} from 'lucide-react'
import { ProtectedRoute } from '@/auth/protected-route'
import { LogoutButton } from '@/auth/logout-button'
import { useAuth } from '@/auth/auth-provider'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { AdminQueryProvider } from './query-provider'

const primary = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Clients', path: '/admin/clients', icon: Users },
  { label: 'Calendar', path: '/admin/appointments', icon: CalendarDays },
  { label: 'Inventory', path: '/admin/inventory', icon: Package },
]
const catalog = [
  { label: 'Services', path: '/admin/services', icon: Scissors },
  { label: 'Products', path: '/admin/products', icon: ShoppingBag },
  { label: 'Hairdressers', path: '/admin/hairdressers', icon: UserRound },
]
const management = [
  { label: 'Feedback', path: '/admin/feedback', icon: MessageSquare },
  { label: 'Business hours', path: '/admin/business-hours', icon: Clock },
  { label: 'Access checks', path: '/admin/access', icon: ShieldCheck },
]
const secondary = [...catalog, ...management]
const mobile = [...primary, { label: 'More', path: '/admin/more', icon: MoreHorizontal }]
const groups = [
  { label: 'Daily work', items: primary },
  { label: 'Catalog', items: catalog },
  { label: 'Management', items: management },
]
function activePath(pathname: string, path: string) {
  return path === '/admin'
    ? pathname === path
    : pathname === path || pathname.startsWith(`${path}/`)
}

function ShellContent() {
  const language = useAdminLanguage()

  const { actor } = useAuth()
  const { pathname } = useLocation()
  const { setOpenMobile, isMobile } = useSidebar()
  const main = useRef<HTMLElement>(null)
  const role = actor?.role === 'OWNER' ? 'Owner' : 'Staff'
  const current =
    [...primary, ...secondary, mobile[4]].find((item) => activePath(pathname, item.path))?.label ??
    'Admin'
  useEffect(() => {
    document.title = `${t(current)} · ${t('Admin')}`
    main.current?.focus({ preventScroll: true })
    setOpenMobile(false)
  }, [pathname, current, language, setOpenMobile])
  return (
    <>
      <a className="skip-link" href="#admin-main">
        {t('Skip to admin content')}
      </a>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <div className="flex items-center justify-between">
            <SidebarMenuButton asChild size="lg" tooltip="Minati Parrucchieri">
              <Link to="/admin">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
                  M
                </span>
                <span className="grid text-left">
                  <span className="font-semibold">I Minati Parrucchieri</span>
                  <span className="text-xs text-muted-foreground">{t('administration')}</span>
                </span>
              </Link>
            </SidebarMenuButton>
            {isMobile && (
              <Button
                variant="outline"
                onClick={() => setOpenMobile(false)}
                aria-label={t('Close navigation')}
              >
                <X size={18} />
              </Button>
            )}
          </div>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label={t('Admin sections')}>
            {groups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{t(group.label)}</SidebarGroupLabel>
                <SidebarMenu>
                  {group.items.map(({ label, path, icon: Icon }) => (
                    <SidebarMenuItem key={path}>
                      <SidebarMenuButton
                        asChild
                        isActive={activePath(pathname, path)}
                        tooltip={t(label)}
                      >
                        <Link
                          to={path}
                          aria-current={activePath(pathname, path) ? 'page' : undefined}
                          onClick={() => setOpenMobile(false)}
                        >
                          <Icon aria-hidden="true" />
                          <span>{t(label)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ))}
          </nav>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={t('Public website')}>
                <Link to="/">
                  <Globe aria-hidden="true" />
                  <span>{t('Public website')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="admin-actor">
            <span>
              {t(role)} {t(' access')}
            </span>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="admin-shell-header">
          <SidebarTrigger className="min-h-11 min-w-11" />
          <div className="admin-header-title min-w-0">
            <p className="text-xs text-muted-foreground">
              {t('Admin / ')}
              {t(role)}
            </p>
            <p className="truncate text-sm font-semibold">{t(current)}</p>
          </div>
          <div className="admin-header-actions">
            <LanguageSelector />
            <LogoutButton />
          </div>
        </header>
        <main id="admin-main" className="admin-main w-full" tabIndex={-1} ref={main}>
          <Outlet />
        </main>
        <nav className="admin-navigation" aria-label={t('Admin mobile shortcuts')}>
          {mobile.map(({ label, path, icon: Icon }) => {
            const active =
              activePath(pathname, path) ||
              (label === 'More' && secondary.some((item) => activePath(pathname, item.path)))
            return (
              <Link
                key={path}
                to={path}
                className={active ? 'active' : ''}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{t(label)}</span>
              </Link>
            )
          })}
        </nav>
      </SidebarInset>
    </>
  )
}
function Shell() {
  const language = useAdminLanguage()

  const [open, setOpen] = useState(() =>
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1024px)').matches
      : true,
  )
  return (
    <div className="admin-site admin-redesign" lang={language}>
      <SidebarProvider
        open={open}
        onOpenChange={setOpen}
        style={{ '--sidebar-width-icon': '4rem' } as React.CSSProperties}
      >
        <ShellContent />
      </SidebarProvider>
    </div>
  )
}
export function AdminLayout() {
  useAdminLanguage()

  return (
    <ProtectedRoute>
      <AdminQueryProvider>
        <Shell />
      </AdminQueryProvider>
    </ProtectedRoute>
  )
}
export function MorePage() {
  useAdminLanguage()

  return (
    <section>
      <h1>{t('More')}</h1>
      {groups.slice(1).map((group) => (
        <section key={group.label}>
          <h2>{t(group.label)}</h2>
          <nav className="admin-more" aria-label={t('{group} sections', { group: t(group.label) })}>
            {group.items.map(({ label, path }) => (
              <Link key={path} to={path}>
                {t(label)}
              </Link>
            ))}
          </nav>
        </section>
      ))}
    </section>
  )
}
