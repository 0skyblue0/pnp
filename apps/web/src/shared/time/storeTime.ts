const STORE_TIME_ZONE = "Asia/Seoul";

export function todayInStoreTime(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function currentStoreDateTime(date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(date)
    .replace(" ", "T");
}

export function formatStoreDateLabel(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day} ${values.weekday}`;
}
