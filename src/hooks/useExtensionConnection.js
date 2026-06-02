import { useState, useEffect, useCallback } from 'react';
import { VINYAS_EXTENSION_VERSION } from '../data/version';

export const useExtensionConnection = ({
    isLoaded,
    showWhatsNew,
    lastSeenExtVersion,
    setLastSeenExtVersion,
    onSyncQuestionUpdate,
    installedExtVersion,
    setInstalledExtVersion
}) => {
    const [showExtWarningHeader, setShowExtWarningHeader] = useState(false);
    const [extensionChecked, setExtensionChecked] = useState(false);

    const pingExtension = useCallback(() => {
        window.postMessage({ type: 'VINYAS_REQUEST_EXT_VERSION' }, '*');
    }, []);

    // Handle extension message triggers
    useEffect(() => {
        const handleExtensionMessage = (event) => {
            if (event.data && event.data.type === 'VINYAS_EXT_VERSION_RESPONSE') {
                const extVer = event.data.version;
                console.log("[Vinyas App] Detected extension version:", extVer);
                setInstalledExtVersion(extVer);
                setExtensionChecked(true);
            } else if (event.data && event.data.type === 'VINYAS_SYNC_QUESTION_UPDATE') {
                if (onSyncQuestionUpdate) {
                    onSyncQuestionUpdate(event.data.data);
                }
            }
        };
        window.addEventListener('message', handleExtensionMessage);
        return () => window.removeEventListener('message', handleExtensionMessage);
    }, [onSyncQuestionUpdate]);

    // Ping extension on load and periodically
    useEffect(() => {
        if (isLoaded) {
            pingExtension();
            // Fallback timeout to assume extension is missing
            const timer = setTimeout(() => {
                setExtensionChecked(true);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isLoaded, pingExtension]);

    // Update alert header banner based on extension version match
    useEffect(() => {
        if (isLoaded && extensionChecked) {
            const isOutdated = installedExtVersion !== VINYAS_EXTENSION_VERSION;
            if (!showWhatsNew && isOutdated) {
                setShowExtWarningHeader(true);
            } else {
                setShowExtWarningHeader(false);
            }
        }
    }, [isLoaded, extensionChecked, installedExtVersion, showWhatsNew]);

    // Automatically sync and save lastSeenExtVersion when a successful extension check verifies a new version
    useEffect(() => {
        if (isLoaded && extensionChecked && installedExtVersion) {
            if (installedExtVersion !== lastSeenExtVersion) {
                setLastSeenExtVersion(installedExtVersion);
            }
        }
    }, [isLoaded, extensionChecked, installedExtVersion, lastSeenExtVersion, setLastSeenExtVersion]);

    return {
        installedExtVersion,
        showExtWarningHeader,
        extensionChecked,
        pingExtension
    };
};
