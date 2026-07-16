import AdminContainer from '@/components/layout/AdminContainer'
import AdminHeader from '@/components/layout/AdminHeader'
import AdminSidebar from '@/components/layout/AdminSidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-gray-100 lg:flex-row">

      <AdminSidebar />

      <div className="flex min-w-0 flex-1 flex-col">

        <AdminHeader />

        <AdminContainer>
          {children}
        </AdminContainer>

      </div>

    </div>
  )
}
