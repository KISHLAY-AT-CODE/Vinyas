import fs from 'fs';
import path from 'path';

// In-memory cache for GitHub release data (avoids hitting API rate limits on every request)
let cachedRelease = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches the latest release from the VinyasApp GitHub repo.
 * Returns { tagName, downloadUrl, size } for the first .apk asset found,
 * or null if the fetch fails or no .apk asset exists.
 */
async function fetchLatestGitHubRelease() {
  const now = Date.now();
  if (cachedRelease && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedRelease;
  }

  try {
    const response = await fetch(
      'https://api.github.com/repos/KISHLAY-AT-CODE/VinyasApp/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'Vinyas-Website/1.0',
          // If you hit rate limits, add a GitHub token:
          // 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      console.warn(`GitHub API returned ${response.status}: ${response.statusText}`);
      return null;
    }

    const release = await response.json();
    const apkAsset = release.assets?.find(
      (asset) => asset.name.endsWith('.apk')
    );

    if (!apkAsset) {
      console.warn('No .apk asset found in the latest GitHub release.');
      return null;
    }

    cachedRelease = {
      tagName: release.tag_name,
      downloadUrl: apkAsset.browser_download_url,
      size: apkAsset.size,
    };
    cacheTimestamp = now;
    return cachedRelease;
  } catch (e) {
    console.warn('Failed to fetch latest GitHub release:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Fallbacks corresponding to current status
  let extVersion = '2.3.1';
  let extSizeBytes = 98103;
  let apkVersion = 'v1.0.1';
  let apkSizeBytes = 138800005;
  let apkDownloadUrl = 'https://github.com/KISHLAY-AT-CODE/VinyasApp/releases/download/v1.0.1/application-4f1442c5-e7b2-419b-92fc-e68bd9c8ae89.apk';

  // --- Fetch latest APK release from GitHub ---
  const latestRelease = await fetchLatestGitHubRelease();
  if (latestRelease) {
    apkVersion = latestRelease.tagName;
    apkSizeBytes = latestRelease.size;
    apkDownloadUrl = latestRelease.downloadUrl;
  }

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
    // Attempt to read extension zip file size
    const extZipPath = path.join(process.cwd(), 'public', 'Vinyas_Extension.zip');
    if (fs.existsSync(extZipPath)) {
      extSizeBytes = fs.statSync(extZipPath).size;
    }
  } catch (e) {
    console.warn('Could not read Vinyas_Extension.zip size:', e.message);
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
      formattedSize: formatSize(apkSizeBytes),
      downloadUrl: apkDownloadUrl
    }
  });
}

