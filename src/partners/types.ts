/** База партнёров (0083). Зеркало `app/partners/schemas.py` на бэкенде. */

export type PartnerCategory = 'COMMERCE' | 'REAL_ESTATE_AGENCY' | 'REALTOR' | 'LAND_SPECIALIST'

export const PARTNER_CATEGORIES: { key: PartnerCategory; label: string; plural: string }[] = [
  { key: 'COMMERCE', label: 'Коммерция', plural: 'Коммерция' },
  { key: 'REAL_ESTATE_AGENCY', label: 'Агентство недвижимости', plural: 'Агентства недвижимости' },
  { key: 'REALTOR', label: 'Риэлтор', plural: 'Риэлторы' },
  { key: 'LAND_SPECIALIST', label: 'Специалист по земле', plural: 'Специалисты по земле' },
]

export function categoryLabel(category: PartnerCategory): string {
  return PARTNER_CATEGORIES.find((c) => c.key === category)?.label ?? category
}

export interface PartnerContact {
  messenger: string
  contact: string
}

export interface PartnerNote {
  id: number
  partner_id: number
  author_id: number
  text: string
  created_at: string
}

export interface Partner {
  id: number
  category: PartnerCategory
  name: string
  city: string
  organization: string | null
  phone: string | null
  email: string | null
  contacts: PartnerContact[]
  comment: string | null
  created_by_id: number | null
  created_at: string
  updated_at: string | null
  notes: PartnerNote[]
}

export interface PartnerInput {
  category: PartnerCategory
  name: string
  city: string
  organization: string | null
  phone: string | null
  email: string | null
  contacts: PartnerContact[]
  comment: string | null
}
