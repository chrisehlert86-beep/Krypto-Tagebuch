type CardProps = {
  children: React.ReactNode
}

export default function Card({ children }: CardProps) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-gray-300 bg-white p-4 shadow-md sm:p-6 lg:p-8">
      {children}
    </div>
  )
}
