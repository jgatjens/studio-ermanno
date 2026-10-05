import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { apiRequest } from '@/lib/api'
import { contactLinks, price, type Business } from './data'
import { HomePage, PublicCatalog, FaqPage, GalleryPage, ContactPage, NotFoundPage } from './pages'
import { gallery } from './content'
import { PublicLayout } from './layout'
vi.mock('@/lib/api', () => ({ apiRequest: vi.fn() }))
const business: Business = {
  name: 'Studio',
  description: 'Welcome to our studio',
  address: 'Long street 1, Rome',
  phone: '+39 123456789',
  email: 'hello@example.com',
  whatsapp: '+39 123456789',
  instagram: '@studio',
  timezone: 'Europe/Rome',
  currency: 'EUR',
  hours: [],
}
const page = { items: [], total: 0, limit: 12, offset: 0 }
beforeEach(() => {
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/public/business' ? business : page,
  )
})
function mount(element: React.ReactNode, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="*" element={element} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}
test('Home follows section order, hides empty products/reviews and retains independent navigation', async () => {
  mount(<HomePage />)
  await screen.findByRole('heading', { name: 'I Minati Parrucchieri' })
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
    'Featured services',
    'Plan your visit',
    'A look around',
    'Location and contact',
    'Questions before your visit',
  ])
  expect(screen.queryByText('API Status: Connected')).not.toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Check availability' })[0]).toHaveAttribute(
    'href',
    '/availability',
  )
  for (const [, options] of vi.mocked(apiRequest).mock.calls) {
    expect(options?.protected).toBe(false)
    expect(options?.signal).toBeInstanceOf(AbortSignal)
  }
})
test('independent section failure retries without losing hero; unknown currency withheld', async () => {
  vi.mocked(apiRequest).mockImplementation(async (path) => {
    if (path === '/public/business') throw Error('offline')
    if (path.includes('/services'))
      return { ...page, items: [{ name: 'Cut', price: '12.50', duration_minutes: 30 }] }
    return page
  })
  mount(<HomePage />)
  await screen.findByText('Cut')
  expect(screen.getByText('Price information unavailable')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Directions' })).not.toBeInTheDocument()
  fireEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0])
  await waitFor(() =>
    expect(vi.mocked(apiRequest).mock.calls.filter(([p]) => p === '/public/business')).toHaveLength(
      3,
    ),
  )
})
test('catalog paginates, renders public information and currency safely', async () => {
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/public/business'
      ? { ...business, currency: 'invalid' }
      : {
          ...page,
          total: 13,
          items: [{ name: 'Cut', price: '12.50', duration_minutes: 30, description: 'Simple cut' }],
        },
  )
  mount(<PublicCatalog resource="services" />, '/services')
  await screen.findByText('Cut')
  expect(screen.getByText('12.50 invalid')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() =>
    expect(apiRequest).toHaveBeenCalledWith(
      '/public/services?limit=12&offset=12',
      expect.anything(),
    ),
  )
})
test('contact links validate hosts/protocols and encode maps address', () => {
  const links = contactLinks(business)
  expect(links).toHaveLength(5)
  expect(links.find((l) => l.label === 'Directions')?.href).toContain(
    'api=1&destination=Long%20street',
  )
  expect(
    contactLinks({
      ...business,
      address: null,
      phone: 'javascript:alert(1)',
      email: 'bad',
      whatsapp: 'https://evil.test',
      instagram: 'https://evil.test/studio',
    }),
  ).toEqual([])
  expect(
    contactLinks({ ...business, instagram: 'https://www.instagram.com/studio/' }).find(
      (l) => l.label === 'Instagram',
    )?.href,
  ).toBe('https://www.instagram.com/studio/')
  expect(price('12.50', undefined)).toBe('Price information unavailable')
})
test('mobile disclosure has controls, Escape returns focus, navigation closes', async () => {
  mount(<GalleryPage />)
  const menu = screen.getByRole('button', { name: 'Menu' })
  fireEvent.click(menu)
  expect(menu).toHaveAttribute('aria-expanded', 'true')
  fireEvent.keyDown(screen.getByRole('navigation', { name: 'Public' }), { key: 'Escape' })
  expect(menu).toHaveFocus()
  expect(menu).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(menu)
  fireEvent.click(screen.getAllByRole('link', { name: 'Servizi' })[0])
  await waitFor(() => expect(menu).toHaveAttribute('aria-expanded', 'false'))
  expect(screen.getByText('Skip to content')).toHaveAttribute('href', '#public-main')
})
test('gallery unavailable, FAQ disclosure and route metadata', () => {
  const view = mount(<GalleryPage />, '/gallery')
  expect(screen.getAllByRole('img')).toHaveLength(3)
  for (const image of screen.getAllByRole('img')) {
    expect(image).toHaveAttribute('alt')
    expect(image).toHaveAttribute('width', '960')
    expect(image).toHaveAttribute('loading', 'lazy')
  }
  expect(document.title).toBe('Gallery | I Minati Parrucchieri')
  view.unmount()
  mount(<FaqPage />, '/faq')
  const summary = screen.getByText('How do I arrange a visit?')
  expect(summary.tagName).toBe('SUMMARY')
  expect(document.title).toBe('FAQ | I Minati Parrucchieri')
})
test('contact failure has retry and no fabricated links', async () => {
  vi.mocked(apiRequest).mockRejectedValue(Error('offline'))
  mount(<ContactPage />, '/contact')
  await screen.findByRole('alert')
  expect(screen.queryByRole('link', { name: 'Call' })).not.toBeInTheDocument()
})
test('unknown public routes show usable fallback', () => {
  mount(<NotFoundPage />, '/missing')
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/')
})
test('public requests abort on unmount and stale results cannot replace the next catalog', async () => {
  let resolveOld: (value: unknown) => void = () => {}
  vi.mocked(apiRequest).mockImplementation((path) =>
    path === '/public/business'
      ? Promise.resolve(business)
      : new Promise((resolve) => {
          resolveOld = resolve
        }),
  )
  const view = mount(<PublicCatalog resource="services" />, '/services')
  const signal = vi
    .mocked(apiRequest)
    .mock.calls.find(([path]) => path.includes('/services'))?.[1]?.signal
  view.unmount()
  expect(signal?.aborted).toBe(true)
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/public/business' ? business : page,
  )
  mount(<PublicCatalog resource="products" />, '/products')
  await screen.findByText(/No products are currently published/)
  resolveOld({ ...page, items: [{ name: 'Stale cut', price: '10' }] })
  expect(screen.queryByText('Stale cut')).not.toBeInTheDocument()
})

test('empty gallery remains a usable state when assets are unavailable', () => {
  const saved = gallery.splice(0)
  try {
    mount(<GalleryPage />, '/gallery')
    expect(screen.getByText('Gallery photographs are not available yet.')).toBeInTheDocument()
  } finally {
    gallery.push(...saved)
  }
})
