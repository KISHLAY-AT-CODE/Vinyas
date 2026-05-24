import { connectToDatabase } from './db.js';
import { calculateAchievements, getAllAchievementsStatus } from './achievements_config.js';
import { getISTISOString, getISTLogPrefix } from './timezone.js';
import fs from 'fs';
import path from 'path';

// Load base template subjects and chapters from templates directory
function loadTemplate(cohortName) {
  if (!cohortName) return null;
  
  const filename = cohortName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.json';
  const filePath = path.join(process.cwd(), 'templates', filename);
  
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      return parsed.subjects || null;
    }
  } catch (err) {
    console.error(`${getISTLogPrefix()} Failed to load template ${cohortName} from ${filePath}:`, err);
  }
  
  return null;
}

// Convert full syllabus array to optimized diff format for MongoDB
function serializeSyllabus(userData, baseTemplate) {
  if (!baseTemplate || !Array.isArray(userData)) {
    return { isRaw: true, data: userData };
  }

  const additions = [];
  const deletions = [];
  const progressList = [];

  userData.forEach(sub => {
    if (!sub || !sub.name) return;
    const baseSub = baseTemplate.find(s => s.name.trim().toLowerCase() === sub.name.trim().toLowerCase());
    
    if (!baseSub) {
      // Custom subject added by user
      additions.push({
        type: 'subject',
        subjectName: sub.name,
        color: sub.color,
        chapters: sub.chapters
      });
      return;
    }

    // Check for deleted chapters
    baseSub.chapters.forEach(baseCh => {
      const userCh = sub.chapters.find(c => c.name.trim().toLowerCase() === baseCh.name.trim().toLowerCase());
      if (!userCh) {
        deletions.push({
          subjectName: sub.name,
          chapterName: baseCh.name
        });
      }
    });

    // Check for custom added chapters and active progress
    sub.chapters.forEach(userCh => {
      const baseCh = baseSub.chapters.find(c => c.name.trim().toLowerCase() === userCh.name.trim().toLowerCase());
      
      if (!baseCh) {
        // Custom chapter added by user
        additions.push({
          type: 'chapter',
          subjectName: sub.name,
          chapter: userCh
        });
      } else {
        // Base template chapter - check if it has active progress
        const hasProgress = 
          userCh.status !== 'None' || 
          userCh.lectures > 0 || 
          (userCh.log && userCh.log.trim() !== '') || 
          (userCh.dpp && (userCh.dpp.acc > 0 || userCh.dpp.comp > 0)) || 
          (userCh.module && (userCh.module.acc > 0 || userCh.module.comp > 0)) ||
          (userCh.dppLogs && userCh.dppLogs.length > 0);

        if (hasProgress) {
          progressList.push({
            subjectName: sub.name,
            chapterName: userCh.name,
            progress: {
              status: userCh.status,
              lectures: userCh.lectures,
              log: userCh.log,
              dpp: userCh.dpp,
              module: userCh.module,
              dppLogs: userCh.dppLogs
            }
          });
        }
      }
    });
  });

  return {
    isRaw: false,
    additions,
    deletions,
    progressList,
    subjectColors: userData.map(s => ({ name: s.name, color: s.color }))
  };
}

// Reconstruct full syllabus array by combining template structure and diff modifications
function deserializeSyllabus(serialized, baseTemplate) {
  if (!serialized) return [];
  if (Array.isArray(serialized)) return serialized;
  if (serialized.isRaw) return serialized.data || [];

  if (!baseTemplate) {
    return [];
  }

  const COLORS = ["bg-blue-600", "bg-emerald-600", "bg-indigo-600", "bg-purple-600", "bg-rose-600", "bg-amber-600", "bg-cyan-600"];
  
  // 1. Build initial list from baseTemplate
  const reconstructed = baseTemplate.map((baseSub, idx) => {
    const savedColorObj = serialized.subjectColors?.find(c => c.name.trim().toLowerCase() === baseSub.name.toLowerCase());
    const color = savedColorObj ? savedColorObj.color : COLORS[idx % COLORS.length];

    // Filter chapters (remove deletions)
    const filteredChapters = baseSub.chapters
      .filter(baseCh => {
        const isDeleted = serialized.deletions?.some(d => 
          d.subjectName.trim().toLowerCase() === baseSub.name.trim().toLowerCase() &&
          d.chapterName.trim().toLowerCase() === baseCh.name.trim().toLowerCase()
        );
        return !isDeleted;
      })
      .map(baseCh => {
        // Find if there is saved progress
        const savedProgress = serialized.progressList?.find(p => 
          p.subjectName.trim().toLowerCase() === baseSub.name.trim().toLowerCase() &&
          p.chapterName.trim().toLowerCase() === baseCh.name.trim().toLowerCase()
        );

        if (savedProgress) {
          return {
            name: baseCh.name,
            status: savedProgress.progress.status || 'None',
            lectures: savedProgress.progress.lectures || 0,
            log: savedProgress.progress.log || '',
            dpp: savedProgress.progress.dpp || { acc: 0, comp: 0 },
            module: savedProgress.progress.module || { acc: 0, comp: 0 },
            dppLogs: savedProgress.progress.dppLogs || []
          };
        }

        // Untouched chapter default state
        return {
          name: baseCh.name,
          status: 'None',
          lectures: 0,
          log: '',
          dpp: { acc: 0, comp: 0 },
          module: { acc: 0, comp: 0 },
          dppLogs: []
        };
      });

    return {
      name: baseSub.name,
      color,
      chapters: filteredChapters
    };
  });

  // 2. Apply custom additions
  if (serialized.additions && Array.isArray(serialized.additions)) {
    serialized.additions.forEach(add => {
      if (add.type === 'subject') {
        reconstructed.push({
          name: add.subjectName,
          color: add.color || "bg-indigo-600",
          chapters: add.chapters || []
        });
      } else if (add.type === 'chapter') {
        const sub = reconstructed.find(s => s.name.trim().toLowerCase() === add.subjectName.trim().toLowerCase());
        if (sub) {
          sub.chapters.push(add.chapter);
        } else {
          reconstructed.push({
            name: add.subjectName,
            color: "bg-indigo-600",
            chapters: [add.chapter]
          });
        }
      }
    });
  }

  return reconstructed;
}

export default async function handler(req, res) {
  // Enforce global request body size limit of 2MB to protect MongoDB and Vercel functions
  if (req.body && JSON.stringify(req.body).length > 2 * 1024 * 1024) {
    return res.status(413).json({ error: 'Payload too large (limit is 2MB)' });
  }

  try {
    const db = await connectToDatabase();
    const collection = db.collection('users');

    if (req.method === 'GET') {
      const rawSyncId = req.query.syncId;
      if (!rawSyncId || typeof rawSyncId !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing syncId' });
      }
      const syncId = String(rawSyncId).trim();
      if (!syncId) return res.status(400).json({ error: 'syncId cannot be empty' });

      const userDoc = await collection.findOne({ syncId });
      if (userDoc) {
        // Reconstruct the full syllabus data before calculating achievements and sending to client
        const baseTemplate = loadTemplate(userDoc.cohort);
        userDoc.data = deserializeSyllabus(userDoc.data, baseTemplate);
        
        userDoc.achievements = calculateAchievements(userDoc);
        userDoc.allAchievements = getAllAchievementsStatus(userDoc);
      }
      return res.status(200).json(userDoc || { exists: false });
    } 
    
    if (req.method === 'POST') {
      const { syncId: rawSyncId, data, routines, testLogs, targetDate, cohort, resolvedActivityIds, email, autoBackupEnabled } = req.body;
      if (!rawSyncId || typeof rawSyncId !== 'string') return res.status(400).json({ error: 'Invalid or missing syncId' });
      const syncId = String(rawSyncId).trim();
      if (!syncId) return res.status(400).json({ error: 'syncId cannot be empty' });

      // Retrieve existing doc to get activities and preserve existing achievements
      const existingDoc = await collection.findOne({ syncId });
      const isSecure = syncId.startsWith('vny_sec_');

      if (!isSecure && !existingDoc) {
        return res.status(400).json({ 
          error: 'Security Enforcement: The Sync ID provided is not secure and does not exist in the database. New sync profiles must be created with a cryptographically secure Sync ID (starts with "vny_sec_") generated by the Vinyas console.' 
        });
      }

      const docToUse = existingDoc || {};
      const activities = docToUse.activities || [];

      // Construct a temporary full userDoc to evaluate achievements (using the incoming full data)
      const tempUserDoc = {
        data,
        routines,
        testLogs,
        activities,
        targetDate,
        cohort,
        achievements: docToUse.achievements || []
      };

      const calculatedAchievements = calculateAchievements(tempUserDoc);
      const allAchievements = getAllAchievementsStatus(tempUserDoc);

      // Serialize the incoming full syllabus data (diff against the base template)
      const baseTemplate = loadTemplate(cohort);
      const serializedData = serializeSyllabus(data, baseTemplate);

      const updateDoc = {
        $set: {
          data: serializedData, // Save only the optimized diff structure
          routines,
          testLogs,
          achievements: calculatedAchievements,
          targetDate,
          cohort,
          resolvedActivityIds,
          email,
          autoBackupEnabled,
          lastUpdated: getISTISOString()
        }
      };

      await collection.updateOne({ syncId }, updateDoc, { upsert: true });
      return res.status(200).json({ 
        success: true, 
        achievements: calculatedAchievements,
        allAchievements 
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(`${getISTLogPrefix()} MongoDB Error in data sync endpoint:`, error);
    return res.status(500).json({ error: error.message });
  }
}
