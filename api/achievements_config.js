export const ACHIEVEMENTS_LIST = [
  {
    id: 'syllabus_starter',
    title: 'Syllabus Starter',
    description: 'Began progress on your syllabus by completing some part of a chapter or DPP.',
    icon: '🚀',
    check: (userDoc) => {
      const syllabus = userDoc.data || [];
      return syllabus.some(sub => 
        (sub.chapters || []).some(ch => 
          (ch.module && ch.module.comp > 0) || (ch.dpp && ch.dpp.comp > 0)
        )
      );
    }
  },
  {
    id: 'first_strike',
    title: 'First Strike',
    description: 'Logged your first mock test or practice log in the planner.',
    icon: '🎯',
    check: (userDoc) => {
      return Array.isArray(userDoc.testLogs) && userDoc.testLogs.length >= 1;
    }
  },
  {
    id: 'mock_master',
    title: 'Mock Master',
    description: 'Logged 5 or more mock tests or practice logs.',
    icon: '🏆',
    check: (userDoc) => {
      return Array.isArray(userDoc.testLogs) && userDoc.testLogs.length >= 5;
    }
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Studied late at night between 12 AM and 4 AM.',
    icon: '🦉',
    check: (userDoc) => {
      const activities = userDoc.activities || [];
      return activities.some(act => {
        if (!act.timestamp) return false;
        const hour = new Date(act.timestamp).getHours();
        return hour >= 0 && hour < 4;
      });
    }
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Studied early in the morning between 5 AM and 8 AM.',
    icon: '🌅',
    check: (userDoc) => {
      const activities = userDoc.activities || [];
      return activities.some(act => {
        if (!act.timestamp) return false;
        const hour = new Date(act.timestamp).getHours();
        return hour >= 5 && hour < 8;
      });
    }
  },
  {
    id: 'dpp_sniper',
    title: 'DPP Sniper',
    description: 'Achieved 100% completion on at least 3 DPPs.',
    icon: '🎯',
    check: (userDoc) => {
      const syllabus = userDoc.data || [];
      let count = 0;
      syllabus.forEach(sub => {
        (sub.chapters || []).forEach(ch => {
          if (ch.dpp && ch.dpp.comp === 100) count++;
        });
      });
      return count >= 3;
    }
  },
  {
    id: 'module_conqueror',
    title: 'Module Conqueror',
    description: 'Achieved 100% completion on any interactive chapter module tracker.',
    icon: '👑',
    check: (userDoc) => {
      const syllabus = userDoc.data || [];
      return syllabus.some(sub => 
        (sub.chapters || []).some(ch => ch.module && ch.module.comp === 100)
      );
    }
  },
  {
    id: 'perfect_accuracy',
    title: 'Perfect Accuracy',
    description: 'Achieved 90%+ accuracy on any module or DPP.',
    icon: '🔥',
    check: (userDoc) => {
      const syllabus = userDoc.data || [];
      return syllabus.some(sub => 
        (sub.chapters || []).some(ch => 
          (ch.module && ch.module.acc >= 90) || (ch.dpp && ch.dpp.acc >= 90)
        )
      );
    }
  },
  {
    id: 'consistent_scholar',
    title: 'Consistent Scholar',
    description: 'Completed 5 or more daily routines or plans.',
    icon: '📅',
    check: (userDoc) => {
      return Array.isArray(userDoc.routines) && userDoc.routines.filter(r => r.done).length >= 5;
    }
  },
  {
    id: 'dpp_killer',
    title: 'DPP Killer',
    description: 'Submitted 3 DPPs or modules with above 85% accuracy in a single day.',
    icon: '💀',
    check: (userDoc) => {
      const activities = userDoc.activities || [];
      const dppScores = activities.filter(act => 
        act.type === 'DPP_SCORE' && 
        act.details && 
        act.details.accuracy > 85
      );
      
      const counts = {};
      dppScores.forEach(act => {
        if (!act.timestamp) return;
        const dateStr = new Date(act.timestamp).toDateString();
        counts[dateStr] = (counts[dateStr] || 0) + 1;
      });
      
      return Object.values(counts).some(count => count >= 3);
    }
  },
  {
    id: 'are_you_procrastinating',
    title: 'Are you procrastinating?',
    description: 'Fewer than 2 DPP or module uploads logged by 11 PM today.',
    icon: '🛌',
    check: (userDoc) => {
      const now = new Date();
      if (now.getHours() < 23) return false;
      
      const activities = userDoc.activities || [];
      const todayStr = now.toDateString();
      
      const todayUploads = activities.filter(act => {
        if (act.type !== 'DPP_SCORE' && act.type !== 'PW_BOOKS_QUESTIONS') return false;
        if (!act.timestamp) return false;
        const actDate = new Date(act.timestamp);
        return actDate.toDateString() === todayStr;
      });
      
      return todayUploads.length < 2;
    }
  }
];

export function getAllAchievementsStatus(userDoc) {
  const existingAchievements = userDoc?.achievements || [];
  const existingMap = new Map(existingAchievements.map(a => [a.id, a]));

  return ACHIEVEMENTS_LIST.map(ach => {
    let unlocked = false;
    let unlockedAt = null;
    
    const existing = existingMap.get(ach.id);
    if (existing && (existing.unlocked || existing.unlockedAt || existing.date)) {
      unlocked = true;
      unlockedAt = existing.unlockedAt || existing.date || new Date().toLocaleDateString();
    } else {
      try {
        if (ach.check(userDoc)) {
          unlocked = true;
          unlockedAt = new Date().toLocaleDateString();
        }
      } catch (e) {
        console.error(`Error checking achievement ${ach.id}:`, e);
      }
    }
    
    return {
      id: ach.id,
      title: ach.title,
      description: ach.description,
      icon: ach.icon,
      unlocked,
      unlockedAt
    };
  });
}

export function calculateAchievements(userDoc) {
  return getAllAchievementsStatus(userDoc)
    .filter(a => a.unlocked)
    .map(a => ({
      id: a.id,
      title: a.title,
      description: a.description,
      icon: a.icon,
      unlockedAt: a.unlockedAt
    }));
}
