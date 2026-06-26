export default function SuccessPage() {
  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">
        Vielen Dank
      </h1>

      <p className="mb-4">
        Ihre Anfrage wurde erfolgreich übermittelt.
      </p>

      <p className="mb-4">
        Bitte stellen Sie nun eine Beitrittsanfrage
        in der Telegram-Gruppe.
      </p>

      <a
        href="https://t.me/DEINE_GRUPPE"
        target="_blank"
        className="inline-block bg-black text-white px-6 py-3 rounded"
      >
        Telegram-Gruppe öffnen
      </a>
    </main>
  )
}