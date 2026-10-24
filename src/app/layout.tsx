import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'LingoMetric | Know Your English Level',
  description: 'AI-powered English proficiency testing across Reading, Listening, Writing, and Speaking with transparent CEFR-aligned diagnostic scoring.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans antialiased">
        {children}
        <Toaster theme="dark" closeButton />
      </body>
    </html>
  )
}
