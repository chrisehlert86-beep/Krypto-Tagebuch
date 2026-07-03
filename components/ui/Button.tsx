type ButtonProps = {
  children: React.ReactNode
  onClick?: () => void
  color?: 'green' | 'red' | 'blue'
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
        text-white
        shadow-sm
        transition
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${colors[color]}
      `}
    >
      {children}
    </button>
  )
}