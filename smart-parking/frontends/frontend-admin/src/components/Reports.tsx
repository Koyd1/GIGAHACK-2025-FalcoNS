import { useEffect, useState } from 'react'
import { api } from '../api'

type Revenue = { zone: string; revenue: string }
type Open = { zone: string; open: string }

export default function Reports() {
  const [revenue, setRevenue] = useState<Revenue[]>([])
  const [open, setOpen] = useState<Open[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get('/admin/reports')
      setRevenue(r.data.revenueByZone || [])
      setOpen(r.data.openTicketsByZone || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Отчёты</h3>
        <button className="px-3 py-2 rounded-md bg-slate-700 text-white" onClick={load} disabled={loading}>
          Обновить
        </button>
      </div>
      {loading && <div className="text-sm text-gray-500">Загрузка…</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium mb-2">Выручка по зонам</h4>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {revenue.map((r) => (
              <li key={r.zone} className="py-2 flex justify-between">
                <span>{r.zone}</span>
                <span>{Number(r.revenue).toFixed(2)} RUB</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-2">Открытые сессии</h4>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {open.map((o) => (
              <li key={o.zone} className="py-2 flex justify-between">
                <span>{o.zone}</span>
                <span>{o.open}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
