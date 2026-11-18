import { useState, useEffect } from 'react'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import { useWarehouseStore } from '../store'
import { Material } from '../types'
import { listCategories } from '../api'

export function EditMaterialModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const update = useWarehouseStore(s => s.updateMaterial)
  const [form, setForm] = useState({ title: material.title, code: material.code, category: material.category, unit: material.unit, is_fractional: material.is_fractional, purchase_price: String(material.purchase_price), threshold: String(material.threshold) })
  const [categories, setCategories] = useState<string[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { listCategories().then(setCategories).catch(e => setError(e.message)) }, [])
  const save = async () => {
    if (!form.title.trim() || !form.code.trim() || !form.unit.trim()) { setError('Укажите название, код и единицу измерения.'); return }
    if (!form.threshold.trim() || !Number.isFinite(Number(form.threshold)) || Number(form.threshold) < 0) { setError('Укажите неотрицательный минимальный запас.'); return }
    setBusy(true); setError('')
    const { purchase_price: _price, ...editable } = form
    const result = await update(material.id, { ...editable, title: form.title.trim(), code: form.code.trim(), unit: form.unit.trim(), threshold: Number(form.threshold), edit_token: material.edit_token })
    setBusy(false)
    if (result.ok) onClose(); else setError(result.reason || 'Не удалось сохранить товар')
  }
  return <Modal open title="Изменить товар" onClose={onClose} width="max-w-2xl" footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Отмена</Button><Button onClick={save} disabled={busy}>Сохранить товар</Button></>}>
    <div className="space-y-4">
      <Field label="Название" required><Input aria-label="Название товара" value={form.title} maxLength={255} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Код" required><Input aria-label="Код товара" maxLength={64} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></Field>
        <Field label="Категория"><Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{[...new Set([form.category, ...categories])].map(c => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Единица измерения" required><Input aria-label="Единица товара" value={form.unit} maxLength={32} onChange={e => setForm({ ...form, unit: e.target.value })} /></Field>
        <Field label="Текущая учётная цена, ₽"><Input aria-label="Учётная цена товара" value={form.purchase_price} readOnly /><p className="mt-1 text-xs text-muted">Рассчитывается по складским документам. Цену закупки меняйте в соответствующей приёмке.</p></Field>
        <Field label="Минимальный запас"><Input aria-label="Минимальный запас товара" type="number" min="0" step="any" value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_fractional} onChange={e => setForm({ ...form, is_fractional: e.target.checked })} />Дробное количество</label>
      </div>
      <p className="text-xs text-muted">Остаток меняется документами прихода, выдачи и пересчёта. Смена единицы учёта после движений требует новой карточки.</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  </Modal>
}
