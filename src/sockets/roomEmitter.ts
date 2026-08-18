import { Server } from "socket.io";

let ioInstance: Server | null = null;

export function setSocketServer(io: Server) {
  ioInstance = io;
}

export function emitToDealRoom(dealId: number, event: string, payload: unknown): void {
  if (!ioInstance) {
    console.warn("Socket server not initialized. Skipping emit:", event, dealId);
    return;
  }

  ioInstance.to(`deal-${dealId}`).emit(event, payload);
}

export function emitToUser(userId: number, event: string, payload: unknown): void {
  if (!ioInstance) {
    console.warn("Socket server not initialized. Skipping emit:", event, userId);
    return;
  }

  ioInstance.to(`user-${userId}`).emit(event, payload);
}
