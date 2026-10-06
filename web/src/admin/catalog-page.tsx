import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/auth/auth-provider'
import { useAdminKey } from './query-provider'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  Search,
  Scissors,
  Clock,
  Pencil,
  X,
  UserPlus,
  UserRound,
  UserRoundCheck,
  UserRoundX,
} from 'lucide-react'

export type CatalogRecord = {
  id: string
  name: string
  is_active: boolean
  description?: string | null
  duration_minutes?: number
  price?: string
}
type Draft = {
  name: string
  is_active: boolean
  description: string
  duration: string
  price: string
}
const blank: Draft = { name: '', is_active: true, description: '', duration: '30', price: '0.00' }

export function CatalogPage({ resource }: { resource: 'services' | 'barbers' }) {
  const services = resource === 'services'
  const primaryButton =
    'bg-black! text-white! border-black! hover:bg-neutral-800! hover:border-neutral-800!'
  const secondaryButton =
    'bg-transparent! text-neutral-900! border-neutral-300! hover:bg-neutral-100! hover:border-neutral-400!'
  const title = services ? 'Services' : 'Hairdressers'
  const plural = services ? 'services' : 'hairdressers'
  const singular = services ? 'service' : 'hairdresser'
  const { actor } = useAuth()
  const owner = actor?.role === 'OWNER'
  const key = useAdminKey(resource)
  const client = useQueryClient()
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiRequest<CatalogRecord[]>(`/${resource}`, { signal }),
  })
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(blank)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const editor = useRef<HTMLHeadingElement>(null)
  const mutation = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: object }) =>
      apiRequest(`/${resource}${id ? '/' + id : ''}`, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      setEditing(null)
      setDraft(blank)
      setNotice('Saved.')
      await client.invalidateQueries({ queryKey: key })
    },
  })
  function body(value: CatalogRecord) {
    return services
      ? {
          name: value.name,
          is_active: value.is_active,
          description: value.description ?? null,
          duration_minutes: value.duration_minutes,
          price: value.price,
        }
      : { name: value.name, is_active: value.is_active }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (mutation.isPending) return
    setNotice('')
    mutation.mutate({
      id: editing ?? undefined,
      body: services
        ? {
            name: draft.name,
            is_active: draft.is_active,
            description: draft.description || null,
            duration_minutes: Number(draft.duration),
            price: draft.price,
          }
        : { name: draft.name, is_active: draft.is_active },
    })
  }
  function openEditor(record?: CatalogRecord) {
    mutation.reset()
    setNotice('')
    setEditing(record?.id ?? null)
    setDraft(
      record
        ? {
            name: record.name,
            is_active: record.is_active,
            description: record.description ?? '',
            duration: String(record.duration_minutes ?? 30),
            price: record.price ?? '0.00',
          }
        : blank,
    )
    editor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    editor.current?.focus()
  }
  {
    const matches = query.data?.filter((record) =>
      `${record.name} ${record.description ?? ''}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    )
    return (
      <section
        className={`services-workspace space-y-6${services ? '' : ' hairdressers-workspace'}`}
      >
        <div className="services-heading">
          <div>
            <h1>{title}</h1>
            <p className="text-sm text-muted-foreground">
              {services
                ? owner
                  ? 'Manage your service catalog, durations and prices.'
                  : 'View services, durations and prices. Read-only access.'
                : owner
                  ? 'Manage your team and appointment assignments.'
                  : 'View the team. Read-only access.'}
            </p>
          </div>
          {owner && (
            <Button
              className={primaryButton}
              disabled={mutation.isPending}
              onClick={() => openEditor()}
            >
              {services ? (
                <Plus size={18} aria-hidden="true" />
              ) : (
                <UserPlus size={18} aria-hidden="true" />
              )}
              Create {singular}
            </Button>
          )}
        </div>
        <Card>
          <CardContent>
            <Field>
              <FieldLabel htmlFor="services-search">Search {plural}</FieldLabel>
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="services-search"
                  type="search"
                  className="pl-10 pr-12"
                  placeholder={services ? 'Name or description…' : 'Hairdresser name…'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <Button
                    variant="outline"
                    className={`absolute right-0 top-0 ${secondaryButton ?? ''}`}
                    aria-label="Clear search"
                    onClick={() => setSearch('')}
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
            </Field>
          </CardContent>
        </Card>
        {query.isPending && (
          <div role="status" className="services-grid">
            <span className="sr-only">Loading {plural}…</span>
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-48 rounded-xl" />
            ))}
          </div>
        )}
        {query.isError && (
          <div role="alert">
            <p>{query.error.message}</p>
            <Button
              className={secondaryButton}
              variant="outline"
              onClick={() => void query.refetch()}
            >
              Retry
            </Button>
          </div>
        )}
        {query.data && (
          <>
            <p className="text-sm text-muted-foreground">
              {matches?.length} matching {plural}
            </p>
            {matches?.length ? (
              <ul className="services-grid">
                {matches.map((record) => (
                  <li key={record.id}>
                    <Card className="service-card">
                      <CardHeader>
                        <div className="services-heading">
                          <div className="catalog-person-heading">
                            {!services && (
                              <span className="barber-initials" aria-hidden="true">
                                {record.name
                                  .trim()
                                  .split(/\s+/)
                                  .slice(0, 2)
                                  .map((part) => part[0])
                                  .join('')
                                  .toUpperCase()}
                              </span>
                            )}
                            <h2>{record.name}</h2>
                          </div>
                          <Badge variant="outline">
                            {record.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {services && (
                          <div className="service-facts">
                            <span>
                              <Clock size={16} aria-hidden="true" />
                              {record.duration_minutes} minutes
                            </span>
                            <span className="font-semibold">{record.price}</span>
                          </div>
                        )}
                        {services && record.description && (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                            {record.description}
                          </p>
                        )}
                        {owner && (
                          <div className="service-actions">
                            <Button
                              className={primaryButton}
                              variant="outline"
                              disabled={mutation.isPending}
                              aria-label={`Edit ${record.name}`}
                              onClick={() => openEditor(record)}
                            >
                              <Pencil size={16} aria-hidden="true" />
                              Edit
                            </Button>
                            <Button
                              className={secondaryButton}
                              variant="outline"
                              disabled={mutation.isPending}
                              aria-label={`${record.is_active ? 'Deactivate' : 'Activate'} ${record.name}`}
                              onClick={() => {
                                setNotice('')
                                mutation.mutate({
                                  id: record.id,
                                  body: body({ ...record, is_active: !record.is_active }),
                                })
                              }}
                            >
                              {!services &&
                                (record.is_active ? (
                                  <UserRoundX size={16} aria-hidden="true" />
                                ) : (
                                  <UserRoundCheck size={16} aria-hidden="true" />
                                ))}
                              {record.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              <Card>
                <CardContent className="service-empty">
                  {services ? (
                    <Scissors size={30} aria-hidden="true" />
                  ) : (
                    <UserRound size={30} aria-hidden="true" />
                  )}
                  <h2>
                    {query.data.length === 0 ? `No ${plural} yet.` : `No matching ${plural}.`}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {search
                      ? 'Try another search or clear the filter.'
                      : owner
                        ? `Use the form below to add your first ${singular}.`
                        : `${title} added by the Owner will appear here.`}
                  </p>
                  {search && (
                    <Button
                      className={secondaryButton}
                      variant="outline"
                      onClick={() => setSearch('')}
                    >
                      Clear search
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
        {owner && (
          <Card className="service-editor">
            <CardHeader>
              <h2 ref={editor} tabIndex={-1}>
                {editing ? 'Edit' : 'Create'} {singular}
              </h2>
              <p className="text-sm text-muted-foreground">
                {services
                  ? 'Set the name, appointment duration and price.'
                  : 'Enter the name used for appointment assignments.'}
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={submit}>
                <fieldset disabled={mutation.isPending} className="space-y-5">
                  <Field>
                    <FieldLabel htmlFor="service-name">Name</FieldLabel>
                    <Input
                      id="service-name"
                      required
                      maxLength={200}
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                  </Field>
                  {services && (
                    <>
                      <Field>
                        <FieldLabel htmlFor="service-description">Description</FieldLabel>
                        <Textarea
                          id="service-description"
                          rows={4}
                          value={draft.description}
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        />
                      </Field>
                      <div className="service-form-pair">
                        <Field>
                          <FieldLabel htmlFor="service-duration">Duration (minutes)</FieldLabel>
                          <Input
                            id="service-duration"
                            type="number"
                            min="1"
                            step="1"
                            required
                            value={draft.duration}
                            onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="service-price">Price</FieldLabel>
                          <Input
                            id="service-price"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={draft.price}
                            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                          />
                        </Field>
                      </div>
                    </>
                  )}
                  <label className="service-active">
                    <input
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                    />
                    Active
                  </label>
                  <div className="service-actions">
                    <Button className={primaryButton} type="submit" disabled={mutation.isPending}>
                      {mutation.isPending ? 'Saving…' : 'Save'}
                    </Button>
                    {editing && (
                      <Button
                        className={secondaryButton}
                        type="button"
                        variant="outline"
                        disabled={mutation.isPending}
                        onClick={() => openEditor()}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </fieldset>
              </form>
            </CardContent>
          </Card>
        )}
        {mutation.isError && <p role="alert">{mutation.error.message}</p>}
        {notice && <p role="status">{notice}</p>}
      </section>
    )
  }
}
