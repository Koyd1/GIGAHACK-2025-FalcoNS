import { useEffect, useState } from 'react'
import { api } from './api'
import Zones from './components/Zones'
import Tariffs from './components/Tariffs'
import Vouchers from './components/Vouchers'
import DiscountRules from './components/DiscountRules'
import Reports from './components/Reports'
import Incidents from './components/Incidents'
import Sessions from './components/Sessions'
import ThemeToggle from './components/ThemeToggle'

type Zone = { id: number; name: string }

export default function App() {
  const [zones, setZones] = useState<Zone[]>([])

  useEffect(() => {
    api.get('/ai/zones').then(r => setZones(r.data)).catch(() => setZones([]))
  }, [])

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Smart Parking — Админ</h1>
            <p className="text-sm text-white/80 mt-1">Мониторинг, отчёты, тарифы и ваучеры (AI)</p>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 -mt-6 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4">
            <Zones zones={zones} />
          </div>
          <div className="md:col-span-2 bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4">
            <Tariffs />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 mt-4">
          <Reports />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4">
            <Vouchers />
          </div>
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4">
            <DiscountRules />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 mt-4">
          <Incidents />
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 mt-4">
          <Sessions />
        </div>
      </main>
    </div>
  )
}
