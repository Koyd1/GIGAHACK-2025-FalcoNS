import { useEffect, useState } from 'react'
import { api } from './api'
import ZonePicker from './components/ZonePicker'
import TicketFlow from './components/TicketFlow'
import Assistant from './components/assistant/Assistant'

type Zone = { id: number; name: string }

export default function App() {
  const [zones, setZones] = useState<Zone[]>([])
  const [zoneId, setZoneId] = useState<number | null>(null)
  const [vehicle, setVehicle] = useState<string>('')

  useEffect(() => {
    api.get('/ai/zones').then(r => setZones(r.data)).catch(() => setZones([]))
  }, [])

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-4">Smart Parking — Пользователь</h1>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mb-4">
          <ZonePicker zones={zones} value={zoneId} onChange={setZoneId} />
          {zoneId && <TicketFlow zoneId={zoneId} vehicle={vehicle} onVehicleChange={setVehicle} />}
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <Assistant zoneId={zoneId || undefined} vehicle={vehicle} onVehicleChange={setVehicle} />
        </div>
      </div>
    </div>
  )
}
