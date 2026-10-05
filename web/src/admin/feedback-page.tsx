import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { apiRequest } from '@/lib/api'
import { useAdminKey } from './query-provider'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Star, ArrowRight, MessageSquare } from 'lucide-react'
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
  const owner = useAuth().actor?.role === 'OWNER'
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
  return <section className="feedback-workspace space-y-6">
    <div><h1>Feedback moderation</h1><p className="text-sm text-muted-foreground">{owner?'Review customer feedback and choose what appears on the website.':'Browse customer feedback. Staff access is read only.'}</p></div>
    <Card><CardContent><div className="feedback-filter-row"><Field><FieldLabel htmlFor="feedback-status">Status</FieldLabel><NativeSelect id="feedback-status" value={status} onChange={e=>{setStatus(e.target.value);setOffset(0)}}><option value="">All</option><option>PENDING</option><option>APPROVED</option><option>REJECTED</option></NativeSelect></Field>{status!=='PENDING'&&<Button variant="outline" onClick={()=>{setStatus('PENDING');setOffset(0)}}>Show pending</Button>}</div><p className="text-sm text-muted-foreground mt-4">Approval and publication are separate. Open feedback to see its details{owner?' and review moderation changes':''}.</p></CardContent></Card>
    {query.isPending?<div role="status"><span className="sr-only">Loading feedback…</span><div className="feedback-grid" aria-hidden="true">{[1,2,3].map(n=><Skeleton key={n} className="h-56 rounded-xl"/>)}</div></div>:query.isError?<div role="alert"><p>{query.error.message}</p><Button variant="outline" onClick={()=>void query.refetch()}>Retry</Button></div>:<>
      <p className="text-sm text-muted-foreground">{query.data.total} matching feedback entries</p>
      {query.data.items.length?<ul className="feedback-grid">{query.data.items.map(row=><li key={row.id}><Card className="feedback-card"><CardHeader><div className="feedback-card-heading"><Link to={`/admin/feedback/${row.id}`}><h2>{row.name||'Customer'}</h2><ArrowRight size={17} aria-hidden="true"/></Link><div className="feedback-badges"><Badge variant="outline">{row.status}</Badge><Badge variant="outline">{row.is_public?'Public':'Not public'}</Badge></div></div></CardHeader><CardContent className="space-y-4"><div className="feedback-rating"><span><Star size={17} aria-hidden="true"/>{row.rating} out of 5</span><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleDateString()}</time></div><p className="feedback-comment">{row.comment||'No comment provided.'}</p><Button variant="outline" asChild><Link to={`/admin/feedback/${row.id}`}>{owner?'Review feedback':'View feedback'}<ArrowRight size={16} aria-hidden="true"/></Link></Button></CardContent></Card></li>)}</ul>:<Card><CardContent className="feedback-empty"><MessageSquare size={32} aria-hidden="true"/><h2>No matching feedback.</h2><p className="text-sm text-muted-foreground">{status?'There are no entries with this status. Choose All to see other feedback.':'New customer feedback will appear here.'}</p>{status&&<Button variant="outline" onClick={()=>{setStatus('');setOffset(0)}}>Show all feedback</Button>}</CardContent></Card>}
      <div className="feedback-pagination"><p className="text-sm text-muted-foreground">Showing {query.data.items.length?offset+1:0}–{query.data.items.length?offset+query.data.items.length:0} of {query.data.total}</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous feedback</Button><Button variant="outline" disabled={offset+25>=query.data.total} onClick={()=>setOffset(offset+25)}>Next feedback</Button></div></div>
    </>}
  </section>
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
