"use client";

import { SocketProvider } from "@/lib/socket-context";

export default function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { roomId: string };
}) {
  return <SocketProvider roomId={params.roomId}>{children}</SocketProvider>;
}
