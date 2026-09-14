import { apiRequest } from '@/shared/lib/httpClient'
import { HouseModelCatalog, HouseModelDetail } from './types'

const SECTION = 'house-models'

/** GET /api/house-models/catalog — read-only, витрина не меняется отсюда. */
export function getCatalog(): Promise<HouseModelCatalog> {
  return apiRequest<HouseModelCatalog>({ section: SECTION, path: '/catalog' })
}

/** GET /api/house-models/catalog/:key */
export function getHouseModel(key: string): Promise<HouseModelDetail> {
  return apiRequest<HouseModelDetail>({ section: SECTION, path: `/catalog/${key}` })
}
