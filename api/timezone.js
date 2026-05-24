export function getISTDateStringYYYYMMDD(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [{ value: month },,{ value: day },,{ value: year }] = formatter.formatToParts(date);
  return `${year}-${month}-${day}`;
}

export function getISTISOString(date = new Date()) {
  const tzOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + tzOffset);
  return istDate.toISOString().replace('Z', '+05:30');
}

export function getISTLogPrefix() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return `[${formatter.format(now)} IST]`;
}
