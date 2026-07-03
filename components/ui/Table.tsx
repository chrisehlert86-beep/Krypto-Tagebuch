type TableProps = {
  children: React.ReactNode
}

export default function Table({
  children,
}: TableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white shadow-md">

      <table className="min-w-full">

        {children}

      </table>

    </div>
  )
}