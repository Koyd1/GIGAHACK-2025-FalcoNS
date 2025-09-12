import { useEffect, useState } from 'react'
import { api } from '../api'

type Zone = { id: number; name: string }
type Rate = { id: number; zone_id: number; price_per_hour: number; currency: string; zone_name?: string }

export default function Rates({ zones }: { zones: Zone[] }) {
  const [rates, setRates] = useState<Rate[]>([])
  const [zoneId, setZoneId] = useState<number | ''>('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('RUB')

  const load = async () => {
    const r = await api.get('/admin/rates')
    setRates(r.data)
  }

  useEffect(() => { load() }, [])

  const add = async () => {
    if (!zoneId || !price) return
    await api.post('/admin/rates', { zoneId, pricePerHour: Number(price), currency })
    setPrice('')
    setZoneId('')
    setCurrency('RUB')
    load()
  }

  const update = async (r: Rate, patch: Partial<Rate>) => {
    await api.put(`/admin/rates/${r.id}`, patch)
    load()
  }

  const del = async (r: Rate) => {
    await api.delete(`/admin/rates/${r.id}`)
    load()
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">Тарифы</h3>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <select
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
          value={zoneId}
          onChange={e => setZoneId(Number(e.target.value))}
        >
          <option value="">Зона</option>
          {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <input
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
          placeholder="Цена/час"
          value={price}
          onChange={e => setPrice(e.target.value)}
        />
        <input
          className="w-28 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
          placeholder="Валюта"
          value={currency}
          onChange={e => setCurrency(e.target.value.toUpperCase())}
        />
        <button className="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50" onClick={add}>
          Добавить
        </button>
      </div>
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {rates.map(r => (
          <li key={r.id} className="py-2 flex items-center gap-2">
            <span className="w-20 font-medium">{r.zone_name || r.zone_id}</span>
            <input className="w-28 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" value={r.price_per_hour} onChange={e => update(r, { pricePerHour: Number(e.target.value) } as any)} />
            <input className="w-24 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" value={r.currency} onChange={e => update(r, { currency: e.target.value.toUpperCase() as any })} />
            <button className="ml-auto px-3 py-1 rounded-md bg-red-600 text-white" onClick={() => del(r)}>Удалить</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
