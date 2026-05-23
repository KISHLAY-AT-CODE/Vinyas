import { useState, useCallback } from 'react';

/**
 * Custom React Hook to manage and isolate all achievements-related logic,
 * including local states, server data parsing, unlock notification detection,
 * and simulator triggers.
 */
export const useAchievements = () => {
    const [achievements, setAchievements] = useState([]);
    const [allAchievements, setAllAchievements] = useState([]);
    const [activeAchievement, setActiveAchievement] = useState(null);

    // Hydrates the client state using retrieved server-side profiles
    const loadAchievements = useCallback((serverData) => {
        if (!serverData) return;

        if (serverData.achievements) {
            setAchievements(
                typeof serverData.achievements === 'string'
                    ? JSON.parse(serverData.achievements)
                    : serverData.achievements
            );
        } else {
            setAchievements([]);
        }

        if (serverData.allAchievements) {
            setAllAchievements(serverData.allAchievements);
        } else {
            setAllAchievements([]);
        }
    }, []);

    // Compares saving results to identify and notify about newly unlocked badges
    const handleSaveResponse = useCallback((resData) => {
        if (!resData) return;

        if (resData.achievements) {
            setAchievements((prev) => {
                const newUnlocks = resData.achievements.filter(
                    (serverAch) => !prev.some((localAch) => localAch.id === serverAch.id)
                );
                if (newUnlocks.length > 0) {
                    setActiveAchievement({
                        ...newUnlocks[0],
                        key: Date.now()
                    });
                }
                if (JSON.stringify(prev) !== JSON.stringify(resData.achievements)) {
                    return resData.achievements;
                }
                return prev;
            });
        }

        if (resData.allAchievements) {
            setAllAchievements((prev) => {
                if (JSON.stringify(prev) !== JSON.stringify(resData.allAchievements)) {
                    return resData.allAchievements;
                }
                return prev;
            });
        }
    }, []);

    // Resets state completely when switching or clearing profiles
    const resetAchievements = useCallback(() => {
        setAchievements([]);
        setAllAchievements([]);
        setActiveAchievement(null);
    }, []);

    // Triggers a preview toast using the first locked achievement or a fallback
    const triggerTestAchievement = useCallback(() => {
        const target = allAchievements.find((a) => !a.unlocked) || allAchievements[0];
        if (target) {
            setActiveAchievement({
                ...target,
                key: Date.now()
            });
        }
    }, [allAchievements]);

    // Triggers a preview toast using a specified achievement ID
    const triggerSpecificAchievement = useCallback((id) => {
        const target = allAchievements.find((a) => a.id === id);
        if (target) {
            setActiveAchievement({
                ...target,
                key: Date.now()
            });
        }
    }, [allAchievements]);

    return {
        achievements,
        allAchievements,
        activeAchievement,
        setAchievements,
        setAllAchievements,
        setActiveAchievement,
        loadAchievements,
        handleSaveResponse,
        resetAchievements,
        triggerTestAchievement,
        triggerSpecificAchievement
    };
};
