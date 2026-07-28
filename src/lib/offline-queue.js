const OFFLINE_QUEUE_KEY = "serenity-itinerary-offline-queue";

export function readOfflineQueue() {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function writeOfflineQueue(queue) {
  if (typeof localStorage !== "undefined") localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueCloudTrip(workspaceId, uid, trip) {
  const queue = readOfflineQueue().filter((item) => !(item.workspaceId === workspaceId && item.trip?.id === trip?.id));
  queue.push({ workspaceId, uid, trip });
  writeOfflineQueue(queue);
  return queue.length;
}

export function offlineQueueSize() {
  return readOfflineQueue().length;
}
