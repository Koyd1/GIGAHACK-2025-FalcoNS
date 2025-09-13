import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { fmtMDL } from '../utils'

function CurrencyIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 3v18M7 7h8a4 4 0 1 1 0 8H7" />
    </svg>
  )
}
function SessionsIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M7 20h10" />
    </svg>
  )
}
function ZonesIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 2l7 4v6c0 5-7 10-7 10S5 17 5 12V6l7-4z" />
    </svg>
  )
}

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

  const totalRevenue = useMemo(() => revenue.reduce((s, r) => s + Number(r.revenue || 0), 0), [revenue])
  const totalOpen = useMemo(() => open.reduce((s, r) => s + Number(r.open || 0), 0), [open])
  const maxRev = useMemo(() => Math.max(1, ...revenue.map(r => Number(r.revenue || 0))), [revenue])
  const maxOpen = useMemo(() => Math.max(1, ...open.map(o => Number(o.open || 0))), [open])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Отчёты</h3>
          <p className="text-xs text-gray-500">Сводка по AI‑сессиям и оплатам</p>
        </div>
        <button className="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50" onClick={load} disabled={loading}>
          {loading ? 'Загрузка…' : 'Обновить'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat title="Выручка (всего)" value={fmtMDL(totalRevenue)} color="emerald" icon={<CurrencyIcon className="w-4 h-4" />} />
        <Stat title="Открытых сессий" value={String(totalOpen)} color="amber" icon={<SessionsIcon className="w-4 h-4" />} />
        <Stat title="Зон (выручка)" value={String(revenue.length)} color="indigo" icon={<ZonesIcon className="w-4 h-4" />} />
        <Stat title="Зон (открыто)" value={String(open.length)} color="sky" icon={<ZonesIcon className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-3">Выручка по зонам</h4>
          <div className="space-y-2">
            {revenue.map(r => {
              const v = Number(r.revenue || 0)
              const w = Math.max(4, Math.round((v / maxRev) * 100))
              return (
                <div key={r.zone} className="flex items-center gap-3">
                  <div className="w-14 text-sm text-gray-600 dark:text-gray-400">{r.zone}</div>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded h-3 overflow-hidden">
                    <div className="h-3 bg-emerald-500" style={{ width: `${w}%` }} />
                  </div>
                  <div className="w-28 text-right text-sm">{fmtMDL(v)}</div>
                </div>
              )
            })}
            {revenue.length === 0 && <div className="text-sm text-gray-500">Нет данных</div>}
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-3">Открытые сессии</h4>
          <div className="space-y-2">
            {open.map(o => {
              const v = Number(o.open || 0)
              const w = Math.max(4, Math.round((v / maxOpen) * 100))
              return (
                <div key={o.zone} className="flex items-center gap-3">
                  <div className="w-14 text-sm text-gray-600 dark:text-gray-400">{o.zone}</div>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded h-3 overflow-hidden">
                    <div className="h-3 bg-amber-500" style={{ width: `${w}%` }} />
                  </div>
                  <div className="w-20 text-right text-sm">{v}</div>
                </div>
              )
            })}
            {open.length === 0 && <div className="text-sm text-gray-500">Нет данных</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ title, value, color, icon }: { title: string; value: string; color?: 'emerald' | 'amber' | 'indigo' | 'sky'; icon?: any }) {
  const bg = color === 'amber' ? 'bg-amber-50 dark:bg-amber-900/20' : color === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-900/20' : color === 'sky' ? 'bg-sky-50 dark:bg-sky-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'
  const dot = color === 'amber' ? 'bg-amber-500' : color === 'indigo' ? 'bg-indigo-500' : color === 'sky' ? 'bg-sky-500' : 'bg-emerald-500'
  return (
    <div className={`rounded-lg p-3 ${bg}`}>
      <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2 mb-1">
        {icon ? icon : <span className={`w-2 h-2 rounded-full ${dot}`} />}
        {title}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}
