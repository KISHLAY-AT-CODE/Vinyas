import urllib.request
import re
import os

def update_release_metadata():
    url = "https://github.com/KISHLAY-AT-CODE/VinyasApp/releases"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    req = urllib.request.Request(url, headers=headers)
    
    print(f"Scraping latest release info from: {url}")
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching releases page: {e}")
        return

    # Find the APK URL
    # Expected relative path format: href="/KISHLAY-AT-CODE/VinyasApp/releases/download/v1.0.0/application-..."
    match = re.search(r'href="(/KISHLAY-AT-CODE/VinyasApp/releases/download/([^/]+)/[^"]+\.apk)"', html)
    if not match:
        print("No APK asset found on the releases page. Keeping current placeholders.")
        return

    apk_path = match.group(1)
    apk_version = match.group(2) # e.g. "v1.0.0"
    apk_url = f"https://github.com{apk_path}"

    print(f"Found latest release version: {apk_version}")
    print(f"Latest APK URL: {apk_url}")

    # Fetch file size via HEAD request
    size_bytes = 0
    try:
        head_req = urllib.request.Request(apk_url, headers=headers, method='HEAD')
        with urllib.request.urlopen(head_req) as head_resp:
            size_bytes = int(head_resp.getheader('Content-Length', 0))
    except Exception as e:
        print(f"Could not get file size via HEAD request: {e}")

    print(f"File size: {size_bytes} bytes")

    # Formatting helper
    def format_size(bytes_val):
        if bytes_val >= 1024 * 1024:
            return f"{bytes_val / (1024 * 1024):.2f} MB"
        return f"{bytes_val / 1024:.1f} KB"

    formatted_size = format_size(size_bytes) if size_bytes > 0 else "2.97 MB"

    # File paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    ext_page_path = os.path.join(root_dir, 'src', 'components', 'ExtensionPage.jsx')
    metadata_api_path = os.path.join(root_dir, 'api', 'extension-metadata.js')

    # 1. Update ExtensionPage.jsx
    if os.path.exists(ext_page_path):
        with open(ext_page_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Update download link URL
        content = re.sub(
            r'href=\{\s*"[^"]+"\s*/\*\s*APK_DOWNLOAD_URL\s*\*/\s*\}',
            f'href={{"{apk_url}" /* APK_DOWNLOAD_URL */}}',
            content
        )

        # Update metadata state block (version and size)
        content = re.sub(
            r"apk:\s*\{\s*version:\s*'[^']+'\s*/\*\s*APK_VERSION_META\s*\*/,\s*formattedSize:\s*'[^']+'\s*\}",
            f"apk: {{ version: '{apk_version}' /* APK_VERSION_META */, formattedSize: '{formatted_size}' }}",
            content
        )

        # Update user-facing Initial Release label version
        content = re.sub(
            r'Initial Release:\s*[^\s]+\s*\{\s*/\*\s*APK_VERSION_LABEL\s*\*/\s*\}',
            f'Initial Release: {apk_version} {{/* APK_VERSION_LABEL */}}',
            content
        )

        with open(ext_page_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Successfully updated src/components/ExtensionPage.jsx")
    else:
        print(f"Error: Could not locate {ext_page_path}")

    # 2. Update api/extension-metadata.js fallback fields
    if os.path.exists(metadata_api_path):
        with open(metadata_api_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Replace fallback version
        content = re.sub(
            r"let apkVersion\s*=\s*'[^']+'\s*;\s*/\*\s*APK_VERSION_API\s*\*/",
            f"let apkVersion = '{apk_version}'; /* APK_VERSION_API */",
            content
        )

        # Replace fallback size
        content = re.sub(
            r"let apkSizeBytes\s*=\s*\d+\s*;\s*/\*\s*APK_SIZE_API\s*\*/",
            f"let apkSizeBytes = {size_bytes if size_bytes > 0 else 66491}; /* APK_SIZE_API */",
            content
        )

        with open(metadata_api_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Successfully updated api/extension-metadata.js")
    else:
        print(f"Error: Could not locate {metadata_api_path}")

if __name__ == "__main__":
    update_release_metadata()
