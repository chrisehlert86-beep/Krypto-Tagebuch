type BadgeProps = {
  status: string
}

export default function Badge({ status }: BadgeProps) {

  const config = {
    pending: {
      text: 'Ausstehend',
      className: 'bg-yellow-200 text-yellow-900',
    },

    approved: {
      text: 'Freigegeben',
      className: 'bg-blue-200 text-blue-900',
    },

    active: {
      text: 'Mitglied',
      className: 'bg-green-200 text-green-900',
    },

    rejected: {
      text: 'Abgelehnt',
      className: 'bg-red-200 text-red-900',
    },
  }

  const badge =
    config[status as keyof typeof config] ?? {
      text: status,
      className: 'bg-gray-200 text-gray-900',
    }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${badge.className}`}
    >
      {badge.text}
    </span>
  )
}