type AdminContainerProps = {
  children: React.ReactNode
}

export default function AdminContainer({
  children,
}: AdminContainerProps) {
  return (
    <main className="flex-1 p-10">
      {children}
    </main>
  )
}