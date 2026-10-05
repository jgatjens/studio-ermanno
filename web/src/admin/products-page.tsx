import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { apiRequest } from '@/lib/api'
import { useAdminKey } from './query-provider'

type Product = { id: string; name: string; brand: string | null; category: string | null; description: string | null; sku: string | null; cost_price: string; retail_price: string; minimum_stock: string; current_stock: string; is_active: boolean; is_public: boolean; low_stock: boolean }
type Movement = { id: string; movement_type: string; quantity: string; created_at: string; notes?: string | null; appointment_id: string | null }
type Page<T> = { items: T[]; total: number; limit: number; offset: number }
const field = 'block w-full min-w-0 rounded border p-3'
const button = 'rounded border px-3 py-3'
const empty = { name: '', brand: '', category: '', description: '', sku: '', cost_price: '0', retail_price: '0', minimum_stock: '0', is_active: true, is_public: false }
function useRefresh() {
  const cache = useQueryClient()
  const keys = [useAdminKey('products'), useAdminKey('inventory'), useAdminKey('appointments'), useAdminKey('clients')]
  return () => Promise.all(keys.map(queryKey => cache.invalidateQueries({ queryKey })))
}

export function ProductsPage({ inventory = false }: { inventory?: boolean }) {
  const owner = useAuth().actor?.role === 'OWNER'
  const [q, setQ] = useState('')
  const [inactive, setInactive] = useState(false)
  const [low, setLow] = useState(false)
  const [offset, setOffset] = useState(0)
  const resource = inventory ? 'inventory' : 'products'
  const key = useAdminKey(resource)
  const query = useQuery({ queryKey: [...key, q, inactive, low, offset], queryFn: ({ signal }) => apiRequest<Page<Product>>(`/${resource}?q=${encodeURIComponent(q)}${inactive ? (inventory ? '&include_inactive=true' : '') : '&active=true'}${low ? '&low_stock=true' : ''}&limit=25&offset=${offset}`, { signal }) })
  return <section className="space-y-4"><h1>{inventory ? 'Inventory' : 'Products'}</h1>{owner && <Link to="/admin/products/new">Create product</Link>}
    <label>Search products<input className={field} maxLength={200} value={q} onChange={e => { setQ(e.target.value); setOffset(0) }} /></label>
    <label className="block"><input type="checkbox" checked={inactive} onChange={e => { setInactive(e.target.checked); setOffset(0) }} /> Include inactive</label>
    <label className="block"><input type="checkbox" checked={low} onChange={e => { setLow(e.target.checked); setOffset(0) }} /> Low stock only</label>
    {query.isPending ? <p role="status">Loading products…</p> : query.isError ? <div role="alert">{query.error.message}<button className={button} onClick={() => void query.refetch()}>Retry</button></div> : <>
      {!query.data.total && <p>No matching products.</p>}
      {query.data.items.map(row => <article key={row.id} className="space-y-2 rounded border p-4 break-words"><h2><Link to={`/admin/products/${row.id}`}>{row.name}</Link></h2><p>{row.brand} · {row.category} · {row.is_active ? 'Active' : 'Inactive'}</p><p>Current stock: {row.current_stock} · Minimum: {row.minimum_stock}</p>{row.low_stock && <p className="font-semibold">Low stock</p>}{owner && <Link to={`/admin/products/${row.id}/edit`}>Edit product</Link>}</article>)}
      <div className="flex gap-3"><button className={button} disabled={!offset} onClick={() => setOffset(offset - 25)}>Previous</button><button className={button} disabled={offset + 25 >= query.data.total} onClick={() => setOffset(offset + 25)}>Next</button></div>
    </>}
  </section>
}

export function ProductFormPage() {
  const owner = useAuth().actor?.role === 'OWNER'
  const { productId } = useParams()
  const key = useAdminKey('products')
  const query = useQuery({ queryKey: [...key, 'detail', productId], enabled: owner && !!productId, queryFn: ({ signal }) => apiRequest<Product>(`/products/${productId}`, { signal }) })
  if (!owner) return <p role="alert">Access denied.</p>
  if (productId && query.isPending) return <p role="status">Loading product…</p>
  if (productId && query.isError) return <div role="alert">{query.error.message}<button className={button} onClick={() => void query.refetch()}>Retry</button></div>
  return <ProductForm key={productId || 'new'} product={query.data} />
}
function ProductForm({ product }: { product?: Product }) {
  const [draft, setDraft] = useState(() => product ? { ...empty, ...Object.fromEntries(Object.keys(empty).map(k => [k, product[k as keyof Product] ?? ''])) } as typeof empty : empty)
  const [opening, setOpening] = useState('0')
  const [requestId] = useState(() => crypto.randomUUID())
  const [attempt, setAttempt] = useState<string | null>(null)
  const navigate = useNavigate()
  const refresh = useRefresh()
  const mutation = useMutation({ mutationFn: (body: string) => apiRequest<Product>(product ? `/products/${product.id}` : '/products', { method: product ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body }), onSuccess: async row => { await refresh(); navigate(`/admin/products/${row.id}`) } })
  function submit() { const body = JSON.stringify({ ...draft, ...(!product ? { opening_quantity: opening, request_id: requestId } : {}) }); setAttempt(body); mutation.mutate(body) }
  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); submit() }}><h1>{product ? 'Edit product' : 'Create product'}</h1><fieldset disabled={mutation.isPending} className="space-y-3">
    {(['name', 'brand', 'category', 'description', 'sku', 'cost_price', 'retail_price', 'minimum_stock'] as const).map(key => <label className="block" key={key}>{({ name: 'Name', brand: 'Brand', category: 'Category', description: 'Description', sku: 'SKU', cost_price: 'Cost price', retail_price: 'Retail price', minimum_stock: 'Minimum stock' })[key]}<input className={field} required={['name', 'cost_price', 'retail_price', 'minimum_stock'].includes(key)} maxLength={key === 'description' ? 10000 : key === 'sku' || key === 'category' ? 100 : 200} inputMode={key.includes('price') || key === 'minimum_stock' ? 'decimal' : 'text'} value={draft[key]} onChange={e => { setDraft({ ...draft, [key]: e.target.value }); setAttempt(null) }} /></label>)}
    <label className="block"><input type="checkbox" checked={draft.is_active} onChange={e => { setDraft({ ...draft, is_active: e.target.checked }); setAttempt(null) }} /> Active</label>
    <label className="block"><input type="checkbox" checked={draft.is_public} onChange={e => { setDraft({ ...draft, is_public: e.target.checked }); setAttempt(null) }} /> Public visibility</label>
    {!product && <label>Opening quantity<input className={field} inputMode="decimal" value={opening} onChange={e => { setOpening(e.target.value); setAttempt(null) }} /></label>}
    <button className={button}>Save product</button></fieldset>
    {mutation.isPending && <p role="status">Saving product…</p>}{mutation.isError && <div role="alert"><p>{mutation.error.message}</p><p>Your draft is retained.</p>{attempt && <button type="button" className={button} onClick={() => mutation.mutate(attempt)}>Retry same save</button>}</div>}
  </form>
}

export function ProductDetailPage() {
  const { productId } = useParams()
  const owner = useAuth().actor?.role === 'OWNER'
  const key = useAdminKey('products')
  const [offset, setOffset] = useState(0)
  const [type, setType] = useState('')
  const product = useQuery({ queryKey: [...key, 'detail', productId], queryFn: ({ signal }) => apiRequest<Product>(`/products/${productId}`, { signal }) })
  const history = useQuery({ queryKey: [...key, 'movements', productId, type, offset], queryFn: ({ signal }) => apiRequest<Page<Movement>>(`/products/${productId}/movements?limit=25&offset=${offset}${type ? `&movement_type=${type}` : ''}`, { signal }) })
  if (product.isPending) return <p role="status">Loading product…</p>
  if (product.isError) return <div role="alert">{product.error.message}<button className={button} onClick={() => void product.refetch()}>Retry</button></div>
  const row = product.data
  return <section className="space-y-4 break-words"><Link to="/admin/products">All products</Link><h1>{row.name}</h1><p>{row.brand} · {row.category} · SKU: {row.sku || 'None'}</p><p>{row.description}</p><p>Cost: {row.cost_price} · Retail: {row.retail_price}</p><p>{row.is_active ? 'Active' : 'Inactive'} · {row.is_public ? 'Public visibility enabled' : 'Private visibility'}</p><p>Current stock: {row.current_stock} · Minimum: {row.minimum_stock}</p>{row.low_stock && <p>Low stock</p>}{owner && <><Link to={`/admin/products/${row.id}/edit`}>Edit product</Link><StockForm product={row} /></>}
    <h2>Movement history</h2>{!owner && <p>Staff history omits sold products and private notes. This filtered history cannot reconcile the full balance.</p>}
    <label>Movement type<select className={field} value={type} onChange={e => { setType(e.target.value); setOffset(0) }}><option value="">All</option>{['STOCK_IN', 'ADJUSTMENT', 'DAMAGED', 'USED', ...(owner ? ['SOLD'] : [])].map(value => <option key={value}>{value}</option>)}</select></label>
    {history.isPending ? <p role="status">Loading movements…</p> : history.isError ? <div role="alert">{history.error.message}<button className={button} onClick={() => void history.refetch()}>Retry history</button></div> : <>
      {!history.data.total && <p>No movements.</p>}{history.data.items.map(m => <article className="rounded border p-3" key={m.id}><p>{m.movement_type} · {m.quantity} · {new Date(m.created_at).toLocaleString()}</p>{owner && m.notes && <p className="whitespace-pre-wrap">{m.notes}</p>}{m.appointment_id && <Link to={`/admin/appointments/${m.appointment_id}`}>View appointment</Link>}</article>)}
      <div className="flex gap-3"><button className={button} disabled={!offset} onClick={() => setOffset(offset - 25)}>Previous movements</button><button className={button} disabled={offset + 25 >= history.data.total} onClick={() => setOffset(offset + 25)}>Next movements</button></div>
    </>}
  </section>
}
function StockForm({ product }: { product: Product }) {
  const [type, setType] = useState('STOCK_IN')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [attempt, setAttempt] = useState<string | null>(null)
  const [review, setReview] = useState(false)
  const refresh = useRefresh()
  const mutation = useMutation({ mutationFn: (body: string) => apiRequest(`/products/${product.id}/movements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }), onSuccess: async () => { await refresh(); setReview(false); setAttempt(null); setRequestId(crypto.randomUUID()) } })
  function edit() { setReview(false); setAttempt(null); setRequestId(crypto.randomUUID()); mutation.reset() }
  const delta = type === 'DAMAGED' ? -Number(quantity) : Number(quantity)
  const valid = /^-?\d+(\.\d{1,3})?$/.test(quantity) && Number(quantity) !== 0 && (type === 'ADJUSTMENT' || Number(quantity) > 0) && Math.abs(Number(quantity)) <= 999999999.999
  return <form className="space-y-3 rounded border p-4" onSubmit={e => { e.preventDefault(); setReview(true) }}><h2>Change stock</h2><fieldset disabled={mutation.isPending} className="space-y-3">
    <label>Stock action<select className={field} value={type} onChange={e => { edit(); setType(e.target.value) }}><option>STOCK_IN</option><option>ADJUSTMENT</option><option>DAMAGED</option></select></label>
    <label>{type === 'ADJUSTMENT' ? 'Change stock by +/− quantity' : type === 'DAMAGED' ? 'Positive damaged quantity' : 'Stock-in quantity'}<input className={field} inputMode="decimal" value={quantity} onChange={e => { edit(); setQuantity(e.target.value) }} /></label>
    <label>Movement notes<textarea className={field} maxLength={10000} value={notes} onChange={e => { edit(); setNotes(e.target.value) }} /></label>
    <p>Current balance: {product.current_stock} · Delta: {valid ? delta : 'Invalid'} · Expected result: {valid ? (Number(product.current_stock) + delta).toFixed(3) : 'Invalid'}</p><p>The server verifies the final balance.</p><button className={button} disabled={!valid}>Review stock change</button>
    {review && <div role="group" aria-label="Confirm stock change"><p>Confirm this stock change?</p><button type="button" className={button} onClick={() => { const body = JSON.stringify({ request_id: requestId, movement_type: type, quantity, notes }); setAttempt(body); mutation.mutate(body) }}>Confirm stock change</button></div>}
    </fieldset>{mutation.isPending && <p role="status">Saving stock…</p>}{mutation.isSuccess && <p role="status">Stock saved.</p>}{mutation.isError && <div role="alert"><p>{mutation.error.message}</p><p>Your command and draft are retained; retrying the same command is safe.</p>{attempt && <button type="button" className={button} onClick={() => mutation.mutate(attempt)}>Retry same stock change</button>}</div>}
  </form>
}
