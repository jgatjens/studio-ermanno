import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { AdminLayout, MorePage } from './layout'
const auth = vi.hoisted(() => ({ role: 'OWNER', logout: vi.fn() }))
vi.mock('@/auth/auth-provider', () => ({
  useAuth: () => ({ status: 'authenticated', actor: { role: auth.role }, logout: auth.logout }),
}))
function mount(path = '/admin') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<h1>Dashboard content</h1>} />
          <Route path="clients/:id" element={<h1>Client details</h1>} />
          <Route path="services" element={<h1>Service catalog</h1>} />
          <Route path="more" element={<MorePage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}
beforeEach(() => {
  auth.role = 'OWNER'
})
test('grouped desktop sections highlight nested routes and sidebar collapses', () => {
  mount('/admin/clients/one')
  const nav = screen.getByRole('navigation', { name: 'Admin sections' })
  expect(within(nav).getByRole('link', { name: 'Clients' })).toHaveAttribute('aria-current', 'page')
  expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  expect(screen.getByText('Daily work')).toBeInTheDocument()
  const sidebar = document.querySelector('[data-slot="sidebar"][data-state]')!
  expect(sidebar).toHaveAttribute('data-state', 'expanded')
  fireEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }))
  expect(sidebar).toHaveAttribute('data-state', 'collapsed')
})
test('tablet starts collapsed and Staff retains logout and section access', () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      matches: false,
      media,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
  auth.role = 'STAFF'
  mount()
  expect(document.querySelector('[data-slot="sidebar"][data-state]')).toHaveAttribute(
    'data-state',
    'collapsed',
  )
  expect(screen.getByText('Admin / Staff')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
})
test('mobile drawer closes on navigation and updates page focus', async () => {
  vi.stubGlobal('innerWidth', 390)
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      matches: media.includes('max-width'),
      media,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }))
  const drawer = await screen.findByRole('dialog', { name: 'Admin navigation' })
  fireEvent.click(within(drawer).getByRole('link', { name: 'Services' }))
  expect(await screen.findByRole('heading', { name: 'Service catalog' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(document.activeElement).toBe(document.getElementById('admin-main'))
})
test('More organizes all secondary sections by catalog and management', () => {
  mount('/admin/more')
  expect(screen.getByRole('navigation', { name: 'Catalog sections' })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Management sections' })).toBeInTheDocument()
})
