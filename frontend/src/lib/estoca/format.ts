const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const integer = new Intl.NumberFormat("pt-BR")
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 })
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})
const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" })
const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" })

export const formatBRL = (value: number) => brl.format(value)
export const formatInt = (value: number) => integer.format(value)
export const formatPercent = (value: number) => percent.format(value)
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
export const formatDayMonth = (iso: string | number) => dayMonth.format(new Date(iso)).replace(".", "")
export const formatTime = (iso: string) => time.format(new Date(iso))

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
}

export function formatRelative(iso: string, now = Date.now()) {
  const diff = new Date(iso).getTime() - now
  const minutes = Math.round(diff / 60_000)
  if (Math.abs(minutes) < 1) return "agora"
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, "hour")
  return relative.format(Math.round(hours / 24), "day")
}

/** The session UUID, short enough for the status bar: "ACA0-D340". */
export function formatSandboxId(id: string) {
  const raw = id.replace(/-/g, "").toUpperCase()
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`
}

export function pluralize(count: number, one: string, many: string) {
  return `${formatInt(count)} ${count === 1 ? one : many}`
}

/** "1.234,50" -> 1234.5; "49,90" and the API's "49.90" -> 49.9 */
export function parseBRL(input: string): number | null {
  let cleaned = input.replace(/[^\d,.-]/g, "")
  if (cleaned.includes(",")) {
    // pt-BR: dots group thousands, the comma is the decimal mark.
    cleaned = cleaned.replace(/\./g, "").replace(",", ".")
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // Only thousand groups, as in "1.234".
    cleaned = cleaned.replace(/\./g, "")
  }
  if (!cleaned) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}
