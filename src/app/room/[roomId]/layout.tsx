'use client'

import { SocketProvider } from '@/lib/socket-context'

export default function RoomLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SocketProvider>{children}</SocketProvider>
}