const timeZone = "Asia/Bangkok";

function parts(date: Date) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map((part) => [part.type, part.value]));
}

export function sessionSlipTimes(openedAt: Date, startedAt: Date | null, endsAt: Date | null) {
  const date = parts(startedAt ?? openedAt);
  const formatTime = (value: Date | null) => {
    if (!value) return "ยังไม่เริ่ม";
    const time = parts(value);
    return `${time.hour}:${time.minute}:${time.second}`;
  };
  return {
    date: `${date.day}-${date.month}-${date.year}`,
    startedAt: formatTime(startedAt),
    endsAt: formatTime(endsAt),
  };
}
