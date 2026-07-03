type TableHeadProps = {
  children: React.ReactNode
}

export default function TableHead({
  children,
}: TableHeadProps) {
  return (
    <thead className="bg-gray-200">

      {children}

    </thead>
  )
}