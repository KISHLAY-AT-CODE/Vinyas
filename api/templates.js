import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const dirPath = path.join(process.cwd(), 'templates');

  // POST Request: Disabled to prevent server restarts during file watching
  if (req.method === 'POST') {
    return res.status(400).json({ 
      error: 'Saving custom templates as files is disabled to prevent server restarts. Custom syllabus data is saved in the database directly.' 
    });
  }

  // GET Request: read all JSON templates in /templates
  if (req.method === 'GET') {
    try {
      const templatesMap = {};

      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        files.forEach(file => {
          if (file.endsWith('.json')) {
            try {
              const filePath = path.join(dirPath, file);
              const content = fs.readFileSync(filePath, 'utf8');
              const data = JSON.parse(content);
              if (data.examName && data.subjects) {
                templatesMap[data.examName] = data.subjects;
              }
            } catch (jsonErr) {
              console.error(`Error parsing template file ${file}:`, jsonErr);
            }
          }
        });
      }

      return res.status(200).json(templatesMap);
    } catch (err) {
      console.error("Error reading templates folder:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
