import { useEffect, useState } from 'react'
import { api } from '../api'

type Session = { id: number; vehicle: string; zone_id: number; zone_name: string; started_at: string; elapsed_sec: number; due_amount?: number; price_per_hour?: number; currency?: string }

export default function Sessions() {
  const [items, setItems] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.get('/admin/sessions/open')
      setItems(r.data)
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const forceClose = async (id: number) => {
    await api.post(`/admin/sessions/${id}/close`)
    load()
  }

  useEffect(() => { load() }, [])

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60), s = sec % 60
    const h = Math.floor(m / 60), mm = m % 60
    return h > 0 ? `${h}ч ${mm}м` : `${m}м ${s}с`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Открытые сессии</h3>
        <button className="px-3 py-2 rounded-md bg-slate-700 text-white" onClick={load} disabled={loading}>Обновить</button>
      </div>
      {error && <div className="mb-2 border border-red-300 bg-red-50 text-red-700 rounded p-2 text-sm">{error}</div>}
      <div className="border border-gray-200 dark:border-gray-700 rounded max-h-80 overflow-y-auto">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {items.map((i) => (
            <li key={i.id} className="py-2 px-2 flex items-center gap-3">
              <div className="w-24 text-xs text-gray-500">ID:{i.id}</div>
              <div className="w-28 font-medium">{i.vehicle}</div>
              <div className="w-10">{i.zone_name}</div>
              <div className="text-xs text-gray-500 flex-1">с {new Date(i.started_at).toLocaleString()} · {fmt(i.elapsed_sec)}</div>
              {i.due_amount !== undefined && (
                <div className="text-sm font-medium">{i.due_amount} {i.currency || 'MDL'}</div>
              )}
              <button className="px-3 py-1 rounded-md bg-amber-600 text-white" onClick={() => forceClose(i.id)}>Закрыть</button>
            </li>
          ))}
          {items.length === 0 && <li className="py-2 px-2 text-sm text-gray-500">Сейчас открытых сессий нет</li>}
        </ul>
      </div>
    </div>
  )
}
