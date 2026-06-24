export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Krypto-Tagebuch
        </h1>

        <label className="block mb-2">
          Einladungscode
        </label>

        <input
          type="text"
          className="w-full border rounded p-3 mb-4"
          placeholder="Code eingeben"
        />

        <button className="w-full bg-black text-white p-3 rounded">
          Weiter
        </button>
      </div>
    </main>
  );
}