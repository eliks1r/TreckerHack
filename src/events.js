// Small application event bus shared by UI, camera, and pose modules.
const listeners = new Map();

export function on(eventName, handler) {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName).add(handler);

  return () => {
    const handlers = listeners.get(eventName);
    handlers?.delete(handler);
    if (handlers?.size === 0) listeners.delete(eventName);
  };
}

export function emit(eventName, detail) {
  listeners.get(eventName)?.forEach((handler) => handler(detail));
}
