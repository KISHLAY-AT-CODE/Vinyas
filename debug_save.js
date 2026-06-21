import { connectToDatabase } from './api/_shared/db.js';
import { getISTISOString } from './src/shared/time.js';
import { normalizeUrl } from './src/shared/normalize.js';
import { resolveUser } from './api/_shared/auth.js';
import { deserializeSyllabus, serializeSyllabus, loadTemplate } from './api/_shared/syllabus.js';

async function getAssignment(collection, syncId, targetUrl) {
  const doc = await collection.findOne({ syncId });
  const baseTemplate = loadTemplate(doc.cohort || 'JEE Mains');
  const syllabus = deserializeSyllabus(doc.data, baseTemplate);
  const normUrl = normalizeUrl(targetUrl);
  for (const sub of syllabus) {
    for (const ch of sub.chapters) {
      if (ch.assignments) {
        const found = ch.assignments.find(a => normalizeUrl(a.url) === normUrl);
        if (found) {
          return { found, chapterName: ch.name, subjectName: sub.name };
        }
      }
    }
  }
  return null;
}

async function test() {
  process.env.MONGODB_URI = 'mongodb://localhost:27017/vinyas';
  const db = await connectToDatabase();
  const collection = db.collection('users');
  const rawSyncId = 'vny_sess_47a5889b21f983e9c6080d3653bd8094e748a2ff3a9a34a8';
  
  const existingDoc = await resolveUser(db, rawSyncId);
  const syncId = existingDoc.syncId;
  
  const targetUrl = 'https://www.pw.live/study-v2/notes?pdf=https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/86fc906a-cf3e-4f6e-9bc2-0b789562e289.pdf&permissions=eyJkb3dubG9hZCI6dHJ1ZSwicHJpbnQiOnRydWV9';
  
  console.log("--- Initial State ---");
  let assInfo = await getAssignment(collection, syncId, targetUrl);
  console.log("Assignment states:", assInfo ? assInfo.found.questionStates : "not found");
  
  console.log("\n--- First Save (Q1: completed) ---");
  await saveProgress(collection, syncId, targetUrl, 25, { "1": "completed" }, {});
  assInfo = await getAssignment(collection, syncId, targetUrl);
  console.log("Assignment states after first save:", assInfo ? assInfo.found.questionStates : "not found");
  
  console.log("\n--- Second Save (Q1: completed, Q2: completed) ---");
  await saveProgress(collection, syncId, targetUrl, 25, { "1": "completed", "2": "completed" }, {});
  assInfo = await getAssignment(collection, syncId, targetUrl);
  console.log("Assignment states after second save:", assInfo ? assInfo.found.questionStates : "not found");
}

async function saveProgress(collection, syncId, url, questionCount, questionStates, questionRemarks) {
  const existingDoc = await collection.findOne({ syncId });
  const baseTemplate = loadTemplate(existingDoc.cohort || 'JEE Mains');
  let syllabusData = deserializeSyllabus(existingDoc.data, baseTemplate);
  
  const normUrl = normalizeUrl(url);
  let found = false;

  for (const sub of syllabusData) {
    for (const ch of sub.chapters) {
      if (ch.assignments && ch.assignments.length > 0) {
        const aIdx = ch.assignments.findIndex(a => normalizeUrl(a.url) === normUrl);
        if (aIdx !== -1) {
          if (typeof questionCount !== 'undefined') syllabusData[syllabusData.indexOf(sub)].chapters[sub.chapters.indexOf(ch)].assignments[aIdx].questionCount = questionCount;
          if (questionStates) syllabusData[syllabusData.indexOf(sub)].chapters[sub.chapters.indexOf(ch)].assignments[aIdx].questionStates = questionStates;
          if (questionRemarks) syllabusData[syllabusData.indexOf(sub)].chapters[sub.chapters.indexOf(ch)].assignments[aIdx].questionRemarks = questionRemarks;
          found = true;
          break;
        }
      }
    }
    if (found) break;
  }

  if (!found) {
    console.error("Assignment not found for URL!");
    return;
  }

  const serializedData = serializeSyllabus(syllabusData, baseTemplate);
  await collection.updateOne(
    { syncId },
    { $set: { data: serializedData, lastUpdated: getISTISOString() } }
  );
  console.log("Saved.");
}

test();
