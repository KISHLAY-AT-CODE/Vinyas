import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const dirPath = path.join(process.cwd(), 'templates');

  if (req.method === 'POST') {
    try {
      const { examName, subjects } = req.body;
      if (!examName || typeof examName !== 'string' || !examName.trim()) {
        return res.status(400).json({ error: 'Invalid or missing examName' });
      }
      if (!subjects || !Array.isArray(subjects)) {
        return res.status(400).json({ error: 'Invalid or missing subjects' });
      }

      // Ensure directory exists
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Format filename to snake_case, e.g. "JEE Mains" -> "jee_mains.json"
      const filename = examName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.json';
      const filePath = path.join(dirPath, filename);

      const payload = {
        examName: examName.trim(),
        subjects: subjects
      };

      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

      return res.status(200).json({ 
        success: true, 
        message: `Template for "${examName.trim()}" saved to server at "/templates/${filename}" successfully!` 
      });
    } catch (err) {
      console.error("Error writing template file:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // GET Request: read all JSON templates in /templates
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
