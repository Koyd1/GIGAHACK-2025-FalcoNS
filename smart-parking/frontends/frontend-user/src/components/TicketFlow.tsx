import { useEffect, useState } from 'react'
import { api } from '../api'

type Stage = 'idle' | 'open' | 'closed' | 'paid'

export default function TicketFlow({ zoneId, vehicle, onVehicleChange }: { zoneId: number; vehicle: string; onVehicleChange: (v: string) => void }) {
  const [ticketId, setTicketId] = useState<number | null>(null)
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [amount, setAmount] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false)

  // Sync with assistant events (opened/closed/paid)
  useEffect(() => {
    const onOpened = (e: any) => {
      const d = e?.detail || {}
      if (typeof d.ticketId === 'number') {
        setTicketId(d.ticketId)
        setStage('open')
        setStatus('Открыт')
        if (d.vehicle) onVehicleChange(String(d.vehicle))
      }
    }
    const onClosed = (e: any) => {
      const d = e?.detail || {}
      if (typeof d.ticketId === 'number') {
        setTicketId(d.ticketId)
        setStage('closed')
        setStatus(`Закрыт, сумма: ${d.amount ?? ''}`)
      }
    }
    const onPaid = (e: any) => {
      const d = e?.detail || {}
      if (typeof d.ticketId === 'number') {
        setStage('paid')
        setStatus('Оплачен')
        setTicketId(null)
      }
    }
    window.addEventListener('ticket:opened', onOpened as EventListener)
    window.addEventListener('ticket:closed', onClosed as EventListener)
    window.addEventListener('ticket:paid', onPaid as EventListener)
    return () => {
      window.removeEventListener('ticket:opened', onOpened as EventListener)
      window.removeEventListener('ticket:closed', onClosed as EventListener)
      window.removeEventListener('ticket:paid', onPaid as EventListener)
    }
  }, [onVehicleChange])


  const start = async () => {
    setLoading(true)
    try {
      const r = await api.post('/tickets', { vehicle, zoneId })
      setTicketId(r.data.id)
      setStatus('Открыт')
      setStage('open')
    } finally {
      setLoading(false)
    }
  }

  const close = async () => {
    if (!ticketId) return
    setLoading(true)
    try {
      const r = await api.post(`/tickets/${ticketId}/close`)
      setStatus(`Закрыт, сумма: ${r.data.amount}`)
      setAmount(Number(r.data.amount))
      setStage('closed')
    } finally {
      setLoading(false)
    }
  }

  const doPay = async () => {
    if (!ticketId) return
    setLoading(true)
    try {
      const r = await api.post(`/payments/${ticketId}/pay`)
      setStatus(`Оплачен (${r.data.payment.provider_payment_id || r.data.payment.paymentId})`)
      setStage('paid')
      // Освобождаем возможность открыть новую парковку
      setTicketId(null)
      setAmount(null)
    } finally {
      setLoading(false)
    }
  }

  const pay = async () => {
    if (!ticketId) return
    // Показываем подтверждение оплаты с суммой
    setConfirmOpen(true)
  }

  const reset = () => {
    setTicketId(null)
    setStatus('')
    setStage('idle')
    // по желанию можно очищать номер:
    // setVehicle('')
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 w-full max-w-sm">
            <h4 className="text-lg font-semibold mb-2">Подтверждение оплаты</h4>
            <p className="mb-4 text-sm">Списать сумму {amount ?? '—'} за парковку?</p>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded-md bg-gray-200 dark:bg-gray-700" onClick={() => setConfirmOpen(false)}>Отмена</button>
              <button className="px-3 py-2 rounded-md bg-emerald-600 text-white" onClick={() => { setConfirmOpen(false); doPay(); }}>Оплатить</button>
            </div>
          </div>
        </div>
      )}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Номер авто</label>
        <input
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={vehicle}
          onChange={e => onVehicleChange(e.target.value)}
          disabled={stage === 'open' && !loading}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
          onClick={start}
          disabled={loading || stage === 'open' || stage === 'closed'}
        >
          Начать парковку
        </button>
        <button
          className="px-3 py-2 rounded-md bg-amber-600 text-white disabled:opacity-50"
          onClick={close}
          disabled={loading || stage !== 'open'}
        >
          Завершить
        </button>
        <button
          className="px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50"
          onClick={pay}
          disabled={loading || stage !== 'closed'}
        >
          Оплатить (песочница)
        </button>
        {(stage === 'closed' || stage === 'paid') && (
          <button
            className="px-3 py-2 rounded-md bg-slate-700 text-white disabled:opacity-50"
            onClick={reset}
            disabled={loading}
          >
            Новая парковка
          </button>
        )}
      </div>
      <div className="mt-3 text-sm">
        {loading ? <span className="text-gray-500">Обработка…</span> : <span>Статус: {status || '—'}</span>}
      </div>
      {/* Автопоиск открытого билета по номеру */}
      <VehicleWatcher vehicle={vehicle} onFound={(t) => {
        setTicketId(t.id)
        setStage('open')
        setStatus(`Открыт (ID: ${t.id}, зона: ${t.zone_id})`)
      }} />
    </div>
  )
}

function VehicleWatcher({ vehicle, onFound }: { vehicle: string; onFound: (t: any) => void }) {
  const [lastQueried, setLastQueried] = useState<string>('')
  useEffect(() => {
    if (!vehicle || vehicle.trim().length < 4) return
    const v = vehicle.trim()
    const id = setTimeout(async () => {
      if (v === lastQueried) return
      try {
        const r = await api.get('/tickets/search', { params: { vehicle: v } })
        if (r.data && r.data.id) {
          onFound(r.data)
          setLastQueried(v)
        }
      } catch {
        // ignore 404
      }
    }, 500)
    return () => clearTimeout(id)
  }, [vehicle])
  return null
}
