type Zone = { id: number; name: string }

export default function Zones({ zones }: { zones: Zone[] }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">Зоны</h3>
      <div className="flex flex-wrap gap-2">
        {zones.map(z => (
          <span key={z.id} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2" />{z.name}
          </span>
        ))}
        {zones.length === 0 && <span className="text-sm text-gray-500">Нет зон</span>}
      </div>
    </div>
  )
}
