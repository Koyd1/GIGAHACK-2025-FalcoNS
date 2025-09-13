import { useEffect, useState } from 'react'
import { api } from '../api'

type Voucher = { id: number; code: string; balance_cents: number; expires_at: string | null }

export default function Vouchers() {
  const [items, setItems] = useState<Voucher[]>([])
  const [code, setCode] = useState('')
  const [balance, setBalance] = useState<number>(0)
  const [expires, setExpires] = useState('')

  const load = async () => {
    const r = await api.get('/ai/vouchers')
    setItems(r.data)
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!code) return
    await api.post('/ai/vouchers', { code, balance_cents: balance, expires_at: expires || null })
    setCode(''); setBalance(0); setExpires('')
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Ваучеры</h3>
        <button className="px-3 py-2 rounded-md bg-blue-600 text-white" onClick={load}>Обновить</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Код ваучера</label>
          <input className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 font-mono" placeholder="Напр. GIFT-50MDL" value={code} onChange={e => setCode(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Баланс (копейки)</label>
          <input className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2" type="number" placeholder="напр. 5000 (50 MDL)" value={balance} onChange={e => setBalance(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Действителен до</label>
          <input className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2" type="datetime-local" value={expires} onChange={e => setExpires(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button className="px-3 py-2 rounded-md bg-emerald-600 text-white w-full" onClick={add}>Добавить</button>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-2">Подсказка: баланс указывается в копейках. Пример: 5000 = 50.00 MDL</p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="py-2 pr-2">Код</th>
              <th className="py-2 pr-2">Баланс</th>
              <th className="py-2 pr-2">Действителен до</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map(v => (
              <tr key={v.id}>
                <td className="py-2 pr-2 font-medium font-mono max-w-[16rem] truncate" title={v.code}>{v.code}</td>
                <td className="py-2 pr-2">{v.balance_cents} коп</td>
                <td className="py-2 pr-2 text-gray-500">{v.expires_at || '—'}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={3} className="py-3 text-sm text-gray-500">Нет ваучеров</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
