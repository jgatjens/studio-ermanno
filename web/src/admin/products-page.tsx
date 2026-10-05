import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { apiRequest } from '@/lib/api'
import { useAdminKey } from './query-provider'
import { ArrowRight, Package, Plus, Search, X, Pencil, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

type Product = {
  id: string
  name: string
  brand: string | null
  category: string | null
  description: string | null
  sku: string | null
  cost_price: string
  retail_price: string
  minimum_stock: string
  current_stock: string
  is_active: boolean
  is_public: boolean
  low_stock: boolean
}
type Movement = {
  id: string
  movement_type: string
  quantity: string
  created_at: string
  notes?: string | null
  appointment_id: string | null
}
type Page<T> = { items: T[]; total: number; limit: number; offset: number }
const field = 'block w-full min-w-0 rounded border p-3'
const button = 'rounded border px-3 py-3'
const empty = {
  name: '',
  brand: '',
  category: '',
  description: '',
  sku: '',
  cost_price: '0',
  retail_price: '0',
  minimum_stock: '0',
  is_active: true,
  is_public: false,
}
function useRefresh() {
  const cache = useQueryClient()
  const keys = [
    useAdminKey('products'),
    useAdminKey('inventory'),
    useAdminKey('appointments'),
    useAdminKey('clients'),
  ]
  return () => Promise.all(keys.map((queryKey) => cache.invalidateQueries({ queryKey })))
}

function stockQuantity(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1')
}

export function ProductsPage({ inventory = false }: { inventory?: boolean }) {
  const owner = useAuth().actor?.role === 'OWNER'
  const [q, setQ] = useState('')
  const [inactive, setInactive] = useState(false)
  const [low, setLow] = useState(false)
  const [offset, setOffset] = useState(0)
  const resource = inventory ? 'inventory' : 'products'
  const key = useAdminKey(resource)
  const query = useQuery({
    queryKey: [...key, q, inactive, low, offset],
    queryFn: ({ signal }) =>
      apiRequest<Page<Product>>(
        `/${resource}?q=${encodeURIComponent(q)}${inactive ? (inventory ? '&include_inactive=true' : '') : '&active=true'}${low ? '&low_stock=true' : ''}&limit=25&offset=${offset}`,
        { signal },
      ),
  })
  return (
    <section className="inventory-workspace space-y-6">
      <div className="inventory-page-heading">
        <div>
          <h1>{inventory ? 'Inventory' : 'Products'}</h1>
          <p className="text-sm text-muted-foreground">
            {inventory
              ? 'Check stock levels and find products that need attention.'
              : 'Browse your catalog and manage product information.'}
          </p>
        </div>
        {owner && (
          <Button asChild>
            <Link to="/admin/products/new">
              <Plus size={18} aria-hidden="true" />
              Create product
            </Link>
          </Button>
        )}
      </div>
      <Card>
        <CardContent>
          <Field>
            <FieldLabel htmlFor="inventory-search">Search products</FieldLabel>
            <div className="relative">
              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground"
              />
              <Input
                id="inventory-search"
                className="h-11 pl-10 pr-12"
                type="search"
                autoComplete="off"
                maxLength={200}
                placeholder="Name, brand, category or SKU…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setOffset(0)
                }}
              />
              {q && (
                <Button
                  variant="outline"
                  className="absolute right-0 top-0 min-h-11"
                  aria-label="Clear search"
                  onClick={() => {
                    setQ('')
                    setOffset(0)
                  }}
                >
                  <X size={16} aria-hidden="true" />
                </Button>
              )}
            </div>
            <FieldDescription>
              {owner
                ? inventory
                  ? 'Open a product to record stock changes and review its history.'
                  : 'Open a product for details or edit its catalog information.'
                : 'Read-only access. Open a product to view permitted movement history.'}
            </FieldDescription>
          </Field>
          <div className="inventory-filter-row">
            <div className="inventory-filter-options">
              <label htmlFor="inventory-low" className="inventory-filter-pill">
                <Checkbox
                  id="inventory-low"
                  checked={low}
                  onCheckedChange={(value) => {
                    setLow(value === true)
                    setOffset(0)
                  }}
                />
                Low stock only
              </label>
              <label htmlFor="inventory-inactive" className="inventory-filter-pill">
                <Checkbox
                  id="inventory-inactive"
                  checked={inactive}
                  onCheckedChange={(value) => {
                    setInactive(value === true)
                    setOffset(0)
                  }}
                />
                Include inactive
              </label>
            </div>
            {(q || low || inactive) && (
              <Button
                variant="outline"
                onClick={() => {
                  setQ('')
                  setLow(false)
                  setInactive(false)
                  setOffset(0)
                }}
              >
                Reset filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {query.isPending ? (
        <div role="status">
          <span className="sr-only">Loading products…</span>
          <div className="inventory-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-60 rounded-xl" />
            ))}
          </div>
        </div>
      ) : query.isError ? (
        <div role="alert">
          <p>{query.error.message}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{query.data.total} matching products</p>
          {query.data.items.length > 0 ? (
            <ul className="inventory-grid">
              {query.data.items.map((row) => (
                <li key={row.id}>
                  <Card
                    className={`inventory-card ${row.low_stock && row.is_active ? 'inventory-card-low' : ''}`}
                  >
                    <CardHeader>
                      <div className="inventory-card-heading">
                        <Link className="inventory-product-link" to={`/admin/products/${row.id}`}>
                          <h2>{row.name}</h2>
                          <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                        <div className="inventory-badges">
                          {(!inventory || !row.is_active) && (
                            <Badge variant="outline">{row.is_active ? 'Active' : 'Inactive'}</Badge>
                          )}
                          {!inventory && owner && (
                            <Badge variant="outline">{row.is_public ? 'Public' : 'Private'}</Badge>
                          )}
                          {row.low_stock ? (
                            <Badge variant="outline" className="inventory-low-badge">
                              <AlertTriangle size={13} aria-hidden="true" />
                              Low stock
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="inventory-stock-badge">
                              In stock
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[row.brand, row.category].filter(Boolean).join(' · ') ||
                          'No brand or category'}
                      </p>
                      {row.sku && (
                        <p className="text-xs text-muted-foreground break-words">SKU: {row.sku}</p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!inventory && row.description && (
                        <p className="product-card-description text-sm text-muted-foreground">
                          {row.description}
                        </p>
                      )}
                      {!inventory && owner && (
                        <div className="product-catalog-price">
                          <span>Retail price</span>
                          <strong>{row.retail_price}</strong>
                        </div>
                      )}
                      <div className="inventory-balance">
                        <div>
                          <p className="inventory-stock-label">Current stock</p>
                          <p className="inventory-stock-number">
                            {stockQuantity(row.current_stock)}
                          </p>
                        </div>
                        <div>
                          <p className="inventory-stock-label">Minimum stock</p>
                          <p className="inventory-stock-minimum">
                            {stockQuantity(row.minimum_stock)}
                          </p>
                        </div>
                      </div>
                      <div className="inventory-card-actions">
                        {owner ? (
                          <>
                            {!inventory && (
                              <Button asChild>
                                <Link
                                  className="inventory-manage-link"
                                  to={`/admin/products/${row.id}/edit`}
                                >
                                  <Pencil size={16} aria-hidden="true" />
                                  Edit product
                                </Link>
                              </Button>
                            )}
                            <Button variant={inventory ? 'default' : 'outline'} asChild>
                              <Link
                                className={inventory ? 'inventory-manage-link' : undefined}
                                to={`/admin/products/${row.id}`}
                              >
                                <Package size={16} aria-hidden="true" />
                                Manage stock
                              </Link>
                            </Button>
                            {inventory && (
                              <Button variant="outline" asChild>
                                <Link to={`/admin/products/${row.id}/edit`}>
                                  <Pencil size={16} aria-hidden="true" />
                                  Edit product
                                </Link>
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button variant="outline" asChild>
                            <Link to={`/admin/products/${row.id}`}>
                              View history
                              <ArrowRight size={16} aria-hidden="true" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Card>
              <CardContent className="inventory-empty">
                <Package size={32} aria-hidden="true" />
                <h2>No matching products.</h2>
                <p className="text-sm text-muted-foreground">
                  {q || low || inactive
                    ? 'Try another search or reset your filters.'
                    : owner
                      ? 'Create a product to start tracking its stock.'
                      : 'Products added by the Owner will appear here.'}
                </p>
                {q || low || inactive ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQ('')
                      setLow(false)
                      setInactive(false)
                      setOffset(0)
                    }}
                  >
                    Show active products
                  </Button>
                ) : owner ? (
                  <Button asChild>
                    <Link to="/admin/products/new">
                      <Plus size={16} aria-hidden="true" />
                      Create product
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )}
          <div className="inventory-pagination">
            <p className="text-sm text-muted-foreground">
              Showing {query.data.items.length ? offset + 1 : 0}–
              {query.data.items.length ? offset + query.data.items.length : 0} of {query.data.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 25))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={offset + 25 >= query.data.total}
                onClick={() => setOffset(offset + 25)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export function ProductFormPage() {
  const owner = useAuth().actor?.role === 'OWNER'
  const { productId } = useParams()
  const key = useAdminKey('products')
  const query = useQuery({
    queryKey: [...key, 'detail', productId],
    enabled: owner && !!productId,
    queryFn: ({ signal }) => apiRequest<Product>(`/products/${productId}`, { signal }),
  })
  if (!owner) return <p role="alert">Access denied.</p>
  if (productId && query.isPending) return <p role="status">Loading product…</p>
  if (productId && query.isError)
    return (
      <div role="alert">
        {query.error.message}
        <button className={button} onClick={() => void query.refetch()}>
          Retry
        </button>
      </div>
    )
  return <ProductForm key={productId || 'new'} product={query.data} />
}
function ProductForm({ product }: { product?: Product }) {
  const [draft, setDraft] = useState(() =>
    product
      ? ({
          ...empty,
          ...Object.fromEntries(
            Object.keys(empty).map((k) => [k, product[k as keyof Product] ?? '']),
          ),
        } as typeof empty)
      : empty,
  )
  const [opening, setOpening] = useState('0')
  const [requestId] = useState(() => crypto.randomUUID())
  const [attempt, setAttempt] = useState<string | null>(null)
  const navigate = useNavigate()
  const refresh = useRefresh()
  const mutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest<Product>(product ? `/products/${product.id}` : '/products', {
        method: product ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }),
    onSuccess: async (row) => {
      await refresh()
      navigate(`/admin/products/${row.id}`)
    },
  })
  function submit() {
    if (mutation.isPending) return
    const body = JSON.stringify({
      ...draft,
      ...(!product ? { opening_quantity: opening, request_id: requestId } : {}),
    })
    setAttempt(body)
    mutation.mutate(body)
  }
  const back = product ? `/admin/products/${product.id}` : '/admin/products'
  function input(
    key: 'name' | 'brand' | 'category' | 'sku' | 'cost_price' | 'retail_price' | 'minimum_stock',
    label: string,
  ) {
    return (
      <Field>
        <FieldLabel htmlFor={`product-${key}`}>{label}</FieldLabel>
        <Input
          id={`product-${key}`}
          required={['name', 'cost_price', 'retail_price', 'minimum_stock'].includes(key)}
          maxLength={key === 'sku' || key === 'category' ? 100 : 200}
          inputMode={key.includes('price') || key === 'minimum_stock' ? 'decimal' : 'text'}
          value={draft[key]}
          onChange={(e) => {
            setDraft({ ...draft, [key]: e.target.value })
            setAttempt(null)
          }}
        />
      </Field>
    )
  }
  return (
    <section className="product-editor space-y-6">
      <Button variant="outline" asChild>
        <Link to={back}>Back to {product ? 'product' : 'products'}</Link>
      </Button>
      <div>
        <h1>{product ? 'Edit product' : 'Create product'}</h1>
        <p className="text-sm text-muted-foreground">
          {product
            ? `Update ${product.name} and its catalog settings.`
            : 'Add a product to your catalog and set its opening stock.'}
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="space-y-6"
      >
        <fieldset disabled={mutation.isPending} className="product-editor-grid">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2>Product information</h2>
                <p className="text-sm text-muted-foreground">
                  Name is required. Other details help you find and identify the product.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {input('name', 'Name')}
                <div className="product-editor-pair">
                  {input('brand', 'Brand')}
                  {input('category', 'Category')}
                </div>
                {input('sku', 'SKU')}
                <Field>
                  <FieldLabel htmlFor="product-description">Description</FieldLabel>
                  <Textarea
                    id="product-description"
                    rows={5}
                    maxLength={10000}
                    value={draft.description}
                    onChange={(e) => {
                      setDraft({ ...draft, description: e.target.value })
                      setAttempt(null)
                    }}
                  />
                </Field>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2>Pricing</h2>
                <p className="text-sm text-muted-foreground">
                  Enter non-negative amounts using a decimal point.
                </p>
              </CardHeader>
              <CardContent className="product-editor-pair">
                {input('cost_price', 'Cost price')}
                {input('retail_price', 'Retail price')}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2>Stock settings</h2>
              </CardHeader>
              <CardContent className="space-y-5">
                {product && (
                  <div className="inventory-balance">
                    <div>
                      <p className="inventory-stock-label">Current stock</p>
                      <p className="inventory-stock-number">
                        {stockQuantity(product.current_stock)}
                      </p>
                    </div>
                  </div>
                )}
                {input('minimum_stock', 'Minimum stock')}
                <p className="text-sm text-muted-foreground">
                  The threshold used to flag low stock.
                </p>
                {product ? (
                  <p className="text-sm text-muted-foreground">
                    To change the balance, use Manage stock on the product page.
                  </p>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="product-opening">Opening quantity</FieldLabel>
                    <Input
                      id="product-opening"
                      inputMode="decimal"
                      value={opening}
                      onChange={(e) => {
                        setOpening(e.target.value)
                        setAttempt(null)
                      }}
                    />
                  </Field>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2>Status and visibility</h2>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <label htmlFor="product-active" className="product-editor-toggle">
                    <Checkbox
                      disabled={mutation.isPending}
                      id="product-active"
                      checked={draft.is_active}
                      onCheckedChange={(value) => {
                        setDraft({ ...draft, is_active: value === true })
                        setAttempt(null)
                      }}
                    />
                    Active
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Available for use in new appointments.
                  </p>
                </div>
                <div>
                  <label htmlFor="product-public" className="product-editor-toggle">
                    <Checkbox
                      disabled={mutation.isPending}
                      id="product-public"
                      checked={draft.is_public}
                      onCheckedChange={(value) => {
                        setDraft({ ...draft, is_public: value === true })
                        setAttempt(null)
                      }}
                    />
                    Public visibility
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Allow this product to appear in the public catalog when active.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </fieldset>
        {mutation.isPending && <p role="status">Saving product…</p>}
        {mutation.isError && (
          <div role="alert" className="rounded-lg border border-destructive p-4 space-y-3">
            <p>{mutation.error.message}</p>
            <p>Your draft is retained.</p>
            {attempt && (
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(attempt)}
              >
                Retry same save
              </Button>
            )}
          </div>
        )}
        <div className="product-editor-actions">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save product'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => navigate(back)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </section>
  )
}

export function ProductDetailPage() {
  const { productId } = useParams()
  const owner = useAuth().actor?.role === 'OWNER'
  const key = useAdminKey('products')
  const [offset, setOffset] = useState(0)
  const [type, setType] = useState('')
  const product = useQuery({
    queryKey: [...key, 'detail', productId],
    queryFn: ({ signal }) => apiRequest<Product>(`/products/${productId}`, { signal }),
  })
  const history = useQuery({
    queryKey: [...key, 'movements', productId, type, offset],
    queryFn: ({ signal }) =>
      apiRequest<Page<Movement>>(
        `/products/${productId}/movements?limit=25&offset=${offset}${type ? `&movement_type=${type}` : ''}`,
        { signal },
      ),
  })
  if (product.isPending) return <p role="status">Loading product…</p>
  if (product.isError)
    return (
      <div role="alert">
        {product.error.message}
        <button className={button} onClick={() => void product.refetch()}>
          Retry
        </button>
      </div>
    )
  const row = product.data
  return (
    <section className="space-y-4 break-words">
      <Link to="/admin/products">All products</Link>
      <h1>{row.name}</h1>
      <p>
        {row.brand} · {row.category} · SKU: {row.sku || 'None'}
      </p>
      <p>{row.description}</p>
      <p>
        Cost: {row.cost_price} · Retail: {row.retail_price}
      </p>
      <p>
        {row.is_active ? 'Active' : 'Inactive'} ·{' '}
        {row.is_public ? 'Public visibility enabled' : 'Private visibility'}
      </p>
      <p>
        Current stock: {row.current_stock} · Minimum: {row.minimum_stock}
      </p>
      {row.low_stock && <p>Low stock</p>}
      {owner && (
        <>
          <Link to={`/admin/products/${row.id}/edit`}>Edit product</Link>
          <StockForm product={row} />
        </>
      )}
      <h2>Movement history</h2>
      {!owner && (
        <p>
          Staff history omits sold products and private notes. This filtered history cannot
          reconcile the full balance.
        </p>
      )}
      <label>
        Movement type
        <select
          className={field}
          value={type}
          onChange={(e) => {
            setType(e.target.value)
            setOffset(0)
          }}
        >
          <option value="">All</option>
          {['STOCK_IN', 'ADJUSTMENT', 'DAMAGED', 'USED', ...(owner ? ['SOLD'] : [])].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </select>
      </label>
      {history.isPending ? (
        <p role="status">Loading movements…</p>
      ) : history.isError ? (
        <div role="alert">
          {history.error.message}
          <button className={button} onClick={() => void history.refetch()}>
            Retry history
          </button>
        </div>
      ) : (
        <>
          {!history.data.total && <p>No movements.</p>}
          {history.data.items.map((m) => (
            <article className="rounded border p-3" key={m.id}>
              <p>
                {m.movement_type} · {m.quantity} · {new Date(m.created_at).toLocaleString()}
              </p>
              {owner && m.notes && <p className="whitespace-pre-wrap">{m.notes}</p>}
              {m.appointment_id && (
                <Link to={`/admin/appointments/${m.appointment_id}`}>View appointment</Link>
              )}
            </article>
          ))}
          <div className="flex gap-3">
            <button className={button} disabled={!offset} onClick={() => setOffset(offset - 25)}>
              Previous movements
            </button>
            <button
              className={button}
              disabled={offset + 25 >= history.data.total}
              onClick={() => setOffset(offset + 25)}
            >
              Next movements
            </button>
          </div>
        </>
      )}
    </section>
  )
}
function StockForm({ product }: { product: Product }) {
  const [type, setType] = useState('STOCK_IN')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [attempt, setAttempt] = useState<string | null>(null)
  const [review, setReview] = useState(false)
  const refresh = useRefresh()
  const mutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest(`/products/${product.id}/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }),
    onSuccess: async () => {
      await refresh()
      setReview(false)
      setAttempt(null)
      setRequestId(crypto.randomUUID())
    },
  })
  function edit() {
    setReview(false)
    setAttempt(null)
    setRequestId(crypto.randomUUID())
    mutation.reset()
  }
  const delta = type === 'DAMAGED' ? -Number(quantity) : Number(quantity)
  const valid =
    /^-?\d+(\.\d{1,3})?$/.test(quantity) &&
    Number(quantity) !== 0 &&
    (type === 'ADJUSTMENT' || Number(quantity) > 0) &&
    Math.abs(Number(quantity)) <= 999999999.999
  return (
    <form
      className="space-y-3 rounded border p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setReview(true)
      }}
    >
      <h2>Change stock</h2>
      <fieldset disabled={mutation.isPending} className="space-y-3">
        <label>
          Stock action
          <select
            className={field}
            value={type}
            onChange={(e) => {
              edit()
              setType(e.target.value)
            }}
          >
            <option>STOCK_IN</option>
            <option>ADJUSTMENT</option>
            <option>DAMAGED</option>
          </select>
        </label>
        <label>
          {type === 'ADJUSTMENT'
            ? 'Change stock by +/− quantity'
            : type === 'DAMAGED'
              ? 'Positive damaged quantity'
              : 'Stock-in quantity'}
          <input
            className={field}
            inputMode="decimal"
            value={quantity}
            onChange={(e) => {
              edit()
              setQuantity(e.target.value)
            }}
          />
        </label>
        <label>
          Movement notes
          <textarea
            className={field}
            maxLength={10000}
            value={notes}
            onChange={(e) => {
              edit()
              setNotes(e.target.value)
            }}
          />
        </label>
        <p>
          Current balance: {product.current_stock} · Delta: {valid ? delta : 'Invalid'} · Expected
          result: {valid ? (Number(product.current_stock) + delta).toFixed(3) : 'Invalid'}
        </p>
        <p>The server verifies the final balance.</p>
        <button className={button} disabled={!valid}>
          Review stock change
        </button>
        {review && (
          <div role="group" aria-label="Confirm stock change">
            <p>Confirm this stock change?</p>
            <button
              type="button"
              className={button}
              onClick={() => {
                const body = JSON.stringify({
                  request_id: requestId,
                  movement_type: type,
                  quantity,
                  notes,
                })
                setAttempt(body)
                mutation.mutate(body)
              }}
            >
              Confirm stock change
            </button>
          </div>
        )}
      </fieldset>
      {mutation.isPending && <p role="status">Saving stock…</p>}
      {mutation.isSuccess && <p role="status">Stock saved.</p>}
      {mutation.isError && (
        <div role="alert">
          <p>{mutation.error.message}</p>
          <p>Your command and draft are retained; retrying the same command is safe.</p>
          {attempt && (
            <button type="button" className={button} onClick={() => mutation.mutate(attempt)}>
              Retry same stock change
            </button>
          )}
        </div>
      )}
    </form>
  )
}
