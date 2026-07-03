type StatCardProps = {
  title: string
  value: number
  color?: 'green' | 'blue' | 'yellow' | 'purple'
}

export default function StatCard({
  title,
  value,
  color = 'blue',
}: StatCardProps) {
  const colors = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    yellow: 'text-yellow-600',
	purple: 'bg-purple-100 text-purple-700',
  }

  return (
    <div className="rounded-xl border border-gray-300 bg-white p-8 shadow-md">

      <p className="text-sm font-semibold uppercase tracking-wide text-black">
        {title}
      </p>

      <h2 className={`mt-4 text-5xl font-bold ${colors[color]}`}>
        {value}
      </h2>

    </div>
  )
}