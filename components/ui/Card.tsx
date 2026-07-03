type CardProps = {
  children: React.ReactNode
}

export default function Card({ children }: CardProps) {
  return (
    <div className="rounded-xl border border-gray-300 bg-white p-8 shadow-md">
      {children}
    </div>
  )
}