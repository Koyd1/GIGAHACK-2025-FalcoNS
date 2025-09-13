import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

type ChatMsg = { role: 'user' | 'assistant' | 'system'; text: string }

export default function AIExit() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'system', text: 'AI‑Exit: помогу закрыть сессию и выехать. Сообщите номер авто, зону или ticketId.' }
  ])
  const [input, setInput] = useState('')
  const [vehicle, setVehicle] = useState<string>('')
  const [lang, setLang] = useState<string>(navigator.language || 'ru-RU')
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight })
  }, [messages])

  const send = async (text?: string) => {
    const t = (text ?? input).trim()
    if (!t || busy) return
    setBusy(true)
    setMessages(m => [...m, { role: 'user', text: t }])
    setInput('')
    try {
      // Extract via server LLM (Gemini) + fallback
      let v = vehicle
      let has_ticket: boolean | undefined = undefined
      let phone: string | undefined = undefined
      try {
        const u = await api.post('/ai/exit/understand', { text: t, lang })
        const data = u.data || {}
        if (data.vehicle) { v = data.vehicle; setVehicle(data.vehicle) }
        if (typeof data.has_ticket === 'boolean') has_ticket = data.has_ticket
        if (data.phone) phone = data.phone
      } catch {}
      try {
        if (!v) {
          const raw = t.toUpperCase().replace(/\s|-/g, '')
          const m = raw.match(/[A-ZА-Я]{1}[0-9]{3}[A-ZА-Я]{2}[0-9]{0,3}/)
          if (m && m[0].length >= 6) { v = m[0]; setVehicle(m[0]) }
        }
      } catch {}
      if (!v) {
        setMessages(m => [...m, { role: 'assistant', text: 'Введите номер машины' }])
        return
      }
      if (!phone) {
        const pm = t.replace(/[^0-9]/g,'').match(/(\d{9})/)
        if (pm) phone = pm[1]
      }
      const r = await api.post('/ai/exit/decision', { vehicle: v, has_ticket, phone })
      const reply = r.data?.message || r.data?.reply || '…'
      setMessages(m => [...m, { role: 'assistant', text: String(reply) }])
    } catch (e: any) {
      const err = e?.response?.data?.reply || e?.response?.data?.error || e?.message || 'Ошибка'
      setMessages(m => [...m, { role: 'assistant', text: `Ошибка: ${String(err)}` }])
    } finally {
      setBusy(false)
    }
  }

  const startVoice = () => {
    // Web Speech API (Chrome/Safari). Graceful fallback if unavailable.
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setMessages(m => [...m, { role: 'system', text: 'Голосовой ввод недоступен в этом браузере' }])
      return
    }
    try {
      const rec = new SR()
      rec.lang = (lang || 'ru-RU')
      rec.interimResults = false
      rec.maxAlternatives = 1
      rec.onresult = (ev: any) => {
        const tx: string = ev.results?.[0]?.[0]?.transcript || ''
        if (tx) send(tx)
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
    <div className="flex flex-col h-[480px]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold">AI‑Exit</h3>
          <p className="text-xs text-gray-500">Чат‑помощник для закрытия билета и выезда</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="text-sm border rounded px-2 py-1 dark:bg-gray-800" value={lang} onChange={e=>setLang(e.target.value)}>
            <option value="ru-RU">Русский</option>
            <option value="ro-RO">Română</option>
            <option value="en-US">English</option>
          </select>
        </div>
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto rounded border dark:border-gray-700 p-3 space-y-3 bg-white/60 dark:bg-gray-900/40">
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[85%] ${m.role==='user' ? 'ml-auto text-right' : ''}`}>
            <div className={`inline-block px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
              m.role==='user' ? 'bg-blue-600 text-white' : m.role==='assistant' ? 'bg-gray-100 dark:bg-gray-800' : 'bg-amber-50 dark:bg-amber-900/20'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {messages.length === 0 && <div className="text-sm text-gray-500">Нет сообщений</div>}
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
          placeholder="Например: Закрыть билет 12345 и оплатить"
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
