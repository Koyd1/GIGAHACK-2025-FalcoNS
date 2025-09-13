import { useEffect, useState } from 'react'
import { api } from '../api'
import { fmtMDL } from '../utils'

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
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold">Открытые сессии</h3>
          <p className="text-xs text-gray-500">Предпросчёт суммы по текущему тарифу</p>
        </div>
        <button className="px-3 py-2 rounded-md bg-blue-600 text-white" onClick={load} disabled={loading}>{loading ? 'Загрузка…' : 'Обновить'}</button>
      </div>
      {error && <div className="mb-3 border border-red-300 bg-red-50 text-red-700 rounded p-2 text-sm">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map(i => (
          <div key={i.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-500">ID:{i.id}</div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{i.zone_name}</span>
            </div>
            <div className="text-base font-semibold mb-1">{i.vehicle}</div>
            <div className="text-xs text-gray-500 mb-2">с {new Date(i.started_at).toLocaleString()} · {fmt(i.elapsed_sec)}</div>
            <div className="flex items-center justify-between">
              {i.due_amount !== undefined ? (
                <div className="text-sm"><span className="text-gray-500">Долг:</span> <span className="font-semibold">{fmtMDL(i.due_amount || 0)}</span></div>
              ) : <div />}
              <button className="px-3 py-1 rounded-md bg-amber-600 text-white" onClick={() => forceClose(i.id)}>Закрыть</button>
            </div>
          </div>
        ))}
        {items.length === 0 && !loading && <div className="text-sm text-gray-500">Сейчас открытых сессий нет</div>}
      </div>
    </div>
  )
}
