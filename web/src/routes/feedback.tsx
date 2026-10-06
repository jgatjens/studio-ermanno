import { useEffect, useState } from 'react'
import { apiRequest, ApiError } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
type Review = { name: string | null; rating: number; comment: string | null; created_at: string }
type Page = { items: Review[]; total: number }
const field =
  'mt-2 block h-12 w-full min-w-0 rounded-none border-[#c8c4bb] bg-[#faf8f3] p-3 text-[#242620] shadow-none focus-visible:border-[#242620] focus-visible:ring-[#242620]/20'
const button =
  'min-h-11 rounded-none! border! border-[#c8c4bb]! bg-transparent! px-[18px]! py-3! text-[#242620]! focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#242620] disabled:cursor-not-allowed disabled:opacity-50'
const label = 'block text-[0.85rem] font-medium'
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
    <div className="pb-12">
      <header className="max-w-[800px] pb-10">
        <p className="m-0! mb-6! text-xs! tracking-[0.16em] uppercase">I Minati / Recensioni</p>
        <h1 className="m-0! mb-6! font-[Georgia,serif]! text-[clamp(3.2rem,6vw,5.5rem)]! leading-[1.02]! font-normal! tracking-[-0.045em]!">
          La tua esperienza.
          <br />
          Le tue parole.
        </h1>
        <p className="max-w-[480px] text-[#6d6c65] leading-[1.7]">
          Ogni visita racconta qualcosa. Leggi le esperienze di chi ci ha scelto e condividi la tua.
        </p>
      </header>
      <div className="grid grid-cols-1 items-start gap-10 border-t border-[#dedbd4] pt-8 min-[801px]:pt-12">
        {(!reviews || reviews.total > 0) && (
          <section aria-label="Recensioni dei clienti">
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
                {reviews.items.map((review, i) => (
                  <article
                    className="border-b border-[#dedbd4] py-7 wrap-anywhere"
                    key={`${offset}:${i}`}
                  >
                    <p className="flex items-center gap-4 text-[0.8rem]! text-[#77756d]">
                      <span
                        className="text-[1.15rem] tracking-[0.12em] text-[#746644]"
                        aria-hidden="true"
                      >
                        {'★'.repeat(review.rating)}
                        {'☆'.repeat(5 - review.rating)}
                      </span>
                      <span>{review.rating} su 5</span>
                    </p>
                    {review.comment && (
                      <blockquote className="mt-5 mb-6 font-[Georgia,serif] text-[clamp(1.35rem,2vw,1.8rem)] leading-normal font-normal whitespace-pre-wrap">
                        {review.comment}
                      </blockquote>
                    )}
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h3 className="m-0! text-[0.9rem]! font-medium!">
                        {review.name || 'Cliente'}
                      </h3>
                      <time className="text-[0.8rem] text-[#77756d]" dateTime={review.created_at}>
                        {new Date(review.created_at).toLocaleDateString('it-IT')}
                      </time>
                    </div>
                  </article>
                ))}
                {reviews.total > 0 && (
                  <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
                    <p>{reviews.total} recensioni</p>
                    <div className="flex flex-wrap gap-3">
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
        )}
        <form
          className="bg-[#ede9e1] p-[clamp(24px,4vw,40px)]"
          aria-labelledby="feedback-form-title"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <p className="m-0! mb-[18px]! text-[0.7rem]! tracking-[0.15em] text-[#77756d] uppercase">
            Un momento per raccontare
          </p>
          <h2
            className="m-0! mb-6! font-[Georgia,serif]! text-[clamp(2rem,3vw,2.8rem)]! leading-[1.15]! font-normal! tracking-[-0.035em]"
            id="feedback-form-title"
          >
            Com’è andata?
          </h2>
          <p className="text-[#6d6c65] leading-[1.7]">
            Nome, valutazione e commento potranno essere pubblicati dopo la nostra approvazione.
            L’email è facoltativa e rimane privata.
          </p>
          <fieldset
            disabled={busy}
            className="mt-7 grid min-w-0 grid-cols-1 gap-y-3 border-0 p-0 min-[801px]:grid-cols-2 min-[801px]:gap-x-7 min-[801px]:gap-y-5"
          >
            <label className={label}>
              Nome
              <Input
                className={field}
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className={label}>
              Email (facoltativa)
              <Input
                className={field}
                type="email"
                maxLength={320}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label
              className={`${label} min-[801px]:col-span-full min-[801px]:max-w-[280px] [&>div]:mt-2 [&>div]:w-full`}
            >
              Valutazione
              <NativeSelect
                className={`${field} mt-0 pr-10`}
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <NativeSelectOption key={n} value={n}>
                    {n} su 5
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label className={`${label} min-[801px]:col-span-full`}>
              La tua esperienza
              <Textarea
                className={`${field} h-auto min-h-40 resize-y`}
                required
                maxLength={10000}
                rows={5}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>
            <button
              className={`${button} mt-3 flex w-full items-center justify-between border-[#242620]! bg-[#242620]! text-[#faf8f3]! min-[801px]:col-span-full min-[801px]:mt-0 min-[801px]:w-auto min-[801px]:justify-self-start min-[801px]:gap-10`}
            >
              {busy ? 'Invio in corso…' : 'Invia recensione'}
              <span aria-hidden="true"> →</span>
            </button>
          </fieldset>
          {busy && (
            <p className="mt-5!" role="status">
              Invio della recensione…
            </p>
          )}
          {notice && (
            <p className="mt-5!" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="mt-5!" role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
