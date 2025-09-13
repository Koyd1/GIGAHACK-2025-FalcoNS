// // import { useEffect, useMemo, useState } from 'react'
// // import { api } from '../api'

// // type Zone = { id: number; name: string }

// // type Props = {
// //   zones: Zone[]
// //   vehicle: string
// //   onVehicleChange: (v: string) => void
// // }

// // // Компонент: вводим только номер. Если открытого билета нет — пускаем на парковку.
// // // Если есть — можно закрыть и оплатить.
// // export default function ZonePicker({ zones, vehicle, onVehicleChange }: Props) {
// //   const [found, setFound] = useState<any | null>(null)
// //   const [loading, setLoading] = useState(false)
// //   const [error, setError] = useState('')
// //   const [status, setStatus] = useState('')
// //   const [amountCents, setAmountCents] = useState<number | null>(null)
// //   const [confirmOpen, setConfirmOpen] = useState(false)

// //   // Выберем дефолтную зону (первая) — без ручного выбора
// //   const defaultZoneId = useMemo(() => zones?.[0]?.id ?? null, [zones])

// //   // Поиск открытого (или оплаченного) билета по номеру
// //   useEffect(() => {
// //     setError('')
// //     setStatus('')
// //     setAmountCents(null)
// //     const v = (vehicle || '').trim()
// //     if (!v || v.length < 4) { setFound(null); return }
// //     const id = setTimeout(async () => {
// //       try {
// //         const r = await api.get('/ai/sessions/search', { params: { vehicle: v } })
// //         setFound(r.data)
// //         setStatus(`Найден билет #${r.data.id} (${r.data.status})`)
// //       } catch {
// //         setFound(null)
// //         setStatus('Не найдено активного билета')
// //       }
// //     }, 400)
// //     return () => clearTimeout(id)
// //   }, [vehicle])

// //   const start = async () => {
// //     setError('')
// //     setLoading(true)
// //     try {
// //       const plate = (vehicle || '').trim().toUpperCase()
// //       if (!plate || plate.length < 4) { setError('Укажите корректный номер авто'); return }
// //       if (!defaultZoneId) { setError('Нет доступных зон'); return }
// //       const r = await api.post('/ai/sessions/start', { zone_id: defaultZoneId, vehicle_plate: plate })
// //       setFound(r.data)
// //       setStatus(`Открыт билет #${r.data.id}`)
// //     } catch (e: any) {
// //       const msg = e?.response?.data?.error || e?.message || 'Ошибка'
// //       setError(String(msg))
// //     } finally {
// //       setLoading(false)
// //     }
// //   }

// //   const close = async () => {
// //     if (!found?.id) return
// //     setError('')
// //     setLoading(true)
// //     try {
// //       const r = await api.post(`/ai/sessions/${found.id}/close`)
// //       const due = Number(r.data.amount_due_cents || 0)
// //       // Если сумма 0 (бесплатный период), сервер сразу пометит статус как paid.
// //       if (due === 0 || String(r.data.status).toLowerCase() === 'paid') {
// //         setStatus('Бесплатно: оплата не требуется, можно выезжать')
// //         setFound(null)
// //         setAmountCents(null)
// //       } else {
// //         setFound(r.data)
// //         setAmountCents(due)
// //         setStatus(`Закрыт, сумма: ${(due/100).toFixed(2)} MDL`)
// //       }
// //     } catch (e: any) {
// //       const msg = e?.response?.data?.error || e?.message || 'Ошибка'
// //       setError(String(msg))
// //     } finally {
// //       setLoading(false)
// //     }
// //   }

// //   const doPay = async () => {
// //     if (!found?.id || amountCents == null) return
// //     setError('')
// //     setLoading(true)
// //     try {
// //       const r = await api.post(`/ai/sessions/${found.id}/payments`, { method: 'card', amount_cents: amountCents, approved: true })
// //       setStatus(`Оплачен (${r.data.payment.processor_ref || r.data.payment.id})`)
// //       // позволим сразу открыть новую парковку
// //       setFound(null)
// //       setAmountCents(null)
// //     } catch (e: any) {
// //       const msg = e?.response?.data?.error || e?.message || 'Ошибка'
// //       setError(String(msg))
// //     } finally {
// //       setLoading(false)
// //     }
// //   }

// //   const canClose = !!found && found.status === 'active'
// //   const canPay = !!found && (found.status === 'closed' || (found.amount_due_cents && (found.amount_paid_cents||0) < found.amount_due_cents))
// //   const canStart = !found

// //   return (
// //     <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
// //       {confirmOpen && (
// //         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
// //           <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 w-full max-w-sm">
// //             <h4 className="text-lg font-semibold mb-2">Подтверждение оплаты</h4>
// //             <p className="mb-4 text-sm">Списать {(amountCents||0)/100} MDL за парковку?</p>
// //             <div className="flex justify-end gap-2">
// //               <button className="px-3 py-2 rounded-md bg-gray-200 dark:bg-gray-700" onClick={() => setConfirmOpen(false)}>Отмена</button>
// //               <button className="px-3 py-2 rounded-md bg-emerald-600 text-white" onClick={() => { setConfirmOpen(false); doPay(); }}>Оплатить</button>
// //             </div>
// //           </div>
// //         </div>
// //       )}
// //       <div className="mb-3">
// //         <label className="block text-sm font-medium mb-1">Номер авто</label>
// //         <input
// //           className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
// //           value={vehicle}
// //           onChange={e => onVehicleChange(e.target.value)}
// //           placeholder="Например: ABC123"
// //           disabled={loading}
// //         />
// //       </div>
// //       <div className="flex flex-wrap gap-2">
        
// //         <button className="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50" onClick={start} disabled={loading || !canStart || !defaultZoneId}>Пустить на парковку</button>
// //         <button className="px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50" onClick={() => setConfirmOpen(true)} disabled={loading || !canPay}>Оплатить</button>
// //         <button className="px-3 py-2 rounded-md bg-amber-600 text-white disabled:opacity-50" onClick={close} disabled={loading || !canClose}>Закрыть билет</button>
// //       </div>
// //       <div className="mt-3 text-sm">
// //         {error ? <span className="text-red-600">{error}</span> : <span>Статус: {status || (found ? `Билет #${found.id} (${found.status})` : '—')}</span>}
// //         {!defaultZoneId && <div className="text-xs text-amber-600 mt-1">Нет доступных зон — создание билета недоступно</div>}
// //       </div>
// //     </div>
// //   )
// // }


// // import { useEffect, useMemo, useState } from 'react'
// // import { api } from '../api'

// // type Zone = { id: number; name: string }

// // type Props = {
// //   zones: Zone[]
// //   vehicle: string
// //   onVehicleChange: (v: string) => void
// // }

// // export default function ZonePicker({ zones, vehicle, onVehicleChange }: Props) {
// //   const [found, setFound] = useState<any | null>(null)
// //   const [loading, setLoading] = useState(false)
// //   const [error, setError] = useState('')
// //   const [status, setStatus] = useState('')
// //   const [amountCents, setAmountCents] = useState<number | null>(null)
// //   const [confirmOpen, setConfirmOpen] = useState(false)

// //   const defaultZoneId = useMemo(() => zones?.[0]?.id ?? null, [zones])

// //   useEffect(() => {
// //     setError('')
// //     setStatus('')
// //     setAmountCents(null)
// //     const v = (vehicle || '').trim()
// //     if (!v || v.length < 4) { setFound(null); return }
// //     const id = setTimeout(async () => {
// //       try {
// //         const r = await api.get('/ai/sessions/search', { params: { vehicle: v } })
// //         setFound(r.data)
// //         setStatus(`Найден билет #${r.data.id} (${r.data.status})`)
// //       } catch {
// //         setFound(null)
// //         setStatus('Не найдено активного билета')
// //       }
// //     }, 400)
// //     return () => clearTimeout(id)
// //   }, [vehicle])

// //   const start = async () => {
// //     setError('')
// //     setLoading(true)
// //     try {
// //       const plate = (vehicle || '').trim().toUpperCase()
// //       if (!plate || plate.length < 4) { setError('Укажите корректный номер авто'); return }
// //       if (!defaultZoneId) { setError('Нет доступных зон'); return }
// //       const r = await api.post('/ai/sessions/start', { zone_id: defaultZoneId, vehicle_plate: plate })
// //       setFound(r.data)
// //       setStatus(`Открыт билет #${r.data.id}`)
// //     } catch (e: any) {
// //       const msg = e?.response?.data?.error || e?.message || 'Ошибка'
// //       setError(String(msg))
// //     } finally {
// //       setLoading(false)
// //     }
// //   }

// //   // Закрытие билета вызывается только после успешной оплаты
// //   const close = async () => {
// //     if (!found?.id) return
// //     try {
// //       const r = await api.post(`/ai/sessions/${found.id}/close`)
// //       setStatus(`Билет #${r.data.id} закрыт (${r.data.status})`)
// //       setFound(null)
// //       setAmountCents(null)
// //     } catch (e: any) {
// //       const msg = e?.response?.data?.error || e?.message || 'Ошибка'
// //       setError(String(msg))
// //     }
// //   }

// //   const doPay = async () => {
// //     if (!found?.id) return
// //     setError('')
// //     setLoading(true)
// //     try {
// //       // сначала проверим сумму
// //       const due = Number(found.amount_due_cents || 0)
// //       if (due === 0) {
// //         // если бесплатно → сразу закрываем
// //         await close()
// //         setStatus('Бесплатно: оплата не требуется')
// //         return
// //       }

// //       const r = await api.post(`/ai/sessions/${found.id}/payments`, { method: 'card', amount_cents: due, approved: true })
// //       setStatus(`Оплачен (${r.data.payment.processor_ref || r.data.payment.id})`)
      
// //       // после успешной оплаты — закрываем билет
// //       await close()
// //     } catch (e: any) {
// //       const msg = e?.response?.data?.error || e?.message || 'Ошибка'
// //       setError(String(msg))
// //     } finally {
// //       setLoading(false)
// //     }
// //   }

// //   const canPay = !!found && found.status === 'active'
// //   const canStart = !found

// //   return (
// //     <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
// //       {confirmOpen && (
// //         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
// //           <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 w-full max-w-sm">
// //             <h4 className="text-lg font-semibold mb-2">Подтверждение оплаты</h4>
// //             <p className="mb-4 text-sm">Списать {(found?.amount_due_cents||0)/100} MDL за парковку?</p>
// //             <div className="flex justify-end gap-2">
// //               <button className="px-3 py-2 rounded-md bg-gray-200 dark:bg-gray-700" onClick={() => setConfirmOpen(false)}>Отмена</button>
// //               <button className="px-3 py-2 rounded-md bg-emerald-600 text-white" onClick={() => { setConfirmOpen(false); doPay(); }}>Оплатить</button>
// //             </div>
// //           </div>
// //         </div>
// //       )}
// //       <div className="mb-3">
// //         <label className="block text-sm font-medium mb-1">Номер авто</label>
// //         <input
// //           className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
// //           value={vehicle}
// //           onChange={e => onVehicleChange(e.target.value)}
// //           placeholder="Например: ABC123"
// //           disabled={loading}
// //         />
// //       </div>
// //       <div className="flex flex-wrap gap-2">
// //         <button className="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50" onClick={start} disabled={loading || !canStart || !defaultZoneId}>Пустить на парковку</button>
// //         <button className="px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50" onClick={() => setConfirmOpen(true)} disabled={loading || !canPay}>Оплатить и закрыть</button>
// //       </div>
// //       <div className="mt-3 text-sm">
// //         {error ? <span className="text-red-600">{error}</span> : <span>Статус: {status || (found ? `Билет #${found.id} (${found.status})` : '—')}</span>}
// //         {!defaultZoneId && <div className="text-xs text-amber-600 mt-1">Нет доступных зон — создание билета недоступно</div>}
// //       </div>
// //     </div>
// //   )
// // }


// import { useEffect, useMemo, useState } from 'react'
// import { api } from '../api'

// type Zone = { id: number; name: string }

// type Props = {
//   zones: Zone[]
//   vehicle: string
//   onVehicleChange: (v: string) => void
// }

// export default function ZonePicker({ zones, vehicle, onVehicleChange }: Props) {
//   const [found, setFound] = useState<any | null>(null)
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState('')
//   const [status, setStatus] = useState('')
//   const [amountCents, setAmountCents] = useState<number | null>(null)
//   const [confirmOpen, setConfirmOpen] = useState(false)

//   const defaultZoneId = useMemo(() => zones?.[0]?.id ?? null, [zones])

//   useEffect(() => {
//     setError('')
//     setStatus('')
//     setAmountCents(null)
//     const v = (vehicle || '').trim()
//     if (!v || v.length < 4) { setFound(null); return }
//     const id = setTimeout(async () => {
//       try {
//         const r = await api.get('/ai/sessions/search', { params: { vehicle: v } })
//         setFound(r.data)
//         setStatus(`Найден билет #${r.data.id} (${r.data.status})`)
//       } catch {
//         setFound(null)
//         setStatus('Не найдено активного билета')
//       }
//     }, 400)
//     return () => clearTimeout(id)
//   }, [vehicle])

//   const start = async () => {
//     setError('')
//     setLoading(true)
//     try {
//       const plate = (vehicle || '').trim().toUpperCase()
//       if (!plate || plate.length < 4) { setError('Укажите корректный номер авто'); return }
//       if (!defaultZoneId) { setError('Нет доступных зон'); return }
//       const r = await api.post('/ai/sessions/start', { zone_id: defaultZoneId, vehicle_plate: plate })
//       setFound(r.data)
//       setStatus(`Открыт билет #${r.data.id}`)
//     } catch (e: any) {
//       const msg = e?.response?.data?.error || e?.message || 'Ошибка'
//       setError(String(msg))
//     } finally {
//       setLoading(false)
//     }
//   }

//   // Квотация долга (обязательный шаг перед оплатой!)
//   const quoteDue = async (sessionId: number): Promise<number> => {
//     // 1) Пытаемся вызвать close в режиме предпросчёта (не изменяет статус)
//     try {
//       const r = await api.post(
//         `/ai/sessions/${sessionId}/close`,
//         { preview: true },
//         { params: { preview: 1 } }
//       )
//       return Number(r.data?.amount_due_cents ?? 0)
//     } catch (_) {
//       // 2) Альтернативный эндпоинт квотации, если есть
//       try {
//         const r = await api.get(`/ai/sessions/${sessionId}/quote`)
//         return Number(r.data?.amount_due_cents ?? 0)
//       } catch {
//         // 3) Fallback: то, что уже есть в found (может быть неточно)
//         return Number(found?.amount_due_cents ?? 0)
//       }
//     }
//   }

//   // Закрытие — только ПОСЛЕ успешной оплаты (или если due=0)
//   const close = async () => {
//     if (!found?.id) return
//     try {
//       const r = await api.post(`/ai/sessions/${found.id}/close`)
//       setStatus(`Билет #${r.data.id} закрыт (${r.data.status})`)
//       setFound(null)
//       setAmountCents(null)
//     } catch (e: any) {
//       const msg = e?.response?.data?.error || e?.message || 'Ошибка'
//       setError(String(msg))
//     }
//   }

//   // Подготовка к оплате: считаем due и открываем модалку с точной суммой
//   const preparePay = async () => {
//     if (!found?.id) return
//     setError('')
//     setLoading(true)
//     try {
//       const due = await quoteDue(found.id)
//       if (due <= 0) {
//         // бесплатно → сразу закрываем
//         setLoading(false)
//         setStatus('Бесплатно: оплата не требуется')
//         await close()
//         return
//       }
//       setAmountCents(due)
//       setConfirmOpen(true)
//     } catch (e: any) {
//       const msg = e?.response?.data?.error || e?.message || 'Ошибка'
//       setError(String(msg))
//     } finally {
//       setLoading(false)
//     }
//   }

//   // Оплата подтверждённой суммы и последующее закрытие
//   const doPay = async () => {
//     if (!found?.id || amountCents == null) return
//     setError('')
//     setLoading(true)
//     try {
//       // (Опционально) повторно сверить due за секунду до оплаты:
//       // const latestDue = await quoteDue(found.id)
//       // if (latestDue !== amountCents) setAmountCents(latestDue)

//       const r = await api.post(`/ai/sessions/${found.id}/payments`, {
//         method: 'card',
//         amount_cents: amountCents,
//         approved: true,
//       })
//       setStatus(`Оплачен (${r.data.payment.processor_ref || r.data.payment.id})`)
//       // После успешной оплаты — закрываем
//       await close()
//     } catch (e: any) {
//       const msg = e?.response?.data?.error || e?.message || 'Ошибка'
//       setError(String(msg))
//     } finally {
//       setLoading(false)
//     }
//   }

//   const doPayOnly = async () => {
//     if (!found?.id) return
//     setError('')
//     setLoading(true)
//     try {
//       const due = await quoteDue(found.id)
//       const r = await api.post(`/ai/sessions/${found.id}/payments`, {
//         method: 'card',
//         amount_cents: due,
//         approved: true,
//       })
//       setStatus(`Оплачен (без закрытия) — ${due/100} MDL`)
//       // обновим found, чтобы статус стал "paid"
//       setFound({ ...found, status: 'paid', amount_paid_cents: due })
//       setAmountCents(null)
//     } catch (e: any) {
//       const msg = e?.response?.data?.error || e?.message || 'Ошибка'
//       setError(String(msg))
//     } finally {
//       setLoading(false)
//     }
//   }

//   const canPay = !!found && found.status === 'active'
//   const canStart = !found

//   return (
//     <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
//       {confirmOpen && (
//         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
//           <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 w-full max-w-sm">
//             <h4 className="text-lg font-semibold mb-2">Подтверждение оплаты</h4>
//             <p className="mb-4 text-sm">
//               Списать {(amountCents || 0) / 100} MDL за парковку?
//             </p>
//             <div className="flex justify-end gap-2">
//               <button
//                 className="px-3 py-2 rounded-md bg-gray-200 dark:bg-gray-700"
//                 onClick={() => setConfirmOpen(false)}
//               >
//                 Отмена
//               </button>
//               <button
//                 className="px-3 py-2 rounded-md bg-emerald-600 text-white"
//                 onClick={() => { setConfirmOpen(false); doPay(); }}
//               >
//                 Оплатить
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       <div className="mb-3">
//         <label className="block text-sm font-medium mb-1">Номер авто</label>
//         <input
//           className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
//           value={vehicle}
//           // onChange={e => onVehicleChange(e.target.value)}
//           placeholder="Например: ABC123"
//           disabled={loading}
//         />
//       </div>

//       <div className="flex flex-wrap gap-2">
//         <button
//           className="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
//           onClick={start}
//           disabled={loading || !canStart || !defaultZoneId}
//         >
//           Пустить на парковку
//         </button>

//         <button
//           className="px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50"
//           onClick={preparePay}
//           disabled={loading || !canPay}
//         >
//           Оплатить и закрыть
//         </button>
//         <button
//           className="px-3 py-2 rounded-md bg-teal-600 text-white disabled:opacity-50"
//           onClick={doPayOnly}
//           disabled={loading || !canPay}
//         >
//     Оплатить (без закрытия)
//   </button>
//       </div>

//       <div className="mt-3 text-sm">
//         {error
//           ? <span className="text-red-600">{error}</span>
//           : <span>Статус: {status || (found ? `Билет #${found.id} (${found.status})` : '—')}</span>}
//         {!defaultZoneId && (
//           <div className="text-xs text-amber-600 mt-1">
//             Нет доступных зон — создание билета недоступно
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }


import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

type Zone = { id: number; name: string }

type Props = {
  zones: Zone[]
  vehicle: string
  onVehicleChange: (v: string) => void
}

export default function ZonePicker({ zones, vehicle, onVehicleChange }: Props) {
  const [found, setFound] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [amountCents, setAmountCents] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const defaultZoneId = useMemo(() => zones?.[0]?.id ?? null, [zones])

  // поиск билета
  useEffect(() => {
    const raw = vehicle || ''
    if (!raw) {
      setFound(null)
      setStatus('')
      setAmountCents(null)
      return
    }
    if (raw.length < 4) return

    const v = raw.trim().toUpperCase()
    setError('')
    setStatus('')
    setAmountCents(null)

    const id = setTimeout(async () => {
      try {
        const r = await api.get('/ai/sessions/search', { params: { vehicle: v } })
        setFound(r.data)
        setStatus(`Найден билет #${r.data.id} (${r.data.status})`)
      } catch {
        setFound(null)
        setStatus('Не найдено активного билета')
      }
    }, 400)

    return () => clearTimeout(id)
  }, [vehicle])

  const start = async () => {
    setError('')
    setLoading(true)
    try {
      const plate = (vehicle || '').trim().toUpperCase()
      if (!plate || plate.length < 4) { setError('Укажите корректный номер авто'); return }
      if (!defaultZoneId) { setError('Нет доступных зон'); return }
      const r = await api.post('/ai/sessions/start', { zone_id: defaultZoneId, vehicle_plate: plate })
      setFound(r.data)
      setStatus(`Открыт билет #${r.data.id}`)
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка'
      setError(String(msg))
    } finally {
      setLoading(false)
    }
  }

  const quoteDue = async (sessionId: number): Promise<number> => {
    try {
      const r = await api.post(`/ai/sessions/${sessionId}/close`, { preview: true }, { params: { preview: 1 } })
      return Number(r.data?.amount_due_cents ?? 0)
    } catch {
      try {
        const r = await api.get(`/ai/sessions/${sessionId}/quote`)
        return Number(r.data?.amount_due_cents ?? 0)
      } catch {
        return Number(found?.amount_due_cents ?? 0)
      }
    }
  }

  const close = async () => {
    if (!found?.id) return
    try {
      const r = await api.post(`/ai/sessions/${found.id}/close`)
      setStatus(`Билет #${r.data.id} закрыт (${r.data.status})`)
      setFound(null)
      setAmountCents(null)
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка'
      setError(String(msg))
    }
  }

  const preparePay = async () => {
    if (!found?.id) return
    setError('')
    setLoading(true)
    try {
      const due = await quoteDue(found.id)
      if (due <= 0) {
        setLoading(false)
        setStatus('Бесплатно: оплата не требуется')
        await close()
        return
      }
      setAmountCents(due)
      setConfirmOpen(true)
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка'
      setError(String(msg))
    } finally {
      setLoading(false)
    }
  }

  const doPay = async () => {
    if (!found?.id || amountCents == null) return
    setError('')
    setLoading(true)
    try {
      const r = await api.post(`/ai/sessions/${found.id}/payments`, {
        method: 'card',
        amount_cents: amountCents,
        approved: true,
      })
      setStatus(`Оплачен (${r.data.payment.processor_ref || r.data.payment.id})`)
      await close()
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка'
      setError(String(msg))
    } finally {
      setLoading(false)
    }
  }

  const doPayOnly = async () => {
    if (!found?.id) return
    setError('')
    setLoading(true)
    try {
      const due = await quoteDue(found.id)
      await api.post(`/ai/sessions/${found.id}/payments`, {
        method: 'card',
        amount_cents: due,
        approved: true,
      })
      setStatus(`Оплачен (без закрытия) — ${due/100} MDL`)
      setFound({ ...found, status: 'paid', amount_paid_cents: due })
      setAmountCents(null)
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка'
      setError(String(msg))
    } finally {
      setLoading(false)
    }
  }

  const canPay = !!found && found.status === 'active'
  const canStart = !found

  return (
    <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 w-full max-w-sm">
            <h4 className="text-lg font-semibold mb-2">Подтверждение оплаты</h4>
            <p className="mb-4 text-sm">
              Списать {(amountCents || 0) / 100} MDL за парковку?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded-md bg-gray-200 dark:bg-gray-700"
                onClick={() => setConfirmOpen(false)}
              >
                Отмена
              </button>
              <button
                className="px-3 py-2 rounded-md bg-emerald-600 text-white"
                onClick={() => { setConfirmOpen(false); doPay(); }}
              >
                Оплатить
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Номер авто</label>
        <input
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={vehicle}
          onChange={e => onVehicleChange(e.target.value)}  // сохраняем как есть, без trim()
          placeholder="Например: ABC123"
          disabled={loading}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
          onClick={start}
          disabled={loading || !canStart || !defaultZoneId}
        >
          Пустить на парковку
        </button>

        <button
          className="px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50"
          onClick={preparePay}
          disabled={loading || !canPay}
        >
          Оплатить и закрыть
        </button>

        <button
          className="px-3 py-2 rounded-md bg-teal-600 text-white disabled:opacity-50"
          onClick={doPayOnly}
          disabled={loading || !canPay}
        >
          Оплатить (без закрытия)
        </button>
      </div>

      <div className="mt-3 text-sm">
        {error
          ? <span className="text-red-600">{error}</span>
          : <span>Статус: {status || (found ? `Билет #${found.id} (${found.status})` : '—')}</span>}
        {!defaultZoneId && (
          <div className="text-xs text-amber-600 mt-1">
            Нет доступных зон — создание билета недоступно
          </div>
        )}
      </div>
    </div>
  )
}
