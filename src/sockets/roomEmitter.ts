import { Server } from "socket.io";

let ioInstance: Server | null = null;

export function setSocketServer(io: Server) {
  ioInstance = io;
}

export function emitToDealRoom(dealId: number, event: string, payload: unknown) {
  if (!ioInstance) {
    console.warn("Socket server not initialized. Skipping emit:", event, dealId);
    return;
  }

  ioInstance.to(`deal-${dealId}`).emit(event, payload);
}
