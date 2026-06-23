import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TradesCoverLetter.com – AI Cover Letters for Skilled Trades',
  description: 'Generate a professional cover letter in 60 seconds. Built for electricians, plumbers, HVAC techs, welders, and all skilled trades workers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stone-950 text-white antialiased">{children}</body>
    </html>
  )
}
