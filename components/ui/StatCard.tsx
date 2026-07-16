type StatCardProps = {
  title: string
  value?: number

  primaryValue?: number
  secondaryValue?: number

  primaryLabel?: string
  secondaryLabel?: string

  color?: 'green' | 'blue' | 'yellow' | 'purple'
}

export default function StatCard({
  title,
  value,
  primaryValue,
  secondaryValue,
  primaryLabel,
  secondaryLabel,
  color = 'blue',
}: StatCardProps) {
  const colors = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    yellow: 'text-yellow-600',
    purple: 'text-purple-700',
  }

  return (
    <div className="flex min-h-44 flex-col rounded-xl border border-gray-300 bg-white p-5 shadow-md sm:h-52 sm:p-8">

      <p className="text-sm font-semibold uppercase tracking-wide text-black">
        {title}
      </p>

      <div className="flex flex-1 items-center">

        {value !== undefined ? (

          <h2 className={`text-5xl font-bold sm:text-6xl ${colors[color]}`}>
            {value}
          </h2>

        ) : (

          <div className="w-full">

            <div className={`grid grid-cols-2 gap-3 text-center sm:gap-8 ${colors[color]}`}>

              <div>
                <div className="text-2xl font-bold sm:text-4xl">
                  {primaryValue} Stk
                </div>

                <div className="mt-2 text-base font-medium text-gray-500">
                  {primaryLabel}
                </div>
              </div>

              <div>
                <div className="text-2xl font-bold sm:text-4xl">
                  {secondaryValue} Stk
                </div>

                <div className="mt-2 text-base font-medium text-gray-500">
                  {secondaryLabel}
                </div>
              </div>

            </div>

          </div>

        )}

      </div>

    </div>
  )
}
