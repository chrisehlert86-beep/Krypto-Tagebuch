type AdminContainerProps = {
  children: React.ReactNode
}

export default function AdminContainer({
  children,
}: AdminContainerProps) {
  return (
    <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-10">
      {children}
    </main>
  )
}
