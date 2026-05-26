// Timezone-safe Indian Standard Time (IST) Helpers shared between client and server

export const getISTDateString = (date = new Date()) => {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    return formatter.format(d); // DD/MM/YYYY
};

export const getISTDateStringYYYYMMDD = (date = new Date()) => {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const [{ value: month },,{ value: day },,{ value: year }] = formatter.formatToParts(d);
    return `${year}-${month}-${day}`; // YYYY-MM-DD
};

export const getISTISOString = (date = new Date()) => {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + tzOffset);
    return istDate.toISOString().replace('Z', '+05:30');
};

export const getISTTimeString = (date = new Date()) => {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false
    });
};

export const getISTLogPrefix = () => {
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
};

export const getISTCalendarDaysDifference = (date1, date2) => {
    const d1Str = getISTDateStringYYYYMMDD(date1);
    const d2Str = getISTDateStringYYYYMMDD(date2);
    const d1 = new Date(d1Str + 'T00:00:00+05:30');
    const d2 = new Date(d2Str + 'T00:00:00+05:30');
    const diffMs = d2.getTime() - d1.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
};
