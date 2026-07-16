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
    <aside className="w-full shrink-0 bg-slate-900 text-white lg:min-h-screen lg:w-72">

      <div className="border-b border-slate-700 px-4 py-4 sm:px-6 lg:p-8">

        <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">
          Krypto-Tagebuch
        </h1>

        <p className="mt-1 text-sm text-slate-300 lg:mt-2 lg:text-base lg:text-white">
          Administration
        </p>

      </div>

      <nav className="overflow-x-auto p-3 lg:p-4">

        <ul className="flex min-w-max gap-2 lg:block lg:min-w-0 lg:space-y-2">

          {links.map((link) => {

            const active = pathname === link.href

            return (

              <li key={link.href}>

                <Link
                  href={link.href}
                  className={`block whitespace-nowrap rounded-lg px-4 py-2.5 text-sm transition sm:text-base lg:py-3 ${
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
