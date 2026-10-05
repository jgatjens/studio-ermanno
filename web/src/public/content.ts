export type GalleryImage = { src: string; alt: string; caption: string; width: number; height: number; source: string; srcSet?: string }
// Add only approved photographs of this business, with usage permission recorded.
export const gallery: GalleryImage[] = [
  { src: '/images/village-street-960.webp', srcSet: '/images/village-street-480.webp 480w, /images/village-street-960.webp 960w', alt: 'A cobbled street between village buildings beneath a rocky mountainside', caption: 'A view along the street', width: 960, height: 1280, source: 'User-supplied mobile photograph 1, authorized for this website in chat' },
  { src: '/images/studio-exterior-960.webp', srcSet: '/images/studio-exterior-480.webp 480w, /images/studio-exterior-960.webp 960w', alt: 'Hair-studio storefront beneath a striped awning, with a mountainside behind the buildings', caption: 'The studio exterior', width: 960, height: 1280, source: 'User-supplied mobile photograph 2, authorized for this website in chat' },
  { src: '/images/street-detail-960.webp', srcSet: '/images/street-detail-480.webp 480w, /images/street-detail-960.webp 960w', alt: 'A scooter beside planters and a bench on a village street', caption: 'A street detail', width: 960, height: 1280, source: 'User-supplied mobile photograph 3, authorized for this website in chat' },
]
export const hero = gallery[1]
// Independent availability assets; replace these approved photos when dedicated salon images are supplied.
export const availabilityHero = gallery[1]
export const availabilityHelpImage = gallery[2]
export const faq = [
  { question: 'How do I arrange a visit?', answer: 'Check the informational availability view, then contact the business to arrange your visit. The website does not book appointments.' },
  { question: 'Where can I find prices and durations?', answer: 'The Services page lists published prices and durations. Contact the business for guidance on choosing a service.' },
  { question: 'How are reviews published?', answer: 'Feedback is reviewed before publication. Only approved, public reviews appear. Your optional email is not displayed publicly.' },
]
