import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'

export default function Assistant({ zoneId, vehicle, onVehicleChange }: { zoneId?: number; vehicle: string; onVehicleChange: (v: string) => void }) {
  const [messages, setMessages] = useState<{ from: 'user'|'bot'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [lang, setLang] = useState<'ru-RU'|'en-US'|'ro-RO'>('ru-RU')
  const [voiceName, setVoiceName] = useState<string>('')
  const sessionIdRef = useRef<string>('')
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    synthRef.current = window.speechSynthesis || null
    // session id for slot-filling
    try { sessionIdRef.current = (crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2); } catch { sessionIdRef.current = String(Date.now()) }
    const loadVoices = () => {
      if (!synthRef.current) return
      voicesRef.current = synthRef.current.getVoices()
      // авто выбор подходящего голоса по языку
      const preferred = voicesRef.current.find(v => v.lang === lang) || voicesRef.current.find(v => v.lang.startsWith(lang.split('-')[0]))
      if (preferred) setVoiceName(preferred.name)
    }
    loadVoices()
    if (synthRef.current) synthRef.current.onvoiceschanged = loadVoices
  }, [lang])

  const speak = (text: string) => {
    if (!synthRef.current) return
    const uttr = new SpeechSynthesisUtterance(text)
    uttr.lang = lang
    const v = voicesRef.current.find(v => v.name === voiceName) || voicesRef.current.find(v => v.lang === lang)
    if (v) uttr.voice = v
    synthRef.current.cancel()
    synthRef.current.speak(uttr)
  }

  const send = async (text: string) => {
    if (!text.trim()) return
    setMessages(m => [...m, { from: 'user', text }])
    setInput('')
    // naive RU plate extract: like A123BC or A123BC77
    try {
      const raw = text.toUpperCase().replace(/\s|-/g, '')
      const m = raw.match(/[A-ZА-Я]{2}[0-9]{3}[A-ZА-Я]{2}[0-9]{0,3}/)
      if (m && m[0].length >= 7) onVehicleChange(m[0])
    } catch {}
    try {
      const r = await api.post('/assistant/message', { text, zoneId, vehicle: vehicle || undefined, lang, sessionId: sessionIdRef.current })
      const reply = r.data?.reply || '—'
      setMessages(m => [...m, { from: 'bot', text: reply }])
      speak(reply)
      const data = r.data || {}
      if (data.vehicle) onVehicleChange(String(data.vehicle))
      if (typeof data.ticketId === 'number') {
        if (data.amount !== undefined) {
          window.dispatchEvent(new CustomEvent('ticket:closed', { detail: { ticketId: data.ticketId, amount: data.amount } }))
        } else if (data.paymentId) {
          window.dispatchEvent(new CustomEvent('ticket:paid', { detail: { ticketId: data.ticketId, paymentId: data.paymentId } }))
        } else {
          window.dispatchEvent(new CustomEvent('ticket:opened', { detail: { ticketId: data.ticketId, vehicle: data.vehicle, zoneId: data.zoneId } }))
        }
      }
    } catch (e: any) {
      const msg = e?.response?.data?.reply || e?.response?.data?.error || 'Ошибка, попробуйте ещё раз'
      setMessages(m => [...m, { from: 'bot', text: String(msg) }])
      speak(String(msg))
    }
  }

  const handleVoice = async () => {
    const Rec: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!Rec) {
      setMessages(m => [...m, { from: 'bot', text: 'Голосовой ввод не поддерживается' }])
      return
    }
    const rec = new Rec()
    rec.lang = lang
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript as string
      // quick local plate detection
      try {
        const raw = text.toUpperCase().replace(/\s|-/g, '')
        const m = raw.match(/[A-ZА-Я]{2}[0-9]{3}[A-ZА-Я]{2}[0-9]{0,3}/)
        if (m && m[0].length >= 7) onVehicleChange(m[0])
      } catch {}
      send(text)
    }
    rec.onerror = () => {
      setMessages(m => [...m, { from: 'bot', text: 'Ошибка распознавания' }])
    }
    rec.start()
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">AI-ассистент</h3>
      <div className="flex gap-2 mb-2">
        <select className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" value={lang} onChange={e => setLang(e.target.value as any)}>
          <option value="ru-RU">RU</option>
          <option value="en-US">EN</option>
          <option value="ro-RO">RO</option>
        </select>
        <select className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" value={voiceName} onChange={e => setVoiceName(e.target.value)}>
          {voicesRef.current.filter(v => v.lang.startsWith(lang.split('-')[0])).map(v => (
            <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
          ))}
        </select>
        <input className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1" placeholder="Номер авто (опц.)" value={vehicle} onChange={e => onVehicleChange(e.target.value)} />
      </div>
      <div className="h-40 overflow-auto border border-gray-200 dark:border-gray-700 rounded p-2 text-sm mb-2 bg-white dark:bg-gray-900">
        {messages.length === 0 && <div className="text-gray-500">Спросите: "Начать парковку", "Закрыть", "Оплатить".</div>}
        {messages.map((m, i) => (
          <div key={i} className={m.from === 'user' ? 'text-right' : 'text-left'}>
            <span className={m.from === 'user' ? 'inline-block bg-blue-600 text-white rounded px-2 py-1 my-1' : 'inline-block bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 my-1'}>
              {m.text}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2" value={input} onChange={e => setInput(e.target.value)} placeholder="Напишите сообщение" />
        <button className="px-3 py-2 rounded-md bg-blue-600 text-white" onClick={() => send(input)}>Отправить</button>
        <button className="px-3 py-2 rounded-md bg-emerald-600 text-white" onClick={handleVoice}>🎤 Голос</button>
      </div>
    </div>
  )
}
