import { FormError } from './form-error'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { ApiError, apiRequest } from '@/lib/api'
import { useAdminKey } from './query-provider'
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
  Plus,
  Search,
  Users,
  X,
  Pencil,
  Trash2,
  CalendarDays,
  Clock,
  Scissors,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Visit = {
  id: string
  scheduled_start: string
  appointment_notes: string | null
  visit_notes?: string | null
  final_duration_minutes: number
  final_price: string
  services: { name: string; price: string; duration_minutes: number }[]
  products: { name: string; quantity: string; usage_type: string }[]
}
type Client = {
  id: string
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  private_notes?: string | null
  is_archived?: boolean
  last_completed_visit?: Visit | null
}
type Page<T> = { items: T[]; total: number; limit: number; offset: number }
const inputClass = 'block w-full rounded border p-2'
function Failure({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div role="alert">
      <p>
        {error instanceof ApiError && error.status === 404 ? 'Client not found.' : error.message}
      </p>
      <button onClick={retry}>Retry</button>
    </div>
  )
}
function Pager({
  offset,
  total,
  onChange,
}: {
  offset: number
  total: number
  onChange: (n: number) => void
}) {
  return (
    <div className="client-pagination">
      <p className="text-sm text-muted-foreground">{total} results</p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - 25))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={offset + 25 >= total}
          onClick={() => onChange(offset + 25)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

export function ClientsPage() {
  const location = useLocation()
  const { actor } = useAuth()
  const owner = actor?.role === 'OWNER'
  const key = useAdminKey('clients')
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [q, setQ] = useState(() => searchParams.get('q') || '')
  const [offset, setOffset] = useState(() => Math.max(0, Number(searchParams.get('offset')) || 0))
  const [showArchived, setShowArchived] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim())
      if (search.trim() !== q) setOffset(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, q])
  useEffect(() => {
    setSearchParams(q || offset ? { q, offset: String(offset) } : {}, { replace: true })
  }, [q, offset, setSearchParams])
  const query = useQuery({
    queryKey: [...key, 'list', q, offset, showArchived],
    queryFn: ({ signal }) =>
      apiRequest<Page<Client>>(
        `/clients?q=${encodeURIComponent(q)}&limit=25&offset=${offset}${showArchived ? '&include_archived=true' : ''}`,
        {
          signal,
        },
      ),
  })
  const loading = query.isPending || search.trim() !== q
  return (
    <section className="clients-workspace space-y-6">
      {location.state?.clientArchived && (
        <p role="status" className="client-success">
          Client archived.
        </p>
      )}
      <div className="client-page-heading">
        <div>
          <h1>Clients</h1>
          <p className="text-sm text-muted-foreground">
            Find a client and review their visit history.
          </p>
        </div>
        {owner && (
          <Button asChild>
            <Link to="/admin/clients/new">
              <Plus size={18} aria-hidden="true" />
              Add client
            </Link>
          </Button>
        )}
      </div>
      <Card className="client-search-card">
        <CardContent>
          <Field>
            <FieldLabel htmlFor="client-search">
              {owner ? 'Search name, email or phone' : 'Search client name'}
            </FieldLabel>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground"
                size={18}
                aria-hidden="true"
              />
              <Input
                id="client-search"
                className="h-11 pl-10 pr-12"
                type="search"
                autoComplete="off"
                placeholder={owner ? 'Name, email or phone…' : 'Client name…'}
                value={search}
                maxLength={200}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <Button
                  className="absolute right-0 top-0 min-h-11"
                  variant="outline"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                >
                  <X size={16} aria-hidden="true" />
                </Button>
              )}
            </div>
            <FieldDescription>
              {owner
                ? 'Select a client to view contact details and previous visits.'
                : 'Read-only access. Contact details and private notes are hidden.'}
            </FieldDescription>
            {owner && (
              <label className="client-archive-filter">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(event) => {
                    setShowArchived(event.target.checked)
                    setOffset(0)
                  }}
                />
                Show archived clients
              </label>
            )}
          </Field>
        </CardContent>
      </Card>
      {loading ? (
        <div role="status">
          <span className="sr-only">Loading clients…</span>
          <div aria-hidden="true" className="client-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        </div>
      ) : query.isError ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {query.data.items.length > 0 ? (
            <ul className="client-grid">
              {query.data.items.map((client) => (
                <li key={client.id}>
                  <Card className="client-list-card">
                    <Link
                      className="client-card-link"
                      aria-label={`${client.first_name} ${client.last_name}`}
                      to={`/admin/clients/${client.id}`}
                      state={{ clientListSearch: searchParams.toString() }}
                    >
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="client-initials">
                          {client.first_name.slice(0, 1)}
                          {client.last_name.slice(0, 1)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h2 className="client-name">
                            {client.first_name} {client.last_name}
                          </h2>
                          <span className="text-xs text-muted-foreground">
                            View profile and history
                          </span>
                          {client.is_archived && (
                            <span className="client-archived-badge">Archived</span>
                          )}
                        </div>
                        <ArrowRight
                          className="shrink-0 text-muted-foreground"
                          size={18}
                          aria-hidden="true"
                        />
                      </div>
                      {owner && (
                        <div className="client-contact">
                          {client.email && (
                            <p>
                              <Mail size={15} aria-hidden="true" />
                              <span>{client.email}</span>
                            </p>
                          )}
                          {client.phone && (
                            <p>
                              <Phone size={15} aria-hidden="true" />
                              <span>{client.phone}</span>
                            </p>
                          )}
                          {!client.email && !client.phone && (
                            <p className="text-muted-foreground">No contact details added</p>
                          )}
                        </div>
                      )}
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Card>
              <CardContent className="client-empty">
                <Users size={32} className="text-muted-foreground" aria-hidden="true" />
                <h2>{q ? 'No matching clients.' : 'No clients yet.'}</h2>
                <p className="text-sm text-muted-foreground">
                  {q
                    ? 'Try a different name or clear your search.'
                    : owner
                      ? 'Add your first client with just their first and last name.'
                      : 'Clients added by the Owner will appear here.'}
                </p>
                {q ? (
                  <Button variant="outline" onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                ) : owner ? (
                  <Button asChild>
                    <Link to="/admin/clients/new">
                      <Plus size={18} aria-hidden="true" />
                      Add client
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )}
          <Pager offset={offset} total={query.data.total} onChange={setOffset} />
        </>
      )}
    </section>
  )
}
function VisitCard({ visit, owner }: { visit: Visit; owner: boolean }) {
  return (
    <Card className="client-visit-card">
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2">
            <CalendarDays size={18} aria-hidden="true" />
            {new Date(visit.scheduled_start).toLocaleString()}
          </span>
        </CardTitle>
        <CardDescription>
          <span className="flex items-center gap-2">
            <Clock size={16} aria-hidden="true" />
            {visit.final_duration_minutes} minutes · {visit.final_price}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h3 className="client-section-label">
            <Scissors size={16} aria-hidden="true" />
            Services
          </h3>
          <ul className="client-snapshot-list">
            {visit.services.map((service, i) => (
              <li key={i}>
                <span>{service.name}</span>
                <span className="text-muted-foreground">
                  {service.duration_minutes} minutes · {service.price}
                </span>
              </li>
            ))}
          </ul>
          {visit.services.length === 0 && (
            <p className="text-sm text-muted-foreground">No services recorded.</p>
          )}
        </div>
        <div>
          <h3 className="client-section-label">
            <Package size={16} aria-hidden="true" />
            Products {owner ? 'used or sold' : 'used'}
          </h3>
          <ul className="client-snapshot-list">
            {visit.products.map((product, i) => (
              <li key={i}>
                <span>{product.name}</span>
                <span className="text-muted-foreground">
                  {product.quantity} · {product.usage_type === 'SOLD' ? 'Sold' : 'Used'}
                </span>
              </li>
            ))}
          </ul>
          {visit.products.length === 0 && (
            <p className="text-sm text-muted-foreground">No products recorded.</p>
          )}
        </div>
        {visit.appointment_notes && (
          <div className="client-note-block">
            <h3 className="client-section-label">Appointment notes</h3>
            <p className="whitespace-pre-wrap break-words">
              Appointment notes: {visit.appointment_notes}
            </p>
          </div>
        )}
        {owner && visit.visit_notes && (
          <div className="client-note-block">
            <h3 className="client-section-label">Visit notes</h3>
            <p className="whitespace-pre-wrap break-words">Visit notes: {visit.visit_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
export function ClientProfilePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { clientId } = useParams()
  const { actor } = useAuth()
  const owner = actor?.role === 'OWNER'
  const key = useAdminKey('clients')
  const cache = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleting = useRef(false)
  useEffect(() => {
    setOffset(0)
    setDeleteOpen(false)
  }, [clientId])
  const listTo = location.state?.clientListSearch
    ? `/admin/clients?${location.state.clientListSearch}`
    : '/admin/clients'
  const profile = useQuery({
    queryKey: [...key, 'profile', clientId],
    queryFn: ({ signal }) => apiRequest<Client>(`/clients/${clientId}`, { signal }),
  })
  const history = useQuery({
    queryKey: [...key, 'history', clientId, offset],
    enabled: !!profile.data,
    queryFn: ({ signal }) =>
      apiRequest<Page<Visit>>(`/clients/${clientId}/history?limit=25&offset=${offset}`, { signal }),
  })
  const remove = useMutation({
    mutationFn: () => apiRequest<void>(`/clients/${clientId}`, { method: 'DELETE' }),
    onSuccess: () => {
      cache.removeQueries({ queryKey: [...key, 'profile', clientId] })
      cache.removeQueries({ queryKey: [...key, 'history', clientId] })
      void cache.invalidateQueries({ queryKey: [...key, 'list'] })
      navigate(listTo, { replace: true, state: { clientArchived: true } })
    },
  })
  if (profile.isPending)
    return (
      <div role="status">
        <span className="sr-only">Loading profile…</span>
        <Skeleton className="h-40 rounded-xl" aria-hidden="true" />
      </div>
    )
  if (profile.isError) return <Failure error={profile.error} retry={() => void profile.refetch()} />
  const client = profile.data
  const deleteError = remove.isError
    ? remove.error instanceof ApiError && remove.error.status === 409
      ? 'This client has linked appointments or feedback and cannot be deleted. Their business history must be preserved.'
      : remove.error instanceof ApiError && remove.error.status === 404
        ? 'This client no longer exists. Return to the client list.'
        : remove.error.message
    : ''
  return (
    <section className="clients-workspace client-profile space-y-6">
      <Link to={listTo} className="client-back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to clients
      </Link>
      <div className="client-page-heading">
        <div className="flex items-center gap-4">
          <span className="client-initials" aria-hidden="true">
            {client.first_name.slice(0, 1)}
            {client.last_name.slice(0, 1)}
          </span>
          <div>
            <h1>
              {client.first_name} {client.last_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Client profile · {owner ? 'Owner access' : 'Read-only access'}
            </p>
          </div>
        </div>
        {owner && (
          <Button variant="outline" asChild>
            <Link to={`/admin/clients/${clientId}/edit`}>
              <Pencil size={16} aria-hidden="true" />
              Edit client
            </Link>
          </Button>
        )}
      </div>
      {location.state?.saved && (
        <p role="status" className="client-success">
          Client saved.
        </p>
      )}
      <div className="client-profile-grid">
        <div className="space-y-6">
          {owner && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>Contact information</h2>
                  </CardTitle>
                  <CardDescription>Visible to Owners only.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="client-contact-row">
                    <Mail size={18} aria-hidden="true" />
                    <span className="break-words">{client.email || 'No email'}</span>
                  </p>
                  <p className="client-contact-row">
                    <Phone size={18} aria-hidden="true" />
                    <span className="break-words">{client.phone || 'No phone'}</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>General notes/preferences</h2>
                  </CardTitle>
                  <CardDescription>Private client information.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap break-words">
                    {client.private_notes || 'No general notes.'}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
          <section>
            <h2>Last completed visit</h2>
            {client.last_completed_visit ? (
              <VisitCard visit={client.last_completed_visit} owner={owner} />
            ) : (
              <Card>
                <CardContent className="client-empty">
                  <CalendarDays size={28} aria-hidden="true" />
                  <p>No completed visits yet.</p>
                </CardContent>
              </Card>
            )}
          </section>
        </div>
        <section className="space-y-4">
          <h2>Visit history</h2>
          <p className="text-sm text-muted-foreground">
            Completed appointments, most recent first.
          </p>
          {history.isPending ? (
            <p role="status">Loading history…</p>
          ) : history.isError ? (
            <Failure error={history.error} retry={() => void history.refetch()} />
          ) : (
            <>
              {history.data.items.map((visit) => (
                <VisitCard key={visit.id} visit={visit} owner={owner} />
              ))}
              {history.data.total === 0 && (
                <Card>
                  <CardContent className="client-empty">
                    <CalendarDays size={28} aria-hidden="true" />
                    <p>No visit history.</p>
                  </CardContent>
                </Card>
              )}
              <Pager offset={offset} total={history.data.total} onChange={setOffset} />
            </>
          )}
        </section>
      </div>
      {owner && (
        <Card className="client-danger-zone">
          <CardHeader>
            <CardTitle>
              <h2>Archive client</h2>
            </CardTitle>
            <CardDescription>
              Archive this client to preserve their profile and history while removing them from the
              active list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="client-delete-button"
              variant="outline"
              onClick={() => {
                remove.reset()
                setDeleteOpen(true)
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              Archive client
            </Button>
          </CardContent>
        </Card>
      )}
      {owner && (
        <AlertDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            if (!remove.isPending) setDeleteOpen(open)
          }}
        >
          <AlertDialogContent className="client-delete-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Archive {client.first_name} {client.last_name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This keeps the client’s profile, contact details and history, but hides them from
                the active client list. You can show archived clients from the client list.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError && (
              <p role="alert" className="client-delete-error">
                {deleteError}
              </p>
            )}
            {remove.isPending && <p role="status">Archiving client…</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="client-delete-button"
                disabled={remove.isPending}
                onClick={(event) => {
                  event.preventDefault()
                  if (deleting.current) return
                  deleting.current = true
                  remove.mutate(undefined, {
                    onSettled: () => {
                      deleting.current = false
                    },
                  })
                }}
              >
                {remove.isPending ? 'Archiving…' : 'Archive client'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  )
}

const blank = { first_name: '', last_name: '', email: '', phone: '', private_notes: '' }
export function ClientFormPage() {
  const { actor } = useAuth()
  const { clientId } = useParams()
  const key = useAdminKey('clients')
  const query = useQuery({
    queryKey: [...key, 'profile', clientId],
    enabled: actor?.role === 'OWNER' && !!clientId,
    queryFn: ({ signal }) => apiRequest<Client>(`/clients/${clientId}`, { signal }),
  })
  if (actor?.role !== 'OWNER') return <p role="alert">Access denied.</p>
  if (clientId && query.isPending) return <p role="status">Loading client…</p>
  if (clientId && query.isError)
    return <Failure error={query.error} retry={() => void query.refetch()} />
  return <ClientForm key={clientId || 'new'} client={query.data} clientId={clientId} />
}
function ClientForm({ client, clientId }: { client?: Client; clientId?: string }) {
  const [draft, setDraft] = useState(
    () =>
      ({
        ...blank,
        ...Object.fromEntries(
          Object.keys(blank).map((field) => [field, client?.[field as keyof Client] || '']),
        ),
      }) as typeof blank,
  )
  const [notice, setNotice] = useState('')
  const key = useAdminKey('clients')
  const cache = useQueryClient()
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<Client>(`/clients${clientId ? '/' + clientId : ''}`, {
        method: clientId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim() || null])),
        ),
      }),
    onSuccess: async (saved) => {
      await cache.invalidateQueries({ queryKey: key })
      navigate(`/admin/clients/${saved.id}`, { state: { saved: true } })
    },
  })
  const submitting = useRef(false)
  const busy = mutation.isPending
  const cancelTo = clientId ? `/admin/clients/${clientId}` : '/admin/clients'
  const labels = {
    first_name: 'First name',
    last_name: 'Last name',
    email: 'Email',
    phone: 'Phone',
    private_notes: 'General notes/preferences',
  }
  function field(field: keyof typeof blank) {
    const required = field === 'first_name' || field === 'last_name'
    const invalid = !!notice && required && !draft[field].trim()
    return (
      <Field key={field}>
        <FieldLabel htmlFor={`client-${field}`}>{labels[field]}</FieldLabel>
        {field === 'private_notes' ? (
          <Textarea
            id={`client-${field}`}
            rows={4}
            maxLength={10000}
            disabled={busy}
            value={draft[field]}
            onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
          />
        ) : (
          <Input
            id={`client-${field}`}
            className="h-11"
            required={required}
            disabled={busy}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'client-required-error' : undefined}
            autoComplete={
              field === 'first_name'
                ? 'given-name'
                : field === 'last_name'
                  ? 'family-name'
                  : field === 'phone'
                    ? 'tel'
                    : 'email'
            }
            type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
            maxLength={required ? 100 : field === 'email' ? 320 : 50}
            value={draft[field]}
            onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
          />
        )}
      </Field>
    )
  }
  return (
    <section className="clients-workspace client-form-page space-y-6">
      <Link to={cancelTo} className="client-back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to {clientId ? 'profile' : 'clients'}
      </Link>
      <div>
        <h1>{clientId ? 'Edit client' : 'Add client'}</h1>
        <p className="text-sm text-muted-foreground">
          {clientId
            ? 'Update contact details and preferences.'
            : 'Start with a name. You can add the other details later.'}
        </p>
      </div>
      <form
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault()
          if (submitting.current) return
          setNotice('')
          if (!draft.first_name.trim() || !draft.last_name.trim()) {
            setNotice('First and last name are required.')
            return
          }
          submitting.current = true
          mutation.mutate(undefined, {
            onSettled: () => {
              submitting.current = false
            },
          })
        }}
        className="space-y-5"
      >
        <Card>
          <CardHeader>
            <CardTitle>Client name</CardTitle>
            <CardDescription>First and last name are required.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="client-name-fields">
              {field('first_name')}
              {field('last_name')}
            </FieldGroup>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              Contact details{' '}
              <span className="text-xs font-normal text-muted-foreground">Optional</span>
            </CardTitle>
            <CardDescription>Visible to Owners only.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="client-name-fields">
              {field('email')}
              {field('phone')}
            </FieldGroup>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              Preferences and notes{' '}
              <span className="text-xs font-normal text-muted-foreground">Optional</span>
            </CardTitle>
            <CardDescription>Private client notes. Visible to Owners only.</CardDescription>
          </CardHeader>
          <CardContent>{field('private_notes')}</CardContent>
        </Card>
        {notice && <FormError id="client-required-error" message={notice} />}
        {mutation.isError && (
          <FormError
            message={
              mutation.error instanceof ApiError && mutation.error.status === 422
                ? 'Check the field formats and lengths.'
                : mutation.error.message
            }
          />
        )}
        <div className="client-form-actions">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save client'}
          </Button>
          {!busy && (
            <Button variant="outline" asChild>
              <Link to={cancelTo}>Cancel</Link>
            </Button>
          )}
        </div>
      </form>
    </section>
  )
}
