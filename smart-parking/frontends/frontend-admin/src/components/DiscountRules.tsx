import { useEffect, useState } from 'react'
import { api } from '../api'

type Rule = { id: number; code: string | null; kind: string; value: number; valid_from: string | null; valid_to: string | null }

export default function DiscountRules() {
  const [items, setItems] = useState<Rule[]>([])
  const [code, setCode] = useState('')
  const [kind, setKind] = useState<'percent' | 'fixed'>('percent' as any)
  const [value, setValue] = useState<number>(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = async () => {
    const r = await api.get('/ai/discount-rules')
    setItems(r.data)
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    await api.post('/ai/discount-rules', { code: code || null, kind, value, valid_from: from || null, valid_to: to || null })
    setCode(''); setKind('percent' as any); setValue(0); setFrom(''); setTo('')
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Скидки</h3>
        <button className="px-3 py-2 rounded-md bg-blue-600 text-white" onClick={load}>Обновить</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Код скидки (опционально)</label>
          <input className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 font-mono" placeholder="Напр. WEEKEND10" value={code} onChange={e => setCode(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Тип</label>
          <select className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2" value={kind} onChange={e => setKind(e.target.value as any)}>
            <option value="percent">Процент</option>
            <option value="fixed">Фикс. сумма, коп</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Значение</label>
          <input className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2" type="number" placeholder="напр. 10 (процент) или 500 (коп.)" value={value} onChange={e => setValue(Number(e.target.value))} />
        </div>
        <div className="md:col-span-1 flex items-end">
          <button className="px-3 py-2 rounded-md bg-emerald-600 text-white w-full" onClick={add}>Добавить/обновить</button>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Начало</label>
          <input className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2" type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Конец</label>
          <input className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2" type="datetime-local" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-2">Подсказка: для типа 'Процент' значение — от 1 до 100; для 'Фикс. сумма' значение — в копейках (500 = 5 MDL).</p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="py-2 pr-2">Код</th>
              <th className="py-2 pr-2">Тип</th>
              <th className="py-2 pr-2">Значение</th>
              <th className="py-2 pr-2">Период</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map(r => (
              <tr key={r.id}>
                <td className="py-2 pr-2 font-medium font-mono max-w-[16rem] truncate" title={r.code || '—'}>{r.code || '—'}</td>
                <td className="py-2 pr-2">{r.kind}</td>
                <td className="py-2 pr-2">{r.value}</td>
                <td className="py-2 pr-2 text-gray-500">{r.valid_from || '—'} → {r.valid_to || '—'}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4} className="py-3 text-sm text-gray-500">Нет скидок</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
