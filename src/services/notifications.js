export const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        console.warn("This browser does not support desktop notification");
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
};

export const sendTestNotification = async (userName) => {
    const hasPermission = await requestNotificationPermission();
    if (hasPermission) {
        new Notification(`🔥 Focus time, ${userName || 'Champ'}!`, {
            body: 'Time to crush some DPPs and wrap up your daily workflows!',
            icon: '/icon.svg',
            badge: '/icon.svg',
            vibrate: [200, 100, 200]
        });
        return true;
    }
    return false;
};
