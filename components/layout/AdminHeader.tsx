export default function AdminHeader() {

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <header className="flex h-20 items-center justify-between border-b border-gray-300 bg-white px-10">

      <div>

        <h2 className="text-2xl font-bold text-black">
          Adminbereich
        </h2>

        <p className="text-black">
          {today}
        </p>

      </div>

      <button className="rounded-lg bg-red-700 px-5 py-2 font-semibold text-white hover:bg-red-800">
        Abmelden
      </button>

    </header>
  )
}