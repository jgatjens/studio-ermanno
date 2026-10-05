import { ArrowRight, Phone, Clock, MessageCircle } from 'lucide-react'
import { formatHours } from '@/lib/business-hours'
import { availabilityHelpImage } from './content'
import { contactLinks, type Business } from './data'

const fullWeekdays = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

type BusinessState = { data: Business | undefined; error: boolean; retry: () => void }

export function ContactHelp({ business }: { business: BusinessState }) {
  const contact = business.data
    ? contactLinks(business.data).filter((link) => ['WhatsApp', 'Call'].includes(link.label))
    : []
  const contactActions = ['WhatsApp', 'Call']
    .map(
      (label) =>
        contact.find((link) => link.label === label) ||
        (label === 'WhatsApp' ? { label, href: '/contact' } : null),
    )
    .filter((link): link is { label: string; href: string } => link !== null)
  const hourGroups: { first: number; last: number; periods: string[]; signature: string }[] = []
  for (const hour of business.data?.hours.slice().sort((a, b) => a.day_of_week - b.day_of_week) ||
    []) {
    if (hour.is_closed) continue
    const short = (value: string | null | undefined) => value?.slice(0, 5) || ''
    const periods =
      hour.break_start && hour.break_end
        ? [
            `${short(hour.opening_time)} – ${short(hour.break_start)}`,
            `${short(hour.break_end)} – ${short(hour.closing_time)}`,
          ]
        : [formatHours(hour).replace('–', ' – ')]
    const signature = periods.join('|')
    const previous = hourGroups.at(-1)
    if (previous && previous.last + 1 === hour.day_of_week && previous.signature === signature)
      previous.last = hour.day_of_week
    else hourGroups.push({ first: hour.day_of_week, last: hour.day_of_week, periods, signature })
  }
  return (
    <section className="availability-help" aria-labelledby="contact-help-title" lang="it">
      <img
        src={availabilityHelpImage.src}
        srcSet={availabilityHelpImage.srcSet}
        sizes="(min-width: 768px) 25vw, 100vw"
        alt={availabilityHelpImage.alt}
        width={availabilityHelpImage.width}
        height={availabilityHelpImage.height}
        loading="lazy"
      />
      <div>
        <p className="availability-eyebrow">Hai bisogno di aiuto?</p>
        <h2 id="contact-help-title">
          Preferisci contattarci
          <br />
          direttamente?
        </h2>
        <p>
          Puoi scriverci su WhatsApp, chiamarci o passare in salone. Saremo felici di aiutarti a
          trovare il momento migliore per te.
        </p>
        <div className="availability-contact-actions">
          {contactActions.map((link) => (
            <a
              href={link.href}
              key={link.label}
              title={
                link.href === '/contact'
                  ? 'Consulta le informazioni di contatto per WhatsApp'
                  : undefined
              }
              {...(link.href.startsWith('https:')
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              <span className="availability-contact-label">
                {link.label === 'Call' ? <Phone size={18} /> : <MessageCircle size={18} />}
                {link.label === 'Call' ? 'Chiama' : link.label}
              </span>
              <ArrowRight size={16} />
            </a>
          ))}
        </div>
        {business.error && (
          <p role="alert">
            Contatti non disponibili.{' '}
            <button type="button" onClick={business.retry}>
              Riprova
            </button>
          </p>
        )}
        {!business.data && !business.error && <p role="status">Caricamento contatti…</p>}
        {business.data && !contact.length && (
          <a href="/contact">
            Informazioni di contatto <ArrowRight size={16} />
          </a>
        )}
      </div>
      <div className="availability-help-hours">
        <p className="availability-eyebrow">
          <Clock size={18} /> I nostri orari
        </p>
        {hourGroups.length ? (
          <dl>
            {hourGroups.map((group) => (
              <div key={group.first}>
                <dt>
                  {fullWeekdays[group.first]}
                  {group.first !== group.last && ` — ${fullWeekdays[group.last]}`}
                </dt>
                <dd>
                  {group.periods.map((period) => (
                    <span key={period}>{period}</span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Consulta il salone per gli orari di apertura.</p>
        )}
      </div>
    </section>
  )
}
