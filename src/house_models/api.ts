import { FileAsset } from '@/clients/types'
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

/** POST /api/house-models/catalog/typical-ar-file — только администратор. */
export function uploadTypicalArFile(file: File): Promise<FileAsset> {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<FileAsset>({ section: SECTION, path: '/catalog/typical-ar-file', method: 'POST', form })
}

/** POST /api/house-models/catalog/typical-kr-file — только администратор. */
export function uploadTypicalKrFile(file: File): Promise<FileAsset> {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<FileAsset>({ section: SECTION, path: '/catalog/typical-kr-file', method: 'POST', form })
}

/** PATCH /api/house-models/catalog/:key/typical-documents — единственная
 * точка записи в карточку модели, только администратор. */
export function updateTypicalDocuments(
  key: string,
  patch: { typical_ar_file_id?: number | null; typical_kr_file_id?: number | null },
): Promise<HouseModelDetail> {
  return apiRequest<HouseModelDetail>({
    section: SECTION,
    path: `/catalog/${key}/typical-documents`,
    method: 'PATCH',
    body: patch,
  })
}
