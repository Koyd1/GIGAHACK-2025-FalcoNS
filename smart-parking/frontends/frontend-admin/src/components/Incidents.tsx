import { useEffect, useState } from 'react'
import { api } from '../api'

type Incident = {
  id: number
  type: string
  status: string
  created_at: string
  note?: string
  zone_name?: string
  session_id?: number | null
  station_id?: number | null
  vehicle_plate?: string | null
  payload_json?: any
}

export default function Incidents() {
  const [items, setItems] = useState<Incident[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const load = async () => {
    setLoading(true)
    try {
      setError('')
      const r = await api.get('/admin/incidents')
      setItems(r.data)
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки логов событий')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const badge = (t: string) => {
    const m: Record<string, string> = {
      payment_failed: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200',
      payment_success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
      ticket_issued: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200',
      tariff_applied: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200',
      info: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
    return m[t] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  }

  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  const relTime = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    const m = Math.floor(diff / 60), h = Math.floor(m / 60)
    if (h > 0) return `${h}ч ${m % 60}м назад`
    if (m > 0) return `${m}м назад`
    return `${diff}с назад`
  }

  const summarize = (i: Incident) => {
    const p = i.payload_json || {}
    if (i.type === 'payment_success') {
      const amt = Number(p.amount_cents || 0) / 100
      return `Оплата ${amt.toFixed(2)} MDL, метод: ${p.method || '—'}${p.processor_ref ? `, ref: ${p.processor_ref}` : ''}`
    }
    if (i.type === 'payment_failed') {
      const amt = Number(p.amount_cents || 0) / 100
      return `Неуспешная оплата ${amt.toFixed(2)} MDL${p.processor_ref ? `, ref: ${p.processor_ref}` : ''}`
    }
    if (i.type === 'ticket_issued') {
      return `Выдан билет${p.ticket_code ? ` ${p.ticket_code}` : ''}${p.vehicle_plate ? ` для ${p.vehicle_plate}` : ''}`
    }
    if (i.type === 'tariff_applied') {
      const rate = Number(p.rate_cents_per_hour || 0) / 100
      const cap = p.max_daily_cents != null ? `${(Number(p.max_daily_cents)/100).toFixed(2)} MDL/день` : '—'
      return `Применён тариф: ${p.tariff_name || '—'} · ${rate.toFixed(2)} MDL/час · кап: ${cap}`
    }
    if (i.type === 'info') {
      return i.note || p.note || ''
    }
    return i.note || ''
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-semibold">Логи событий</h3>
          <p className="text-xs text-gray-500">Только для просмотра, без закрытия</p>
        </div>
        <button className="px-3 py-2 rounded-md bg-blue-600 text-white" onClick={load} disabled={loading}>{loading ? 'Загрузка…' : 'Обновить'}</button>
      </div>
      {error && (
        <div className="mb-2 border border-red-300 bg-red-50 text-red-700 rounded p-2 max-h-32 overflow-y-auto text-sm">
          {error}
        </div>
      )}
      <div className="border border-gray-200 dark:border-gray-700 rounded max-h-96 overflow-y-auto">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {items.map(i => {
            const isOpen = !!expanded[i.id]
            return (
              <li key={i.id} className="py-2 px-2">
                <div className="flex items-start gap-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge(i.type)}`}>{i.type}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="truncate">
                        <span className="text-sm font-medium mr-2">{i.zone_name || '—'}</span>
                        {i.vehicle_plate && <span className="text-xs text-gray-500">[{i.vehicle_plate}]</span>}
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">{relTime(i.created_at)} · {new Date(i.created_at).toLocaleString()}</div>
                    </div>
                    <div className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 break-words">
                      {summarize(i) || <span className="text-gray-500">—</span>}
                    </div>
                    <div className="mt-1">
                      <button className="text-xs text-blue-600 hover:underline" onClick={() => setExpanded(s => ({ ...s, [i.id]: !isOpen }))}>{isOpen ? 'Скрыть детали' : 'Детали'}</button>
                    </div>
                    {isOpen && (
                      <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 overflow-x-auto">
                        {JSON.stringify(i.payload_json || {}, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
          {items.length === 0 && <li className="py-2 px-2 text-sm text-gray-500">Событий нет</li>}
        </ul>
      </div>
    </div>
  )
}
