type BadgeProps = {
  status: string
}

export default function Badge({ status }: BadgeProps) {

  const config = {
    pending: {
      text: 'Ausstehend',
      className: 'bg-yellow-200 text-black',
    },

    approved: {
      text: 'Freigegeben',
      className: 'bg-green-200 text-black',
    },

    rejected: {
      text: 'Abgelehnt',
      className: 'bg-red-200 text-black',
    },
  }

  const badge =
    config[status as keyof typeof config] ?? {
      text: status,
      className: 'bg-gray-200 text-black',
    }

  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-semibold ${badge.className}`}
    >
      {badge.text}
    </span>
  )
}