type TableCellProps = {
  children: React.ReactNode
  header?: boolean
  align?: 'left' | 'center' | 'right'
}

export default function TableCell({
  children,
  header = false,
  align = 'left',
}: TableCellProps) {
  const Tag = header ? 'th' : 'td'

  const alignment = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }

  return (
    <Tag
      className={`
        px-6
        py-4
        border-b
        border-gray-300
        text-black
        ${alignment[align]}
        ${header ? 'font-bold bg-gray-200' : ''}
      `}
    >
      {children}
    </Tag>
  )
}