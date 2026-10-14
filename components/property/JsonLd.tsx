import type { Listing, Photo } from '@/lib/listing'

// Structured data built ONLY from stored facts. No ratings, no prices,
// no address parts we do not have.

export function JsonLd({ data }: { data: unknown }) {
  // `<` escaped so guest-editable text can never close the script tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}

const AMENITIES: Record<string, string[]> = {
  velence: ['Jakuzzi (6 fős)', 'Szauna (2 fős)', 'Fedett terasz', 'Erkély', 'Kert', 'Grillezési lehetőség', 'Bogrács', 'Ingyenes parkolás'],
  napsugar: ['Kültéri medence (szezonális)', 'Kültéri jakuzzi (egész évben)', 'Klíma', 'Padlófűtés', 'Wi-Fi', 'Smart TV', 'Mosógép', 'Mosogatógép', 'Grillezési lehetőség', 'Bogrács', 'Szalonnasütés', 'Zárt parkoló', 'Kiságy', 'Etetőszék'],
}

export function lodgingJsonLd(listing: Listing, origin: string, photos: Photo[]) {
  const address: Record<string, string> = { '@type': 'PostalAddress', addressLocality: 'Velence', addressCountry: 'HU' }
  if (listing.address) {
    const m = listing.address.match(/^(\d{4})\s+([^,]+),\s*(.+)$/)
    if (m) Object.assign(address, { postalCode: m[1], addressLocality: m[2].trim(), streetAddress: m[3].trim() })
  }
  const bedrooms = listing.slug === 'velence' ? 4 : 2
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    '@id': `${origin}/#lodging`,
    name: listing.name,
    url: `${origin}/`,
    description: listing.tagline ?? undefined,
    telephone: listing.contactPhone ?? undefined,
    email: listing.contactEmail ?? undefined,
    image: photos.slice(0, 8).map((p) => p.url),
    identifier: listing.ntakId ? { '@type': 'PropertyValue', propertyID: 'NTAK', value: listing.ntakId } : undefined,
    address,
    geo: listing.geo ? { '@type': 'GeoCoordinates', latitude: listing.geo.lat, longitude: listing.geo.lng } : undefined,
    petsAllowed: true,
    checkinTime: listing.checkinWindow ? listing.checkinWindow.slice(0, 5) : undefined,
    checkoutTime: listing.checkoutTime ?? undefined,
    amenityFeature: (AMENITIES[listing.slug] ?? []).map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
    availableLanguage: ['hu'],
    containsPlace: {
      '@type': 'House',
      name: listing.name,
      numberOfBedrooms: bedrooms,
      occupancy: { '@type': 'QuantitativeValue', minValue: 1, maxValue: listing.capacityMax + listing.capacityExtra },
    },
  }
}

export function websiteJsonLd(name: string, origin: string) {
  return { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${origin}/#website`, name, url: `${origin}/`, inLanguage: 'hu-HU' }
}

export function breadcrumbJsonLd(origin: string, trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: `${origin}${t.path}` })),
  }
}

export function faqJsonLd(faq: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
}
