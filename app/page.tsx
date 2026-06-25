'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [inviteCode, setInviteCode] = useState('')
  const [message, setMessage] = useState('')

  async function checkInvite() {
    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .eq('invite_code', inviteCode.trim())
      .eq('active', true)
      .eq('used', false)
      .maybeSingle()

console.log("DATA:", data)
console.log("ERROR:", error)

    if (error) {
  console.log('SUPABASE ERROR:', error)
  setMessage('Fehler: ' + error.message)
  return
}

if (!data) {
  setMessage('Kein Datensatz gefunden')
  return
}

    setMessage('Einladungscode gültig')
  }

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
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          className="w-full border rounded p-3 mb-4"
          placeholder="Code eingeben"
        />

        <button
          onClick={checkInvite}
          className="w-full bg-black text-white p-3 rounded"
        >
          Weiter
        </button>

        {message && (
          <p className="mt-4 text-center">
            {message}
          </p>
        )}
      </div>
    </main>
  )
}