import { useEffect, useState } from 'react'
import { apiRequest, ApiError } from '@/lib/api'
type Review = { name: string | null; rating: number; comment: string | null; created_at: string }
type Page = { items: Review[]; total: number }
const field = 'public-feedback-input'
const button = 'public-feedback-button'
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
    setReviews(null)
    setReadError('')
    void apiRequest<Page>(`/public/feedback?limit=25&offset=${offset}`, {
      protected: false,
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setReviews(data)
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setReadError('Le recensioni non sono disponibili al momento.')
      })
    return () => controller.abort()
  }, [offset, refresh])
  async function submit() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await apiRequest('/public/feedback', {
        protected: false,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email.trim() || null,
          rating: Number(rating),
          comment,
        }),
      })
      setNotice(
        'Grazie! Abbiamo ricevuto la tua recensione. Sarà verificata prima della pubblicazione.',
      )
      setName('')
      setEmail('')
      setRating('5')
      setComment('')
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 422
          ? 'Controlla nome, email, valutazione e commento.'
          : 'Non possiamo confermare la ricezione. Il tuo testo è stato conservato; la recensione potrebbe essere già arrivata. Un nuovo invio potrebbe creare un duplicato.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="public-feedback-page">
      <header className="contact-intro">
        <p className="eyebrow">I Minati / Recensioni</p>
        <h1>
          La tua esperienza.
          <br />
          Le tue parole.
        </h1>
        <p>
          Ogni visita racconta qualcosa. Leggi le esperienze di chi ci ha scelto e condividi la tua.
        </p>
      </header>
      <div className="public-feedback-layout">
        <section className="public-feedback-reviews" aria-labelledby="reviews-title">
          <p className="eyebrow">Le vostre parole</p>
          <h2 id="reviews-title">Esperienze in salone.</h2>
          {readError ? (
            <div role="alert">
              <p>{readError}</p>
              <button className={button} onClick={() => setRefresh(refresh + 1)}>
                Riprova
              </button>
            </div>
          ) : !reviews ? (
            <p role="status">Caricamento recensioni…</p>
          ) : (
            <>
              {!reviews.total && (
                <div className="public-feedback-empty">
                  <h3>La prima parola è tua.</h3>
                  <p>
                    Non ci sono ancora recensioni pubblicate. Raccontaci la tua esperienza in
                    salone.
                  </p>
                </div>
              )}
              {reviews.items.map((review, i) => (
                <article className="public-feedback-review" key={`${offset}:${i}`}>
                  <p className="public-feedback-rating">
                    <span aria-hidden="true">
                      {'★'.repeat(review.rating)}
                      {'☆'.repeat(5 - review.rating)}
                    </span>
                    <span>{review.rating} su 5</span>
                  </p>
                  {review.comment && <blockquote>{review.comment}</blockquote>}
                  <div className="public-feedback-review-author">
                    <h3>{review.name || 'Cliente'}</h3>
                    <time dateTime={review.created_at}>
                      {new Date(review.created_at).toLocaleDateString('it-IT')}
                    </time>
                  </div>
                </article>
              ))}
              {reviews.total > 0 && (
                <div className="catalog-pagination">
                  <p>{reviews.total} recensioni</p>
                  <div>
                    <button
                      className={button}
                      disabled={!offset}
                      onClick={() => setOffset(Math.max(0, offset - 25))}
                    >
                      Precedenti
                    </button>
                    <button
                      className={button}
                      disabled={offset + 25 >= reviews.total}
                      onClick={() => setOffset(offset + 25)}
                    >
                      Successive
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
        <form
          className="public-feedback-form"
          aria-labelledby="feedback-form-title"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <p className="eyebrow">Un momento per raccontare</p>
          <h2 id="feedback-form-title">Com’è andata?</h2>
          <p>
            Nome, valutazione e commento potranno essere pubblicati dopo la nostra approvazione.
            L’email è facoltativa e rimane privata.
          </p>
          <fieldset disabled={busy} className="space-y-3">
            <label className="block">
              Nome
              <input
                className={field}
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              Email (facoltativa)
              <input
                className={field}
                type="email"
                maxLength={320}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block">
              Valutazione
              <select className={field} value={rating} onChange={(e) => setRating(e.target.value)}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} su 5
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              La tua esperienza
              <textarea
                className={field}
                required
                maxLength={10000}
                rows={5}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>
            <button className={`${button} public-feedback-submit`}>
              {busy ? 'Invio in corso…' : 'Invia recensione'}
              <span aria-hidden="true"> →</span>
            </button>
          </fieldset>
          {busy && <p role="status">Invio della recensione…</p>}
          {notice && <p role="status">{notice}</p>}
          {error && <p role="alert">{error}</p>}
        </form>
      </div>
    </div>
  )
}
