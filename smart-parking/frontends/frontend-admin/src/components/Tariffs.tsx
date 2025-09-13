import { useEffect, useState } from 'react'
import { api } from '../api'
import { fmtMDL } from '../utils'

type Tariff = {
  id: number
  name: string
  applies_on: 'always' | 'weekday' | 'weekend' | 'custom'
  free_minutes: number
  rate_cents_per_hour: number
  max_daily_cents: number | null
  active: boolean
}

const badgeColor = (a: Tariff['applies_on']) => a === 'weekday' ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200' : a === 'weekend' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200' : a === 'always' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'

export default function Tariffs() {
  const [items, setItems] = useState<Tariff[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Partial<Tariff>>({ applies_on: 'custom', free_minutes: 0, rate_cents_per_hour: 0, max_daily_cents: null })

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get('/ai/tariffs')
      setItems(r.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const add = async () => {
    if (!form.name) return
    await api.post('/ai/tariffs', form)
    setForm({ applies_on: 'custom', free_minutes: 0, rate_cents_per_hour: 0, max_daily_cents: null })
    load()
  }

  const update = async (id: number, patch: Partial<Tariff>) => {
    await api.put(`/ai/tariffs/${id}`, patch)
    load()
  }

  const del = async (id: number) => {
    if (!confirm('Удалить тариф?')) return
    await api.delete(`/ai/tariffs/${id}`)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Тарифы (AI)</h3>
        <button className="px-3 py-2 rounded-md bg-blue-600 text-white" onClick={load} disabled={loading}>{loading ? 'Загрузка…' : 'Обновить'}</button>
      </div>

      <div className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Название</label>
            <input className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2" placeholder="Напр. 'Будни / Дневной'" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Применение</label>
            <select className={`w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 ${badgeColor(form.applies_on as any)}`} value={form.applies_on || 'custom'} onChange={e => setForm({ ...form, applies_on: e.target.value as any })}>
              <option value="always">Всегда</option>
              <option value="weekday">Будни</option>
              <option value="weekend">Выходные</option>
              <option value="custom">Другое</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Free, мин</label>
            <input className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2" type="number" placeholder="напр. 15" value={form.free_minutes ?? 0} onChange={e => setForm({ ...form, free_minutes: Number(e.target.value) })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ставка, коп/час</label>
            <input className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2" type="number" placeholder="напр. 500 (5 MDL)" value={form.rate_cents_per_hour ?? 0} onChange={e => setForm({ ...form, rate_cents_per_hour: Number(e.target.value) })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Кэп/день, коп</label>
            <input className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2" type="number" placeholder="напр. 6000 (60 MDL)" value={form.max_daily_cents ?? 0} onChange={e => setForm({ ...form, max_daily_cents: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div className="sm:col-span-2 md:col-span-5 flex justify-end">
            <button className="px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50" onClick={add} disabled={!form.name}>Добавить</button>
          </div>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Загрузка…</div>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="py-2 pr-2">Название</th>
              <th className="py-2 pr-2">Применение</th>
              <th className="py-2 pr-2">Free, мин</th>
              <th className="py-2 pr-2">Ставка</th>
              <th className="py-2 pr-2">Кэп/день</th>
              <th className="py-2 pr-2 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map(t => (
              <tr key={t.id}>
                <td className="py-2 pr-2">
                  <input className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" value={t.name} onChange={e => update(t.id, { name: e.target.value })} />
                </td>
                <td className="py-2 pr-2">
                  <select className={`rounded-md px-2 py-1 ${badgeColor(t.applies_on)}`} value={t.applies_on} onChange={e => update(t.id, { applies_on: e.target.value as any })}>
                    <option value="always">Всегда</option>
                    <option value="weekday">Будни</option>
                    <option value="weekend">Выходные</option>
                    <option value="custom">Другое</option>
                  </select>
                </td>
                <td className="py-2 pr-2 w-24">
                  <input className="w-24 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" type="number" value={t.free_minutes} onChange={e => update(t.id, { free_minutes: Number(e.target.value) })} />
                </td>
                <td className="py-2 pr-2 w-36">
                  <div className="flex items-center gap-2">
                    <input className="w-28 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" type="number" value={t.rate_cents_per_hour} onChange={e => update(t.id, { rate_cents_per_hour: Number(e.target.value) })} />
                    <span className="text-xs text-gray-500">коп/час ({fmtMDL((t.rate_cents_per_hour||0)/100)})</span>
                  </div>
                </td>
                <td className="py-2 pr-2 w-36">
                  <div className="flex items-center gap-2">
                    <input className="w-28 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" type="number" value={t.max_daily_cents ?? 0} onChange={e => update(t.id, { max_daily_cents: Number(e.target.value) })} />
                    <span className="text-xs text-gray-500">({fmtMDL((t.max_daily_cents||0)/100)})</span>
                  </div>
                </td>
                <td className="py-2 pr-2 text-right">
                  <button className="px-2 py-1 rounded-md bg-red-600 text-white" onClick={() => del(t.id)}>Удалить</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={6} className="py-3 text-sm text-gray-500">Тарифов пока нет</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
