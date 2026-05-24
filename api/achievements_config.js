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
    description: 'Studied late at night between 12 AM and 4 AM IST.',
    icon: '🦉',
    check: (userDoc) => {
      const activities = userDoc.activities || [];
      return activities.some(act => {
        if (!act.timestamp) return false;
        const date = new Date(act.timestamp);
        const options = { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' };
        const hour = parseInt(new Intl.DateTimeFormat('en-US', options).format(date), 10);
        return hour >= 0 && hour < 4;
      });
    }
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Studied early in the morning between 5 AM and 8 AM IST.',
    icon: '🌅',
    check: (userDoc) => {
      const activities = userDoc.activities || [];
      return activities.some(act => {
        if (!act.timestamp) return false;
        const date = new Date(act.timestamp);
        const options = { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' };
        const hour = parseInt(new Intl.DateTimeFormat('en-US', options).format(date), 10);
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
      
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const counts = {};
      dppScores.forEach(act => {
        if (!act.timestamp) return;
        const date = new Date(act.timestamp);
        const [{ value: m },,{ value: d },,{ value: y }] = formatter.formatToParts(date);
        const dateStr = `${y}-${m}-${d}`;
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
      const options = { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' };
      const istHour = parseInt(new Intl.DateTimeFormat('en-US', options).format(now), 10);
      if (istHour < 23) return false;
      
      const activities = userDoc.activities || [];
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const [{ value: m },,{ value: d },,{ value: y }] = formatter.formatToParts(now);
      const todayIST = `${y}-${m}-${d}`;
      
      const todayUploads = activities.filter(act => {
        if (act.type !== 'DPP_SCORE' && act.type !== 'PW_BOOKS_QUESTIONS') return false;
        if (!act.timestamp) return false;
        const actDate = new Date(act.timestamp);
        const [{ value: am },,{ value: ad },,{ value: ay }] = formatter.formatToParts(actDate);
        const actDateIST = `${ay}-${am}-${ad}`;
        return actDateIST === todayIST;
      });
      
      return todayUploads.length < 2;
    }
  },
  {
    id: 'sleeping_beauty',
    title: 'Sleeping Beauty',
    description: "Sleeping a bit much aren't you?",
    icon: '😴',
    check: (userDoc) => {
      const activities = userDoc.activities || [];
      if (activities.length === 0) return false;

      // Group activities by date string in IST to find the first activity of each day
      const days = {};
      activities.forEach(act => {
        if (!act.timestamp) return;
        const date = new Date(act.timestamp);
        
        // Format to IST date string
        const dateOptions = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
        const formatter = new Intl.DateTimeFormat('en-US', dateOptions);
        const [{ value: m },,{ value: d },,{ value: y }] = formatter.formatToParts(date);
        const dateStr = `${y}-${m}-${d}`;
        
        if (!days[dateStr]) {
          days[dateStr] = [];
        }
        days[dateStr].push(date);
      });

      // Check if there is any day where the earliest activity was after 10:00 AM IST
      return Object.keys(days).some(dateStr => {
        const times = days[dateStr];
        const earliest = new Date(Math.min(...times.map(t => t.getTime())));
        
        // Get hour in IST
        const timeOptions = { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' };
        const formatted = new Intl.DateTimeFormat('en-US', timeOptions).format(earliest);
        const hour = parseInt(formatted, 10);
        
        // Trigger if the first activity of the day is at or after 10:00 AM IST
        return hour >= 10;
      });
    }
  },
  {
    id: 'dead_man_walking',
    title: 'Dead Man Walking',
    description: 'Submitted 2 consecutive DPPs with less than 60% accuracy.',
    icon: '🧟',
    check: (userDoc) => {
      const activities = userDoc.activities || [];
      const dppSubs = activities.filter(act => 
        act.type === 'DPP_SCORE' && 
        act.details && 
        (act.details.quizType === 'DPP' || !act.details.quizType) &&
        typeof act.details.accuracy === 'number'
      );
      
      for (let i = 0; i < dppSubs.length - 1; i++) {
        if (dppSubs[i].details.accuracy < 60 && dppSubs[i + 1].details.accuracy < 60) {
          return true;
        }
      }
      return false;
    }
  }
];

export function getISTDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [{ value: month },,{ value: day },,{ value: year }] = formatter.formatToParts(date);
  return `${day}/${month}/${year}`;
}

export function getAllAchievementsStatus(userDoc) {
  const existingAchievements = userDoc?.achievements || [];
  const existingMap = new Map(existingAchievements.map(a => [a.id, a]));

  return ACHIEVEMENTS_LIST.map(ach => {
    let unlocked = false;
    let unlockedAt = null;
    
    const existing = existingMap.get(ach.id);
    if (existing && (existing.unlocked || existing.unlockedAt || existing.date)) {
      unlocked = true;
      unlockedAt = existing.unlockedAt || existing.date || getISTDateString(new Date());
    } else {
      try {
        if (ach.check(userDoc)) {
          unlocked = true;
          unlockedAt = getISTDateString(new Date());
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
