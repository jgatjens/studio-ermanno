export const publicBrand = {
  name: 'I Minati',
  descriptor: 'Parrucchieri',
  title: 'I Minati Parrucchieri',
}
export const publicSocialLinks = [
  { label: 'Instagram', href: 'https://www.instagram.com/iminatiparrucchieri/' },
  { label: 'WhatsApp', href: 'https://wa.me/393484830998' },
]
export type GalleryImage = {
  src: string
  alt: string
  caption: string
  width: number
  height: number
  source: string
  srcSet?: string
}
// Add only approved photographs of this business, with usage permission recorded.
export const gallery: GalleryImage[] = [
  {
    src: '/images/village-street-960.webp',
    srcSet: '/images/village-street-480.webp 480w, /images/village-street-960.webp 960w',
    alt: 'A cobbled street between village buildings beneath a rocky mountainside',
    caption: 'A view along the street',
    width: 960,
    height: 1280,
    source: 'User-supplied mobile photograph 1, authorized for this website in chat',
  },
  {
    src: '/images/studio-exterior-960.webp',
    srcSet: '/images/studio-exterior-480.webp 480w, /images/studio-exterior-960.webp 960w',
    alt: 'Hair-studio storefront beneath a striped awning, with a mountainside behind the buildings',
    caption: 'The studio exterior',
    width: 960,
    height: 1280,
    source: 'User-supplied mobile photograph 2, authorized for this website in chat',
  },
  {
    src: '/images/street-detail-960.webp',
    srcSet: '/images/street-detail-480.webp 480w, /images/street-detail-960.webp 960w',
    alt: 'A scooter beside planters and a bench on a village street',
    caption: 'A street detail',
    width: 960,
    height: 1280,
    source: 'User-supplied mobile photograph 3, authorized for this website in chat',
  },
]
export const hero = gallery[1]
// Independent availability assets; replace these approved photos when dedicated salon images are supplied.
export const availabilityHero: GalleryImage = {
  src: '/images/salon-chair-1200.jpg',
  srcSet: '/images/salon-chair-600.jpg 600w, /images/salon-chair-1200.jpg 1200w',
  alt: 'Interno di un salone con poltrone nere, lavatesta e specchi illuminati da luci calde',
  caption: '',
  width: 1200,
  height: 900,
  source:
    'User-supplied salon interior image, authorized as replacement in chat on 6 October 2026',
}
export const availabilityHelpImage: GalleryImage = {
  src: '/images/salon-tools-960.jpg',
  alt: 'Forbici e pettini su un asciugamano scuro, con luci calde sullo sfondo',
  caption: '',
  width: 960,
  height: 662,
  source:
    'AI-generated decorative salon-tools photograph based on the user-supplied contact-section reference, 5 October 2026; not a photograph of the business',
}
export const faq = [
  {
    question: 'Come posso organizzare una visita?',
    answer:
      'Consulta le disponibilità indicative, poi contattaci per concordare la tua visita. Il sito non consente di prenotare appuntamenti.',
  },
  {
    question: 'Dove trovo prezzi e durata dei servizi?',
    answer:
      'Nella pagina Servizi trovi prezzi e durate pubblicati. Contattaci per un consiglio sul servizio più adatto a te.',
  },
  {
    question: 'Come vengono pubblicate le recensioni?',
    answer:
      'Le recensioni vengono controllate prima della pubblicazione. Sono visibili solo quelle approvate e pubbliche. La tua email facoltativa non viene mostrata.',
  },
]

export const homeHeroPlaceholder: GalleryImage = {
  src: '/images/home-haircut-1600.jpg',
  srcSet: '/images/home-haircut-800.jpg 800w, /images/home-haircut-1600.jpg 1600w',
  alt: 'Un parrucchiere cura i capelli ricci di un cliente in un salone dalle luci calde',
  width: 1600,
  height: 667,
  caption: '',
  source:
    'AI-generated decorative haircut photograph inspired by the user-provided homepage reference',
}

// Prepared alternative; keep homeHero active until the new image is selected.
export const homeHero: GalleryImage = {
  src: '/images/home-styling-1600.jpg',
  srcSet: '/images/home-styling-800.jpg 800w, /images/home-styling-1600.jpg 1600w',
  alt: 'Un parrucchiere cura capelli lunghi e mossi in un salone dalle luci calde',
  width: 1600,
  height: 629,
  caption: '',
  source: 'User-supplied homepage hero alternative, authorized in chat on 6 October 2026',
}
