import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '재고관리',
  description: '풀필먼트·팝업까지 추적하는 유통기한 선입선출 재고관리',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#5b21b6',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        <div className="mx-auto min-h-dvh max-w-[560px] bg-white shadow-sm lg:max-w-[960px]">
          {children}
        </div>
      </body>
    </html>
  )
}
