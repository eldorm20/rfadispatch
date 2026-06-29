/* Telegram message formatters — reproduce the two RFA dispatch templates:
   - "percent / owners"  → includes Rate + per-mile
   - "cpm company driver" → no rate shown
   Both are sent as plain text (the bold look comes from unicode glyphs). */

const DIV = "—————————————";
const PENALTIES = [
  "❌Late PU: $500",
  "❌Late DEL: $500",
  "❌Proper Relay Usage:$300",
  "❌Restricted Road: $1000",
  "❌Rejection: $1000",
];

function fmtTime(iso, tz) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
      timeZone: tz || "America/New_York", timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toUTCString();
  }
}

function money(n) {
  const x = Number(n) || 0;
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(x) ? 0 : 2, maximumFractionDigits: 2 });
}

function duration(stops) {
  const a = stops?.[0]?.scheduledArrival;
  const b = stops?.[stops.length - 1]?.scheduledArrival;
  if (!a || !b) return "";
  const ms = new Date(b) - new Date(a);
  if (!(ms > 0)) return "";
  const h = Math.round(ms / 3600000);
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function prettyLoadingType(t) {
  const u = (t || "").toUpperCase();
  if (u === "PRELOADED") return "Preloaded";
  if (u === "DROP") return "Drop";
  if (u === "LIVE") return "Live";
  return t ? t[0] + t.slice(1).toLowerCase() : "Drop";
}

export function formatLoadMessage(load, driver) {
  const a = load.amazon || {};
  const stops = a.stops || [];
  const showRate = (driver && driver.payType) === "percent";
  const L = [];

  L.push(`🗺𝗧𝗿𝗶𝗽 𝗜𝗗 : ${a.tourId || load.loadNumber}`);
  L.push("");

  stops.forEach((s, i) => {
    if (i) L.push(DIV);
    L.push(`📍${i + 1}#: ${load.loadNumber}`);
    L.push(`${s.loaded ? "Loaded" : "Empty"} - ${prettyLoadingType(s.loadingType)}`);
    const t = fmtTime(s.scheduledArrival, s.timeZone);
    if (t) L.push(t);
    if (s.label) L.push(` ${s.label}`);
    if (s.line1) L.push(` ${s.line1}`);
    const cityLine = [s.city, s.state].filter(Boolean).join(", ") + (s.postalCode ? ` ${s.postalCode}` : "");
    if (cityLine.trim()) L.push(` ${cityLine}`);
  });

  L.push("");
  if (showRate) {
    L.push(`💰 𝗥𝗮𝘁𝗲: ${money(load.gross)}`);
    if (a.ratePerMile) L.push(` 💰 Per mile: $${a.ratePerMile}/mi`);
    L.push("");
  }

  L.push(`🚛 𝗧𝗿𝗶𝗽: ${load.miles || 0}mi`);
  const dur = duration(stops);
  if (dur) L.push(` 🕒 Duration: ${dur}`);
  L.push(`DH: ${a.deadhead || 0}`);

  L.push("");
  PENALTIES.forEach((p) => L.push(p));

  return L.join("\n");
}
