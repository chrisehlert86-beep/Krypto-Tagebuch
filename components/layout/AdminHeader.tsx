import LogoutButton from './LogoutButton'

export default function AdminHeader() {

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <header className="flex min-h-20 items-center justify-between gap-3 border-b border-gray-300 bg-white px-4 py-3 sm:px-6 lg:px-10">

      <div>

        <h2 className="text-lg font-bold text-black sm:text-2xl">
          Adminbereich
        </h2>

        <p className="text-xs text-gray-700 sm:text-base sm:text-black">
          {today}
        </p>

      </div>

      <LogoutButton />

    </header>
  )
}
