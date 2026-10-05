import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { apiRequest } from '@/lib/api'
import { useAdminKey } from './query-provider'
type Feedback = {
  id: string
  name: string | null
  email?: string | null
  rating: number
  comment: string | null
  created_at: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  is_public: boolean
  client_id: string | null
  appointment_id: string | null
}
type Page = { items: Feedback[]; total: number }
const button = 'rounded border px-3 py-3'
const field = 'block w-full min-w-0 rounded border p-3'
export function FeedbackPage() {
  const [status, setStatus] = useState('PENDING')
  const [offset, setOffset] = useState(0)
  const key = useAdminKey('feedback')
  const query = useQuery({
    queryKey: [...key, status, offset],
    queryFn: ({ signal }) =>
      apiRequest<Page>(`/feedback?limit=25&offset=${offset}${status ? `&status=${status}` : ''}`, {
        signal,
      }),
  })
  return (
    <section className="space-y-4 break-words">
      <h1>Feedback moderation</h1>
      <label>
        Status
        <select
          className={field}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setOffset(0)
          }}
        >
          <option value="">All</option>
          <option>PENDING</option>
          <option>APPROVED</option>
          <option>REJECTED</option>
        </select>
      </label>
      {query.isPending ? (
        <p role="status">Loading feedback…</p>
      ) : query.isError ? (
        <div role="alert">
          <p>{query.error.message}</p>
          <button className={button} onClick={() => void query.refetch()}>
            Retry
          </button>
        </div>
      ) : (
        <>
          {!query.data.total && <p>No matching feedback.</p>}
          {query.data.items.map((row) => (
            <article className="space-y-2 rounded border p-4" key={row.id}>
              <h2>
                <Link to={`/admin/feedback/${row.id}`}>{row.name || 'Customer'}</Link>
              </h2>
              <p>
                {row.rating} out of 5 · {new Date(row.created_at).toLocaleDateString()}
              </p>
              <p>
                {row.status} · {row.is_public ? 'Public' : 'Not public'}
              </p>
              <p className="whitespace-pre-wrap">{row.comment}</p>
            </article>
          ))}
          <div className="flex flex-wrap gap-3">
            <button className={button} disabled={!offset} onClick={() => setOffset(offset - 25)}>
              Previous feedback
            </button>
            <button
              className={button}
              disabled={offset + 25 >= query.data.total}
              onClick={() => setOffset(offset + 25)}
            >
              Next feedback
            </button>
          </div>
        </>
      )}
    </section>
  )
}
export function FeedbackDetailPage() {
  const { feedbackId } = useParams()
  const owner = useAuth().actor?.role === 'OWNER'
  const key = useAdminKey('feedback')
  const query = useQuery({
    queryKey: [...key, 'detail', feedbackId],
    queryFn: ({ signal }) => apiRequest<Feedback>(`/feedback/${feedbackId}`, { signal }),
  })
  if (query.isPending) return <p role="status">Loading feedback…</p>
  if (query.isError)
    return (
      <div role="alert">
        <p>{query.error.message}</p>
        <button className={button} onClick={() => void query.refetch()}>
          Retry
        </button>
      </div>
    )
  const row = query.data
  return (
    <section className="space-y-4 break-words">
      <Link to="/admin/feedback">All feedback</Link>
      <h1>{row.name || 'Customer'}</h1>
      <p>
        {row.rating} out of 5 · {new Date(row.created_at).toLocaleString()}
      </p>
      <p className="whitespace-pre-wrap">{row.comment}</p>
      {owner && row.email && <p>Email: {row.email}</p>}
      <p>
        {row.status} · {row.is_public ? 'Public' : 'Not public'}
      </p>
      {row.client_id && (
        <Link className="block" to={`/admin/clients/${row.client_id}`}>
          Related client
        </Link>
      )}
      {row.appointment_id && (
        <Link className="block" to={`/admin/appointments/${row.appointment_id}`}>
          Related appointment
        </Link>
      )}
      {owner ? <ModerationForm key={row.id} feedback={row} /> : <p>Staff access is read only.</p>}
    </section>
  )
}
function ModerationForm({ feedback }: { feedback: Feedback }) {
  const [status, setStatus] = useState(feedback.status)
  const [isPublic, setIsPublic] = useState(feedback.is_public)
  const [review, setReview] = useState(false)
  const [attempt, setAttempt] = useState<string | null>(null)
  const key = useAdminKey('feedback')
  const cache = useQueryClient()
  const mutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest<Feedback>(`/feedback/${feedback.id}/moderation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: key })
      setReview(false)
      setAttempt(null)
    },
  })
  function edited() {
    setReview(false)
    setAttempt(null)
    mutation.reset()
  }
  return (
    <form
      className="space-y-3 rounded border p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setReview(true)
      }}
    >
      <h2>Moderate feedback</h2>
      <p>Approval and publication are separate. Pending or rejected feedback cannot be public.</p>
      <fieldset disabled={mutation.isPending} className="space-y-3">
        <label>
          Moderation status
          <select
            className={field}
            value={status}
            onChange={(e) => {
              edited()
              const next = e.target.value as Feedback['status']
              setStatus(next)
              if (next !== 'APPROVED') setIsPublic(false)
            }}
          >
            <option>PENDING</option>
            <option>APPROVED</option>
            <option>REJECTED</option>
          </select>
        </label>
        <label className="block py-3">
          <input
            type="checkbox"
            disabled={status !== 'APPROVED'}
            checked={isPublic}
            onChange={(e) => {
              edited()
              setIsPublic(e.target.checked)
            }}
          />{' '}
          Public visibility
        </label>
        <button className={button}>Review moderation</button>
        {review && (
          <div role="group" aria-label="Confirm moderation">
            <p>
              Save {status} and{' '}
              {isPublic ? 'publish this feedback' : 'keep this feedback off the public website'}?
            </p>
            <button
              type="button"
              className={button}
              onClick={() => {
                const body = JSON.stringify({ status, is_public: isPublic })
                setAttempt(body)
                mutation.mutate(body)
              }}
            >
              Confirm moderation
            </button>
          </div>
        )}
      </fieldset>
      {mutation.isPending && <p role="status">Saving moderation…</p>}
      {mutation.isSuccess && <p role="status">Moderation saved.</p>}
      {mutation.isError && (
        <div role="alert">
          <p>{mutation.error.message}</p>
          <p>Your moderation draft is retained.</p>
          {attempt && (
            <button
              type="button"
              className={button}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(attempt)}
            >
              Retry same moderation
            </button>
          )}
        </div>
      )}
    </form>
  )
}
