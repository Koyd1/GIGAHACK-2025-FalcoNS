type Zone = { id: number; name: string }

export default function Zones({ zones }: { zones: Zone[] }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Зоны</h3>
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {zones.map(z => (
          <li key={z.id} className="py-2">{z.name}</li>
        ))}
      </ul>
    </div>
  )
}
