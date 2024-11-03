'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export function NavLinks() {
    const pathname = usePathname()

    return (
        <nav>
            <Link className={`link ${pathname === '/' ? 'active' : ''}`} href="/">
                Home
            </Link>

            <Link
                className={`link ${pathname === '/register' ? 'active' : ''}`}
                href="/register"
            >
                About
            </Link>
        </nav>
    )
}