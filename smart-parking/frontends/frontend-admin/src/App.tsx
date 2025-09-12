import { useEffect, useState } from 'react'
import { api } from './api'
import Zones from './components/Zones'
import Rates from './components/Rates'
import Reports from './components/Reports'
import Incidents from './components/Incidents'
import Sessions from './components/Sessions'

type Zone = { id: number; name: string }

export default function App() {
  const [zones, setZones] = useState<Zone[]>([])

  useEffect(() => {
    api.get('/zones').then(r => setZones(r.data)).catch(() => setZones([]))
  }, [])

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-4">Smart Parking — Админ</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <Zones zones={zones} />
          </div>
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <Rates zones={zones} />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mt-4">
          <Reports />
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mt-4">
          <Incidents />
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mt-4">
          <Sessions />
        </div>
      </div>
    </div>
  )
}
