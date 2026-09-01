import type { WASocket } from "@whiskeysockets/baileys";

let activeSocket: WASocket | undefined;
let socketGeneration = 0;
let reconnecting = false;
let rebindInProgress = false;
let shuttingDown = false;

export function getActiveSocket(): WASocket | undefined {
  return activeSocket;
}

export function setActiveSocket(socket: WASocket | undefined): void {
  activeSocket = socket;
}

export function getSocketGeneration(): number {
  return socketGeneration;
}

export function nextSocketGeneration(): number {
  socketGeneration += 1;
  return socketGeneration;
}

export function invalidateSocketGeneration(): number {
  socketGeneration += 1;
  return socketGeneration;
}

export function isCurrentGeneration(generation: number): boolean {
  return generation === socketGeneration;
}

export function isReconnecting(): boolean {
  return reconnecting;
}

export function setReconnecting(value: boolean): void {
  reconnecting = value;
}

export function isRebindInProgress(): boolean {
  return rebindInProgress;
}

export function setRebindInProgress(value: boolean): void {
  rebindInProgress = value;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function setShuttingDown(value: boolean): void {
  shuttingDown = value;
}
