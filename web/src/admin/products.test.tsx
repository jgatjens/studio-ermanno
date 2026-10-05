import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { AdminQueryProvider } from './query-provider'
import { ProductsPage, ProductFormPage, ProductDetailPage } from './products-page'
import { apiRequest, ApiError } from '@/lib/api'
const state = vi.hoisted(() => ({ actor: { auth_user_id: 'user', membership_id: 'm', business_id: 'b', role: 'OWNER' as 'OWNER' | 'STAFF' } }))
vi.mock('@/auth/auth-provider', () => ({ useAuth: () => state }))
vi.mock('@/lib/api', async original => ({ ...await original<typeof import('@/lib/api')>(), apiRequest: vi.fn() }))
const product = { id: 'one', name: 'Pomade', brand: 'Brand', category: 'Hair', description: null, sku: 'SKU', cost_price: '1.00', retail_price: '3.00', minimum_stock: '2.000', current_stock: '2.000', low_stock: true, is_active: true, is_public: false }
const page = { items: [product], total: 1, limit: 25, offset: 0 }
const history = { items: [], total: 0, limit: 25, offset: 0 }
function mount(path = '/admin/products') { return render(<MemoryRouter initialEntries={[path]}><AdminQueryProvider><Routes><Route path="/admin/products" element={<ProductsPage />} /><Route path="/admin/inventory" element={<ProductsPage inventory />} /><Route path="/admin/products/new" element={<ProductFormPage />} /><Route path="/admin/products/:productId" element={<ProductDetailPage />} /><Route path="/admin/products/:productId/edit" element={<ProductFormPage />} /></Routes></AdminQueryProvider></MemoryRouter>) }
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); vi.resetAllMocks(); state.actor.role = 'OWNER'; vi.mocked(apiRequest).mockImplementation(async path => path.includes('/movements') ? history : path === '/products/one' ? product : page) })
test('products search filters and low stock', async () => { mount(); await screen.findByText('Pomade'); expect(screen.getByText('Low stock')).toBeInTheDocument(); fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'Brand' } }); fireEvent.click(screen.getByLabelText('Low stock only')); await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/products?q=Brand&active=true&low_stock=true&limit=25&offset=0', expect.anything())) })
test('inventory inactive filter and Staff read-only cards', async () => { state.actor.role = 'STAFF'; mount('/admin/inventory'); await screen.findByText('Pomade'); expect(screen.queryByText('Create product')).not.toBeInTheDocument(); expect(screen.queryByText('Edit product')).not.toBeInTheDocument(); fireEvent.click(screen.getByLabelText('Include inactive')); await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/inventory?q=&include_inactive=true&limit=25&offset=0', expect.anything())) })
test.each(['/admin/products/new', '/admin/products/one/edit'])('Staff direct mutation route denied %s', path => { state.actor.role = 'STAFF'; mount(path); expect(screen.getByText('Access denied.')).toBeInTheDocument(); expect(apiRequest).not.toHaveBeenCalled() })
test('empty products and failed read retry', async () => { vi.mocked(apiRequest).mockRejectedValue(new ApiError(403, 'Denied')); mount(); await screen.findByText('Denied'); vi.mocked(apiRequest).mockResolvedValue({ ...page, total: 0, items: [] }); fireEvent.click(screen.getByText('Retry')); await screen.findByText('No matching products.') })
test('create opening stock and flags uses same command ID on retry', async () => { vi.mocked(apiRequest).mockRejectedValue(new ApiError(409, 'Conflict')); mount('/admin/products/new'); fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pomade' } }); fireEvent.change(screen.getByLabelText('Opening quantity'), { target: { value: '4.125' } }); fireEvent.click(screen.getByLabelText('Public visibility')); fireEvent.click(screen.getByText('Save product')); await screen.findByText('Conflict'); const first = vi.mocked(apiRequest).mock.calls[0][1]?.body; expect(JSON.parse(String(first))).toMatchObject({ name: 'Pomade', opening_quantity: '4.125', is_public: true, request_id: expect.any(String) }); expect(screen.getByLabelText('Name')).toHaveValue('Pomade'); fireEvent.click(screen.getByText('Retry same save')); await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2)); expect(vi.mocked(apiRequest).mock.calls[1][1]?.body).toBe(first) })
test('edit metadata omits stock and opening quantity', async () => { mount('/admin/products/one/edit'); expect(await screen.findByLabelText('Name')).toHaveValue('Pomade'); fireEvent.click(screen.getByLabelText('Active')); fireEvent.click(screen.getByText('Save product')); await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/products/one', expect.objectContaining({ method: 'PUT' }))); const call = vi.mocked(apiRequest).mock.calls.find(([, options]) => options?.method === 'PUT'); const body = JSON.parse(String(call?.[1]?.body)); expect(body.is_active).toBe(false); expect(body).not.toHaveProperty('current_stock'); expect(body).not.toHaveProperty('opening_quantity') })
test('Staff movement history has permitted links and no stock controls', async () => { state.actor.role = 'STAFF'; vi.mocked(apiRequest).mockImplementation(async path => path.includes('/movements') ? { ...history, total: 1, items: [{ id: 'm', movement_type: 'USED', quantity: '-1', created_at: '2026-01-01T10:00Z', appointment_id: 'visit' }] } : product); mount('/admin/products/one'); await screen.findByText('View appointment'); expect(screen.queryByText('Change stock')).not.toBeInTheDocument(); expect(screen.getByText(/cannot reconcile/)).toBeInTheDocument(); expect(screen.queryByRole('option', { name: 'SOLD' })).not.toBeInTheDocument() })
test('adjustment reduction confirmation, failed command retention and exact retry', async () => { vi.mocked(apiRequest).mockImplementation(async (path, options) => { if (options?.method === 'POST') throw new ApiError(409, 'Insufficient stock'); return path.includes('/movements') ? history : product }); mount('/admin/products/one'); await screen.findByText('Change stock'); fireEvent.change(screen.getByLabelText('Stock action'), { target: { value: 'ADJUSTMENT' } }); fireEvent.change(screen.getByLabelText('Change stock by +/− quantity'), { target: { value: '-3' } }); fireEvent.click(screen.getByText('Review stock change')); expect(screen.getByText(/Expected result: -1.000/)).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Confirm stock change' })); await screen.findByText('Insufficient stock'); const first = vi.mocked(apiRequest).mock.calls.find(([, o]) => o?.method === 'POST')?.[1]?.body; fireEvent.click(screen.getByText('Retry same stock change')); await waitFor(() => expect(vi.mocked(apiRequest).mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(2)); expect(vi.mocked(apiRequest).mock.calls.filter(([, o]) => o?.method === 'POST')[1][1]?.body).toBe(first); expect(screen.getByLabelText('Change stock by +/− quantity')).toHaveValue('-3') })
test('damage uses positive quantity and successful write refreshes balance/history', async () => { vi.mocked(apiRequest).mockImplementation(async (path, options) => options?.method === 'POST' ? { product: { ...product, current_stock: '1.000' } } : path.includes('/movements') ? history : product); mount('/admin/products/one'); await screen.findByText('Change stock'); fireEvent.change(screen.getByLabelText('Stock action'), { target: { value: 'DAMAGED' } }); expect(screen.getByLabelText('Positive damaged quantity')).toHaveValue('1'); fireEvent.click(screen.getByText('Review stock change')); fireEvent.click(screen.getByRole('button', { name: 'Confirm stock change' })); await screen.findByText('Stock saved.'); const writes = vi.mocked(apiRequest).mock.calls.filter(([, o]) => o?.method === 'POST'); expect(JSON.parse(String(writes[0][1]?.body))).toMatchObject({ movement_type: 'DAMAGED', quantity: '1' }); await waitFor(() => expect(vi.mocked(apiRequest).mock.calls.filter(([path, o]) => path === '/products/one' && !o?.method).length).toBeGreaterThan(1)) })
test('ledger loading error and retry', async () => { vi.mocked(apiRequest).mockImplementation(async path => { if (path.includes('/movements')) throw new ApiError(422, 'Invalid filter'); return product }); mount('/admin/products/one'); await screen.findByText('Invalid filter'); vi.mocked(apiRequest).mockResolvedValue(history); fireEvent.click(screen.getByText('Retry history')); await screen.findByText('No movements.') })

test('Owner inventory cards highlight balances and offer stock and metadata actions', async () => {
  mount('/admin/inventory'); await screen.findByText('Pomade')
  expect(screen.getByText('Low stock')).toBeInTheDocument()
  expect(screen.getByText('Current stock')).toBeInTheDocument()
  expect(screen.getByText('Minimum stock')).toBeInTheDocument()
  expect(screen.getByRole('link',{name:'Manage stock'})).toHaveAttribute('href','/admin/products/one')
  expect(screen.getByRole('link',{name:'Edit product'})).toHaveAttribute('href','/admin/products/one/edit')
})
test('inventory filter changes reset pagination and Reset filters restores active products', async () => {
  vi.mocked(apiRequest).mockResolvedValue({...page,total:50})
  mount('/admin/inventory'); await screen.findByText('Pomade')
  fireEvent.click(screen.getByRole('button',{name:'Next'}))
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/inventory?q=&active=true&limit=25&offset=25',expect.anything()))
  fireEvent.change(screen.getByLabelText('Search products'),{target:{value:'Brand'}})
  fireEvent.click(screen.getByLabelText('Low stock only'))
  fireEvent.click(screen.getByLabelText('Include inactive'))
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/inventory?q=Brand&include_inactive=true&low_stock=true&limit=25&offset=0',expect.anything()))
  fireEvent.click(screen.getByRole('button',{name:'Reset filters'}))
  expect(screen.getByLabelText('Search products')).toHaveValue('')
  expect(screen.getByLabelText('Low stock only')).not.toBeChecked()
  expect(screen.getByLabelText('Include inactive')).not.toBeChecked()
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/inventory?q=&active=true&limit=25&offset=0',expect.anything()))
})
test('Staff inventory links to history without mutations or financial fields', async () => {
  state.actor.role='STAFF';mount('/admin/inventory');await screen.findByText('Pomade')
  expect(screen.getByRole('link',{name:'View history'})).toHaveAttribute('href','/admin/products/one')
  expect(screen.queryByRole('link',{name:'Manage stock'})).not.toBeInTheDocument()
  expect(screen.queryByRole('link',{name:'Edit product'})).not.toBeInTheDocument()
  expect(screen.queryByText(/Cost:/)).not.toBeInTheDocument()
})
test('empty filtered inventory offers reset without claiming global stock health', async () => {
  vi.mocked(apiRequest).mockResolvedValue({...page,items:[],total:0})
  mount('/admin/inventory');await screen.findByText('No matching products.')
  fireEvent.click(screen.getByLabelText('Low stock only'))
  expect(await screen.findByRole('button',{name:'Show active products'})).toBeInTheDocument()
  expect(screen.queryByText('Stock levels look good.')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Show active products'}))
  expect(screen.getByLabelText('Low stock only')).not.toBeChecked()
})

test('product editor groups metadata and keeps stock balance read-only', async () => {
  mount('/admin/products/one/edit'); await screen.findByLabelText('Name')
  expect(screen.getByRole('heading', {name:'Product information'})).toBeInTheDocument()
  expect(screen.getByRole('heading', {name:'Stock settings'})).toBeInTheDocument()
  expect(screen.getByLabelText('Description').tagName).toBe('TEXTAREA')
  expect(screen.queryByLabelText('Opening quantity')).not.toBeInTheDocument()
  expect(screen.getByRole('link', {name:'Back to product'})).toHaveAttribute('href','/admin/products/one')
  fireEvent.click(screen.getByRole('button', {name:'Cancel'}))
  await screen.findByText('Change stock')
  expect(vi.mocked(apiRequest).mock.calls.some(([,options])=>options?.method==='PUT')).toBe(false)
})
test('pending product save disables editing and cancellation', async () => {
  vi.mocked(apiRequest).mockImplementation(async (_path,options)=> options?.method==='PUT' ? new Promise(()=>{}) : product)
  mount('/admin/products/one/edit'); await screen.findByLabelText('Name')
  fireEvent.click(screen.getByRole('button',{name:'Save product'}))
  await screen.findByRole('button',{name:'Saving…'})
  expect(screen.getByLabelText('Name')).toBeDisabled()
  expect(screen.getByLabelText('Active')).toBeDisabled()
  expect(screen.getByRole('button',{name:'Cancel'})).toBeDisabled()
  expect(vi.mocked(apiRequest).mock.calls.filter(([,o])=>o?.method==='PUT')).toHaveLength(1)
})

test('product catalog shows Owner visibility and retail price with edit action',async()=>{
  mount();await screen.findByText('Pomade')
  expect(screen.getByText('Private')).toBeInTheDocument()
  expect(screen.getByText('Retail price')).toBeInTheDocument()
  expect(screen.getByRole('link',{name:'Edit product'})).toHaveAttribute('href','/admin/products/one/edit')
  fireEvent.change(screen.getByLabelText('Search products'),{target:{value:'Brand'}})
  fireEvent.click(screen.getByRole('button',{name:'Reset filters'}))
  expect(screen.getByLabelText('Search products')).toHaveValue('')
})
test('Staff product catalog omits financial and visibility settings',async()=>{
  state.actor.role='STAFF';mount();await screen.findByText('Pomade')
  expect(screen.queryByText('Retail price')).not.toBeInTheDocument()
  expect(screen.queryByText('Private')).not.toBeInTheDocument()
  expect(screen.queryByRole('link',{name:'Edit product'})).not.toBeInTheDocument()
  expect(screen.getByRole('link',{name:'View history'})).toHaveAttribute('href','/admin/products/one')
})
