import { useEffect, useState } from 'react'
import { api } from '../api'

type Incident = { id: number; type: string; status: string; created_at: string; note?: string; ticket_id?: number; zone_name?: string }

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
      setError(e?.message || 'Ошибка загрузки инцидентов')
    } finally {
      setLoading(false)
    }
  }

  const resolve = async (id: number) => {
    await api.post(`/admin/incidents/${id}/resolve`, { status: 'resolved' })
    load()
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Инциденты</h3>
        <button className="px-3 py-2 rounded-md bg-slate-700 text-white" onClick={load} disabled={loading}>Обновить</button>
      </div>
      {error && (
        <div className="mb-2 border border-red-300 bg-red-50 text-red-700 rounded p-2 max-h-32 overflow-y-auto text-sm">
          {error}
        </div>
      )}
      <div className="border border-gray-200 dark:border-gray-700 rounded max-h-72 overflow-y-auto">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {items.map(i => (
            <li key={i.id} className="py-2 px-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{i.type} — {i.status}</div>
                <div className="text-xs text-gray-500">{i.zone_name || '—'} · {new Date(i.created_at).toLocaleString()} {i.note ? `· ${i.note}` : ''}</div>
              </div>
              {i.status !== 'resolved' && (
                <button className="px-3 py-1 rounded-md bg-emerald-600 text-white" onClick={() => resolve(i.id)}>Закрыть</button>
              )}
            </li>
          ))}
          {items.length === 0 && <li className="py-2 px-2 text-sm text-gray-500">Сейчас инцидентов нет</li>}
        </ul>
      </div>
    </div>
  )
}
