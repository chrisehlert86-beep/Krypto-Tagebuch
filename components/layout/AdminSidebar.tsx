'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AdminSidebar() {
  const pathname = usePathname()

  const links = [
    {
      href: '/admin',
      label: 'Dashboard',
    },
    {
      href: '/admin/applications',
      label: 'Bewerbungen',
    },
    {
      href: '/admin/members',
      label: 'Mitglieder',
    },
    {
      href: '/admin/invites',
      label: 'Einladungscodes',
    },
    {
      href: '/admin/settings',
      label: 'Einstellungen',
    },
  ]

  return (
    <aside className="w-72 bg-slate-900 text-white">

      <div className="border-b border-slate-700 p-8">

        <h1 className="text-3xl font-bold">
          Krypto-Tagebuch
        </h1>

        <p className="mt-2 text-white">
          Administration
        </p>

      </div>

      <nav className="p-4">

        <ul className="space-y-2">

          {links.map((link) => {

            const active = pathname === link.href

            return (

              <li key={link.href}>

                <Link
                  href={link.href}
                  className={`block rounded-lg px-4 py-3 transition ${
                    active
                      ? 'bg-blue-700 font-bold'
                      : 'hover:bg-slate-800'
                  }`}
                >
                  {link.label}
                </Link>

              </li>

            )

          })}

        </ul>

      </nav>

    </aside>
  )
}