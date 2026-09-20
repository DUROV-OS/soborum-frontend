import { apiRequest } from '@/shared/lib/httpClient'
import { HouseModelCatalog, HouseModelDetail, HouseModelProduction } from './types'

const SECTION = 'house-models'

/** GET /api/house-models/catalog — read-only, витрина не меняется отсюда. */
export function getCatalog(): Promise<HouseModelCatalog> {
  return apiRequest<HouseModelCatalog>({ section: SECTION, path: '/catalog' })
}

/** GET /api/house-models/catalog/:key */
export function getHouseModel(key: string): Promise<HouseModelDetail> {
  return apiRequest<HouseModelDetail>({ section: SECTION, path: `/catalog/${key}` })
}

/** GET /api/house-models/catalog/:key/productions — реальные дома этой модели
 * в производстве (0073-b), без цены/контактов клиента. */
export function getHouseModelProductions(key: string): Promise<HouseModelProduction[]> {
  return apiRequest<HouseModelProduction[]>({ section: SECTION, path: `/catalog/${key}/productions` })
}
