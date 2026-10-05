import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { apiRequest } from '@/lib/api'
import { useAdminKey } from '../query-provider'
import { displayTime } from './time'
import type { Appointment, Context, Page } from './types'

type Product = { id: string; name: string; brand: string | null; category: string | null }
type Selection = { product: Product; usage_type: 'USED' | 'SOLD'; quantity: string }
const field = 'block w-full min-w-0 rounded border p-3'
const button = 'rounded border px-3 py-2'

export function AppointmentCompletePage() {
  const owner = useAuth().actor?.role === 'OWNER'
  const { appointmentId } = useParams()
  const key = useAdminKey('appointments')
  const query = useQuery({
    queryKey: [...key, 'detail', appointmentId],
    enabled: owner,
    queryFn: ({ signal }) => apiRequest<Appointment>(`/appointments/${appointmentId}`, { signal }),
  })
  const context = useQuery({
    queryKey: [...key, 'context'],
    enabled: owner,
    queryFn: ({ signal }) => apiRequest<Context>('/appointments/context', { signal }),
  })
  if (!owner) return <p role="alert">Access denied.</p>
  if ((query.isError && !query.data) || (context.isError && !context.data))
    return (
      <div role="alert">
        <p>{(query.error || context.error)?.message}</p>
        <button
          className={button}
          onClick={() => {
            void query.refetch()
            void context.refetch()
          }}
        >
          Retry
        </button>
      </div>
    )
  if (query.isPending || context.isPending) return <p role="status">Loading completion…</p>
  return <CompletionView key={appointmentId} appointment={query.data!} context={context.data!} />
}

function CompletionView({ appointment, context }: { appointment: Appointment; context: Context }) {
  // Preserve the reviewed snapshot and draft across background refetches, including
  // an uncertain transport outcome that already committed on the server.
  const [reviewed] = useState(appointment)
  if (!['SCHEDULED', 'CONFIRMED'].includes(reviewed.status))
    return (
      <section>
        <p>This appointment is {reviewed.status} and is read only.</p>
        <Link to={`/admin/appointments/${reviewed.id}`}>View appointment</Link>
      </section>
    )
  return <CompletionForm appointment={reviewed} context={context} />
}

function CompletionForm({ appointment, context }: { appointment: Appointment; context: Context }) {
  const key = useAdminKey('appointments')
  const productsKey = useAdminKey('products')
  const inventoryKey = useAdminKey('inventory')
  const clientsKey = useAdminKey('clients')
  const cache = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Selection[]>([])
  const [notes, setNotes] = useState('')
  const [review, setReview] = useState(false)
  const [notice, setNotice] = useState('')
  // Keep the exact attempted body for a safe retry after an uncertain transport
  // outcome. Deliberately editing a draft requires reviewing a new command.
  const [attempt, setAttempt] = useState<string | null>(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim())
      setOffset(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])
  const products = useQuery({
    queryKey: [...key, 'completion-products', q, offset],
    queryFn: ({ signal }) =>
      apiRequest<Page<Product>>(
        `/appointments/completion-products?q=${encodeURIComponent(q)}&limit=25&offset=${offset}`,
        { signal },
      ),
  })
  const mutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest<Appointment>(`/appointments/${appointment.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: key }),
        cache.invalidateQueries({ queryKey: clientsKey }),
        cache.invalidateQueries({ queryKey: productsKey }),
        cache.invalidateQueries({ queryKey: inventoryKey }),
      ])
      navigate(`/admin/appointments/${appointment.id}`, { state: { completed: true } })
    },
  })
  function edited() {
    setReview(false)
    setAttempt(null)
    setNotice('')
  }
  function add(product: Product) {
    if (selected.length >= 50) {
      setNotice('Record at most 50 product entries.')
      return
    }
    if (selected.some((row) => row.product.id === product.id && row.usage_type === 'USED')) {
      setNotice('This product is already selected as USED. Change its usage or quantity below.')
      return
    }
    edited()
    setSelected([...selected, { product, usage_type: 'USED', quantity: '1' }])
  }
  function prepare() {
    const pairs = selected.map((row) => `${row.product.id}:${row.usage_type}`)
    if (new Set(pairs).size !== pairs.length) {
      setNotice('Combine duplicate product and usage selections.')
      return
    }
    if (
      selected.some(
        (row) =>
          !/^\d+(\.\d{1,3})?$/.test(row.quantity) ||
          Number(row.quantity) <= 0 ||
          Number(row.quantity) > 999999999.999,
      )
    ) {
      setNotice('Quantities must be positive with at most three decimal places.')
      return
    }
    setNotice('')
    setReview(true)
  }
  function submit() {
    const body = JSON.stringify({
      service_ids: appointment.services.map((row) => row.service_id),
      products: selected.map((row) => ({
        product_id: row.product.id,
        usage_type: row.usage_type,
        quantity: row.quantity,
      })),
      visit_notes: notes.trim() || null,
    })
    setAttempt(body)
    mutation.mutate(body)
  }
  return (
    <section className="appointment-complete-workspace break-words">
      <Link to={`/admin/appointments/${appointment.id}`}>Back to appointment</Link>
      <div className="appointment-complete-heading">
        <div>
          <h1>Complete appointment</h1>
          <p className="appointment-complete-subtitle">
            {appointment.client.first_name} {appointment.client.last_name} ·{' '}
            {displayTime(appointment.scheduled_start, context.timezone)} ({context.timezone})
          </p>
        </div>
        <span className="appointment-complete-badge">Completion</span>
      </div>
      <section className="appointment-complete-card">
        <h2>Confirm services and totals</h2>
        <ul className="appointment-complete-services">
          {appointment.services.map((service) => (
            <li key={service.service_id}>
              {service.name} · {service.duration_minutes} minutes · {service.price}
            </li>
          ))}
        </ul>
        <p className="appointment-complete-total">
          Final: {appointment.final_duration_minutes} minutes · {appointment.final_price}{' '}
          {context.currency}
        </p>
        <p className="appointment-complete-help">
          Completion preserves these snapshots and totals. Correct services or totals before
          entering completion details.
        </p>
        <Link
          className="appointment-complete-edit"
          to={`/admin/appointments/${appointment.id}/edit`}
        >
          Edit services or totals first
        </Link>
        <p className="appointment-complete-stock-note">
          Completing this appointment deducts all USED and SOLD quantities from stock atomically.
          Insufficient stock keeps your draft available for correction.
        </p>
        <fieldset className="space-y-3" disabled={mutation.isPending}>
          <legend>Products used or sold</legend>
          <label>
            Search products
            <input
              className={field}
              maxLength={200}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {products.isPending || search.trim() !== q ? (
            <p role="status">Loading products…</p>
          ) : products.isError ? (
            <div role="alert">
              <p>{products.error.message}</p>
              <button type="button" className={button} onClick={() => void products.refetch()}>
                Retry products
              </button>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {products.data.items.map((product) => (
                  <li key={product.id}>
                    <button type="button" className={button} onClick={() => add(product)}>
                      Add {product.name}
                      {product.brand ? ` (${product.brand})` : ''}
                    </button>
                  </li>
                ))}
              </ul>
              {!products.data.total && <p>No matching active products.</p>}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={button}
                  disabled={!offset}
                  onClick={() => setOffset(Math.max(0, offset - 25))}
                >
                  Previous products
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={offset + 25 >= products.data.total}
                  onClick={() => setOffset(offset + 25)}
                >
                  Next products
                </button>
              </div>
            </>
          )}
          {selected.length === 0 && <p>No products recorded.</p>}
          {selected.map((row, index) => (
            <div className="space-y-2 rounded border p-3" key={index}>
              <p>{row.product.name}</p>
              <label>
                Usage for {row.product.name} {index + 1}
                <select
                  className={field}
                  value={row.usage_type}
                  onChange={(event) => {
                    edited()
                    setSelected(
                      selected.map((item, i) =>
                        i === index
                          ? { ...item, usage_type: event.target.value as 'USED' | 'SOLD' }
                          : item,
                      ),
                    )
                  }}
                >
                  <option>USED</option>
                  <option>SOLD</option>
                </select>
              </label>
              <label>
                Quantity for {row.product.name} {index + 1}
                <input
                  className={field}
                  inputMode="decimal"
                  value={row.quantity}
                  onChange={(event) => {
                    edited()
                    setSelected(
                      selected.map((item, i) =>
                        i === index ? { ...item, quantity: event.target.value } : item,
                      ),
                    )
                  }}
                />
              </label>
              <button
                type="button"
                className={button}
                onClick={() => {
                  edited()
                  setSelected(selected.filter((_, i) => i !== index))
                }}
              >
                Remove {row.product.name} {index + 1}
              </button>
            </div>
          ))}
          <label>
            Visit notes
            <textarea
              className={field}
              maxLength={10000}
              value={notes}
              onChange={(event) => {
                edited()
                setNotes(event.target.value)
              }}
            />
          </label>
          <button type="button" className={button} onClick={prepare}>
            Review completion
          </button>
        </fieldset>
      </section>
      {review && (
        <div role="group" aria-label="Review completion" className="appointment-complete-review">
          <p>Complete this appointment with the services and totals shown above?</p>
          <ul>
            {selected.map((row, index) => (
              <li key={index}>
                {row.product.name} · {row.usage_type} · {row.quantity}
              </li>
            ))}
          </ul>
          <p className="whitespace-pre-wrap">{notes || 'No visit notes.'}</p>
          <p>Completed visits cannot be edited or reopened.</p>
          <button type="button" className={button} disabled={mutation.isPending} onClick={submit}>
            Confirm completion
          </button>
        </div>
      )}
      {notice && (
        <p className="appointment-complete-alert" role="alert">
          {notice}
        </p>
      )}
      {mutation.isPending && <p role="status">Completing appointment…</p>}
      {mutation.isError && (
        <div className="appointment-complete-alert" role="alert">
          <p>{mutation.error.message}</p>
          <p>
            Your draft is retained. If the request failed after saving, retrying the same details is
            safe. If the appointment changed, reload and review before submitting different details.
          </p>
          {attempt && (
            <button
              className={button}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(attempt)}
            >
              Retry same completion
            </button>
          )}
        </div>
      )}
    </section>
  )
}
