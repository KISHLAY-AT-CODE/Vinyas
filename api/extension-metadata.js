import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Fallbacks corresponding to current status
  let extVersion = '2.1.1';
  let extSizeBytes = 98103;
  let apkVersion = '2.1.1';
  let apkSizeBytes = 3112953;

  try {
    // Attempt to read manifest.json
    const manifestPath = path.join(process.cwd(), 'Vinyas_Extension', 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest && manifest.version) {
        extVersion = manifest.version;
      }
    }
  } catch (e) {
    console.warn('Could not read extension manifest.json:', e.message);
  }

  try {
    // Attempt to read package.json for APK version
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg && pkg.version) {
        apkVersion = pkg.version;
      }
    }
  } catch (e) {
    console.warn('Could not read package.json:', e.message);
  }

  try {
    // Attempt to read extension zip file size
    const extZipPath = path.join(process.cwd(), 'public', 'Vinyas_Extension.zip');
    if (fs.existsSync(extZipPath)) {
      extSizeBytes = fs.statSync(extZipPath).size;
    }
  } catch (e) {
    console.warn('Could not read Vinyas_Extension.zip size:', e.message);
  }

  try {
    // Attempt to read apk file size
    const apkPath = path.join(process.cwd(), 'public', 'Vinyas.apk');
    if (fs.existsSync(apkPath)) {
      apkSizeBytes = fs.statSync(apkPath).size;
    }
  } catch (e) {
    console.warn('Could not read Vinyas.apk size:', e.message);
  }

  // Formatting helper
  const formatSize = (bytes) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return res.status(200).json({
    extension: {
      version: extVersion,
      sizeBytes: extSizeBytes,
      formattedSize: formatSize(extSizeBytes)
    },
    apk: {
      version: apkVersion,
      sizeBytes: apkSizeBytes,
      formattedSize: formatSize(apkSizeBytes)
    }
  });
}
