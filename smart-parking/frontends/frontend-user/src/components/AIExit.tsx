
import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

type ChatMsg = { role: 'user'|'assistant'|'system'; text: string }

export default function AIExit({ zoneId, vehicle, onVehicleChange }: { zoneId?: number; vehicle: string; onVehicleChange: (v: string)=>void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'system', text: 'AI-Exit: помогу выехать. Напишите номер авто, зону или ticketId.' }
  ])
  const [expectTicketAnswer, setExpectTicketAnswer] = useState(false)
  const [expectVehicleInput, setExpectVehicleInput] = useState(false)
  const [hasTicket, setHasTicket] = useState<boolean | undefined>(undefined)
  const [input, setInput] = useState('')
  const [lang, setLang] = useState<string>('ru-RU')
  const [busy, setBusy] = useState(false)
  const lastDecisionRef = useRef<string | null>(null)
  const [listening, setListening] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const send = async (text?: string) => {
    const t = (text ?? input).trim()
    if (!t || busy) return
    setBusy(true)
    setMessages(m => [...m, { role: 'user', text: t }])
    setInput('')

    // --- обработка ответа Да/Нет про талон ---
    if (expectTicketAnswer) {
      const lower = t.toLowerCase()
      if (['да','yes','y'].includes(lower)) {
        setHasTicket(true)
        setMessages(m => [...m, { role: 'assistant', text: 'Хорошо, введите номер талона' }])
        setExpectTicketAnswer(false)
        setBusy(false)
        return
      }
      if (['нет','no','n'].includes(lower)) {
        setHasTicket(false)
        setMessages(m => [...m, { role: 'assistant', text: 'Введите номер машины' }])
        setExpectTicketAnswer(false)
        setExpectVehicleInput(true)   // ⬅ ждём номер
        setBusy(false)
        return
      }
      setMessages(m => [...m, { role: 'assistant', text: 'Пожалуйста, ответьте Да или Нет' }])
      setBusy(false)
      return
    }

    // --- обработка ввода номера авто ---
    if (expectVehicleInput) {
      const raw = t.toUpperCase().replace(/\s|-/g, '')
      const m = raw.match(/[A-ZА-Я]{1}[0-9]{3}[A-ZА-Я]{2}[0-9]{0,3}/)
      if (m && m[0].length >= 6) {
        onVehicleChange(m[0])
        setExpectVehicleInput(false) // нашли номер, снимаем ожидание
      } else {
        setMessages(m => [...m, { role: 'assistant', text: 'Номерной знак не совпадает. Попробуйте снова (ABC123).' }])
        setBusy(false)
        return
      }
    }

    // --- основной пайплайн обработки ---
    let v = vehicle
    let has_ticket: boolean | undefined = hasTicket
    let phone: string | undefined = undefined

    try {
      const u = await api.post('/ai/exit/understand', { text: t, lang })
      const data = u.data || {}
      if (data.vehicle) { v = data.vehicle; onVehicleChange(data.vehicle) }
      if (typeof data.has_ticket === 'boolean') has_ticket = data.has_ticket
      if (data.phone) phone = data.phone
    } catch {}

    // телефон
    if (!phone) {
      const pm = t.replace(/[^0-9]/g,'').match(/(\d{9})/)
      if (pm) phone = pm[1]
    }

    try {
      if (!v) {
        setMessages(m => [...m, { role: 'assistant', text: 'Извините, ваш номер не распознан. У вас есть талон? (Да/Нет)' }])
        setExpectTicketAnswer(true)
        setBusy(false)
        return
      }

      if (has_ticket === undefined && phone) {
        has_ticket = false
      }

      const r = await api.post('/ai/exit/decision', { vehicle: v, has_ticket, phone })
      const reply = r.data?.message || r.data?.reply || '…'
      if (r.data && typeof r.data.decision === 'string') {
        lastDecisionRef.current = r.data.decision
      }
      setMessages(m => [...m, { role: 'assistant', text: String(reply) }])
    } catch (e: any) {
      const msg = e?.response?.data?.reply || e?.response?.data?.error || e?.message || 'Ошибка'
      setMessages(m => [...m, { role: 'assistant', text: String(msg) }])
    } finally {
      setBusy(false)
    }
  }

  const startVoice = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setMessages(m => [...m, { role: 'system', text: 'Голосовой ввод не поддерживается' }])
      return
    }
    try {
      const rec = new SR()
      rec.lang = lang
      rec.interimResults = false
      rec.maxAlternatives = 1
      // rec.onresult = (ev: any) => {
      //   const tx: string = ev.results?.[0]?.[0]?.transcript || ''
      //   if (tx) send(tx)
      // }
      rec.onresult = (ev: any) => {
        let tx: string = ev.results?.[0]?.[0]?.transcript || ''
        if (tx) {
          // Убираем пробелы и дефисы для номеров формата "G 123 TY"
          const raw = tx.toUpperCase().replace(/\s|-/g, '')

          // Проверка по шаблону госномера: буква + цифры + буквы + опционально цифры
          const m = raw.match(/[A-ZА-Я]{1}[0-9]{3}[A-ZА-Я]{2}[0-9]{0,3}/)

          if (m && m[0].length >= 6) {
            // Если это похоже на номер авто — отправляем склеенный вариант
            send(m[0])
          } else {
            // Иначе отправляем как есть (обычный текст)
            send(tx)
          }
        }
    }

      rec.onend = () => setListening(false)
      rec.onerror = () => setListening(false)
      setListening(true)
      rec.start()
    } catch {
      setListening(false)
      setMessages(m => [...m, { role: 'system', text: 'Не удалось запустить распознавание речи' }])
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">AI-Exit</h3>
        <select className="text-sm border rounded px-2 py-1 dark:bg-gray-800" value={lang} onChange={e=>setLang(e.target.value)}>
          <option value="ru-RU">Русский</option>
          <option value="ro-RO">Română</option>
          <option value="en-US">English</option>
        </select>
      </div>
      <div ref={scrollRef} className="h-48 overflow-y-auto rounded border dark:border-gray-700 p-3 space-y-3 bg-white/60 dark:bg-gray-900/40">
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[85%] ${m.role==='user' ? 'ml-auto text-right' : ''}`}>
            <div className={`inline-block px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
              m.role==='user' ? 'bg-blue-600 text-white'
              : m.role==='assistant' ? 'bg-gray-100 dark:bg-gray-800'
              : 'bg-amber-50 dark:bg-amber-900/20'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          className={`px-3 py-2 rounded-md border dark:border-gray-700 ${listening ? 'bg-amber-500 text-white' : 'bg-gray-50 dark:bg-gray-800'}`}
          onClick={startVoice}
          title="Голосовой ввод"
        >
          {listening ? 'Слушаю…' : '🎙️'}
        </button>
        <input
          className="flex-1 px-3 py-2 rounded-md border dark:border-gray-700 dark:bg-gray-800"
          placeholder="Например: Хочу выехать, номер ABC123"
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if (e.key==='Enter') send() }}
          disabled={busy}
        />
        <button
          className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
          onClick={()=>send()}
          disabled={busy || !input.trim()}
        >
          Отправить
        </button>
      </div>
    </div>
  )
}










