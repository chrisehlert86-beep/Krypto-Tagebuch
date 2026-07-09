type ButtonProps = {
  children: React.ReactNode
  onClick?: () => void
  color?: 'green' | 'red' | 'blue' | 'yellow'
  disabled?: boolean
}

export default function Button({
  children,
  onClick,
  color = 'blue',
  disabled = false,
}: ButtonProps) {
  const colors = {
    blue: 'bg-blue-700 hover:bg-blue-800',
    green: 'bg-green-700 hover:bg-green-800',
    red: 'bg-red-700 hover:bg-red-800',
    yellow: 'bg-yellow-500 hover:bg-yellow-600 text-black',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        rounded-lg
        px-5
        py-2.5
        font-semibold
        shadow-sm
        transition
        disabled:cursor-not-allowed
        disabled:opacity-50
        ${colors[color]}
      `}
    >
      {children}
    </button>
  )
}