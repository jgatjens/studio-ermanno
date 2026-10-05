import { useEffect, useState } from 'react'
import { apiRequest, ApiError } from '@/lib/api'
type Review = { name: string | null; rating: number; comment: string | null; created_at: string }
type Page = { items: Review[]; total: number }
const field = 'block w-full min-w-0 rounded border p-3'
const button = 'rounded border px-3 py-3'
export function PublicFeedbackPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [rating, setRating] = useState('5')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [reviews, setReviews] = useState<Page | null>(null)
  const [readError, setReadError] = useState('')
  const [offset, setOffset] = useState(0)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setReviews(null); setReadError('')
    void apiRequest<Page>(`/public/feedback?limit=25&offset=${offset}`, { protected: false, signal: controller.signal }).then(data => { if (!controller.signal.aborted) setReviews(data) }).catch(err => { if (!controller.signal.aborted) setReadError(err instanceof Error ? err.message : 'Reviews unavailable.') })
    return () => controller.abort()
  }, [offset, refresh])
  async function submit() {
    setBusy(true); setError(''); setNotice('')
    try {
      await apiRequest('/public/feedback', { protected: false, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email: email.trim() || null, rating: Number(rating), comment }) })
      setNotice('Thank you. Your feedback was received and will be reviewed before any publication.')
      setName(''); setEmail(''); setRating('5'); setComment('')
    } catch (err) {
      setError(err instanceof ApiError && err.status === 422 ? 'Check your name, email, rating and comment.' : 'We could not confirm receipt. Your draft is retained; your feedback may already have been received. Another submission could create a duplicate.')
    } finally { setBusy(false) }
  }
  return <section className="space-y-6 break-words"><h1>Feedback</h1><form className="space-y-4" onSubmit={e => { e.preventDefault(); void submit() }}><h2>Share your experience</h2><p>Your name, rating and comment may be published after Owner approval. Email is optional and stays private.</p><fieldset disabled={busy} className="space-y-3">
    <label className="block">Name<input className={field} required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
    <label className="block">Email (optional)<input className={field} type="email" maxLength={320} value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label className="block">Rating<select className={field} value={rating} onChange={e => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} out of 5</option>)}</select></label>
    <label className="block">Comment<textarea className={field} required maxLength={10000} value={comment} onChange={e => setComment(e.target.value)} /></label><button className={button}>Submit feedback</button>
    </fieldset>{busy && <p role="status">Sending feedback…</p>}{notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
  </form><h2>Customer reviews</h2>{readError ? <div role="alert"><p>{readError}</p><button className={button} onClick={() => setRefresh(refresh + 1)}>Retry reviews</button></div> : !reviews ? <p role="status">Loading reviews…</p> : <>
    {!reviews.total && <p>No published reviews yet.</p>}{reviews.items.map((review, i) => <article className="space-y-2 rounded border p-4" key={`${offset}:${i}`}><h3>{review.name || 'Customer'}</h3><p>{review.rating} out of 5 · {new Date(review.created_at).toLocaleDateString()}</p><p className="whitespace-pre-wrap">{review.comment}</p></article>)}
    <div className="flex flex-wrap gap-3"><button className={button} disabled={!offset} onClick={() => setOffset(offset - 25)}>Previous reviews</button><button className={button} disabled={offset + 25 >= reviews.total} onClick={() => setOffset(offset + 25)}>Next reviews</button></div>
  </>}</section>
}
