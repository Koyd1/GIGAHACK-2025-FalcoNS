type Zone = { id: number; name: string }

export default function ZonePicker({ zones, value, onChange }: { zones: Zone[]; value: number | null; onChange: (id: number) => void }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">Зона</label>
      <select
        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value ?? ''}
        onChange={e => onChange(Number(e.target.value))}
      >
        <option value="" disabled>Выберите зону</option>
        {zones.map(z => (<option key={z.id} value={z.id}>{z.name}</option>))}
      </select>
    </div>
  )
}
