import { t, useAdminLanguage, adminLocale } from '@/admin/i18n'
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
export function FeedbackPage() {
  useAdminLanguage()

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
  return (
    <section className="feedback-workspace space-y-6">
      <div>
        <h1>{t('Feedback moderation')}</h1>
        <p className="text-sm text-muted-foreground">
          {owner
            ? t('Review customer feedback and choose what appears on the website.')
            : t('Browse customer feedback. Staff access is read only.')}
        </p>
      </div>
      <Card>
        <CardContent>
          <div className="feedback-filter-row">
            <Field>
              <FieldLabel htmlFor="feedback-status">{t('Status')}</FieldLabel>
              <NativeSelect
                id="feedback-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setOffset(0)
                }}
              >
                <option value="">{t('All')}</option>
                <option value="PENDING">{t('PENDING')}</option>
                <option value="APPROVED">{t('APPROVED')}</option>
                <option value="REJECTED">{t('REJECTED')}</option>
              </NativeSelect>
            </Field>
            {status !== 'PENDING' && (
              <Button
                variant="outline"
                onClick={() => {
                  setStatus('PENDING')
                  setOffset(0)
                }}
              >
                {t('Show pending')}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            {t('Approval and publication are separate. Open feedback to see its details')}
            {owner ? t(' and review moderation changes') : ''}.
          </p>
        </CardContent>
      </Card>
      {query.isPending ? (
        <div role="status">
          <span className="sr-only">{t('Loading feedback…')}</span>
          <div className="feedback-grid" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-56 rounded-xl" />
            ))}
          </div>
        </div>
      ) : query.isError ? (
        <div role="alert">
          <p>{t(query.error.message)}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("Retry ")}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {query.data.total} {t(' matching feedback entries')}
          </p>
          {query.data.items.length ? (
            <ul className="feedback-grid">
              {query.data.items.map((row) => (
                <li key={row.id}>
                  <Card className="feedback-card">
                    <CardHeader>
                      <div className="feedback-card-heading">
                        <Link to={`/admin/feedback/${row.id}`}>
                          <h2>{row.name || t('Customer')}</h2>
                          <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                        <div className="feedback-badges">
                          <Badge variant="outline">{t(row.status)}</Badge>
                          <Badge variant="outline">
                            {row.is_public ? t('Public') : t('Not public')}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="feedback-rating">
                        <span>
                          <Star size={17} aria-hidden="true" />
                          {row.rating} {t(' out of 5')}
                        </span>
                        <time dateTime={row.created_at}>
                          {new Date(row.created_at).toLocaleDateString(adminLocale(), {
                            timeZone: 'Europe/Rome',
                          })}
                        </time>
                      </div>
                      <p className="feedback-comment">{row.comment || t('No comment provided.')}</p>
                      <Button variant="outline" asChild>
                        <Link to={`/admin/feedback/${row.id}`}>
                          {owner ? t('Review feedback') : t('View feedback')}
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Card>
              <CardContent className="feedback-empty">
                <MessageSquare size={32} aria-hidden="true" />
                <h2>{t('No matching feedback.')}</h2>
                <p className="text-sm text-muted-foreground">
                  {status
                    ? t('There are no entries with this status. Choose All to see other feedback.')
                    : t('New customer feedback will appear here.')}
                </p>
                {status && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStatus('')
                      setOffset(0)
                    }}
                  >
                    {t('Show all feedback')}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          <div className="feedback-pagination">
            <p className="text-sm text-muted-foreground">
              {t('Showing ')}
              {query.data.items.length ? offset + 1 : 0}–
              {query.data.items.length ? offset + query.data.items.length : 0} {t(' of ')}
              {query.data.total}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 25))}
              >
                {t('Previous feedback')}
              </Button>
              <Button
                variant="outline"
                disabled={offset + 25 >= query.data.total}
                onClick={() => setOffset(offset + 25)}
              >
                {t('Next feedback')}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export function FeedbackDetailPage() {
  useAdminLanguage()

  const { feedbackId } = useParams()
  const owner = useAuth().actor?.role === 'OWNER'
  const key = useAdminKey('feedback')
  const query = useQuery({
    queryKey: [...key, 'detail', feedbackId],
    queryFn: ({ signal }) => apiRequest<Feedback>(`/feedback/${feedbackId}`, { signal }),
  })
  if (query.isPending)
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">{t('Loading feedback…')}</span>
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  if (query.isError)
    return (
      <div role="alert">
        <p>{t(query.error.message)}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("Retry ")}
        </Button>
      </div>
    )
  const row = query.data
  return (
    <section className="feedback-detail space-y-6">
      <Button variant="outline" asChild>
        <Link to="/admin/feedback">{t('All feedback')}</Link>
      </Button>
      <div>
        <p className="text-sm text-muted-foreground mb-2">{t('Customer feedback')}</p>
        <h1>{row.name || t('Customer')}</h1>
        <time className="text-sm text-muted-foreground" dateTime={row.created_at}>
          {new Date(row.created_at).toLocaleString(adminLocale(), { timeZone: 'Europe/Rome' })}
        </time>
      </div>
      <div className="feedback-detail-grid">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="feedback-detail-rating">
                <span className="feedback-rating-score">
                  {row.rating}
                  <small>/5</small>
                </span>
                <div>
                  <div className="feedback-stars" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={20} fill={n <= row.rating ? 'currentColor' : 'none'} />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.rating} {t(' out of 5')}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <h2 className="mb-3">{t('Review')}</h2>
              <p className="feedback-full-comment">{row.comment || t('No comment provided.')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2>{t('Submission details')}</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="feedback-badges">
                <Badge variant="outline">{t(row.status)}</Badge>
                <Badge variant="outline">{row.is_public ? t('Public') : t('Not public')}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {row.is_public
                  ? t('This feedback is visible on the public website.')
                  : t('This feedback is not displayed on the public website.')}
              </p>
              {owner && row.email && (
                <p className="break-words">
                  {t('Email: ')}
                  {row.email}
                </p>
              )}
              <div className="feedback-related">
                {row.client_id && (
                  <Button variant="outline" asChild>
                    <Link to={`/admin/clients/${row.client_id}`}>
                      {t('Related client')}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </Button>
                )}
                {row.appointment_id && (
                  <Button variant="outline" asChild>
                    <Link to={`/admin/appointments/${row.appointment_id}`}>
                      {t('Related appointment')}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        {owner ? (
          <Card>
            <CardContent>
              <ModerationForm key={row.id} feedback={row} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <p>{t('Staff access is read only.')}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {t('The Owner manages approval and public visibility.')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}

function ModerationForm({ feedback }: { feedback: Feedback }) {
  useAdminLanguage()

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
      className="feedback-moderation space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        setReview(true)
      }}
    >
      <h2>{t('Moderate feedback')}</h2>
      <p>
        {t('Approval and publication are separate. Pending or rejected feedback cannot be public.')}
      </p>
      <fieldset disabled={mutation.isPending} className="space-y-3">
        <Field>
          <FieldLabel htmlFor="moderation-status">{t('Moderation status')}</FieldLabel>
          <NativeSelect
            id="moderation-status"
            value={status}
            onChange={(e) => {
              edited()
              const next = e.target.value as Feedback['status']
              setStatus(next)
              if (next !== 'APPROVED') setIsPublic(false)
            }}
          >
            <option value="PENDING">{t('PENDING')}</option>
            <option value="APPROVED">{t('APPROVED')}</option>
            <option value="REJECTED">{t('REJECTED')}</option>
          </NativeSelect>
        </Field>
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
          {t('Public visibility')}
        </label>
        <Button type="submit" disabled={mutation.isPending}>
          {t('Review moderation')}
        </Button>
        {review && (
          <div
            role="group"
            aria-label={t('Confirm moderation')}
            className="moderation-confirmation"
          >
            <p>
              {t("Save ")}
              {t(status)} {t(' and')}{' '}
              {isPublic
                ? t('publish this feedback')
                : t('keep this feedback off the public website')}
              ?
            </p>
            <Button
              type="button"
              disabled={mutation.isPending}
              onClick={() => {
                if (mutation.isPending) return
                const body = JSON.stringify({ status, is_public: isPublic })
                setAttempt(body)
                mutation.mutate(body)
              }}
            >
              {t('Confirm moderation')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setReview(false)}
            >
              {t('Cancel review')}
            </Button>
          </div>
        )}
      </fieldset>
      {mutation.isPending && <p role="status">{t('Saving moderation…')}</p>}
      {mutation.isSuccess && <p role="status">{t('Moderation saved.')}</p>}
      {mutation.isError && (
        <div role="alert">
          <p>{t(mutation.error.message)}</p>
          <p>{t('Your moderation draft is retained.')}</p>
          {attempt && (
            <Button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(attempt)}
            >
              {t('Retry same moderation')}
            </Button>
          )}
        </div>
      )}
    </form>
  )
}
