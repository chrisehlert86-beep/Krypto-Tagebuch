type TableRowProps = {
  children: React.ReactNode
  hover?: boolean
  onClick?: () => void
}

export default function TableRow({
  children,
  hover = false,
  onClick,
}: TableRowProps) {
  return (
    <tr
      onClick={onClick}
      className={`
        border-b border-gray-300
        ${hover ? 'hover:bg-blue-50 cursor-pointer transition' : ''}
      `}
    >
      {children}
    </tr>
  )
}