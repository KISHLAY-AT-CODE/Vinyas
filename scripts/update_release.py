import urllib.request
import json
import re
import os

def load_env_token():
    # Attempt to load GITHUB_TOKEN from local .env
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        return token
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    env_path = os.path.join(root_dir, '.env')
    
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("GITHUB_TOKEN="):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
        except Exception as e:
            print(f"Warning: Could not read .env file: {e}")
    return None

def update_release_metadata():
    url = "https://api.github.com/repos/KISHLAY-AT-CODE/VinyasApp/releases/latest"
    headers = {
        'User-Agent': 'VinyasReleaseUpdater/1.0',
        'Accept': 'application/vnd.github.v3+json'
    }
    
    token = load_env_token()
    if token:
        print("Using GITHUB_TOKEN for authenticated API request.")
        headers['Authorization'] = f"token {token}"
    else:
        print("Warning: GITHUB_TOKEN not found. Requesting anonymously. (Will fail if repository is private).")

    req = urllib.request.Request(url, headers=headers)
    
    print(f"Requesting latest release details from GitHub API: {url}")
    try:
        with urllib.request.urlopen(req) as response:
            res_data = response.read().decode('utf-8')
            data = json.loads(res_data)
    except Exception as e:
        print(f"Error calling GitHub API: {e}")
        if not token:
            print("Tip: If the repository is private, please add GITHUB_TOKEN=your_token to your .env file.")
        return

    apk_version = data.get("tag_name") # e.g. "v1.0.0"
    assets = data.get("assets", [])
    
    apk_asset = None
    for asset in assets:
        if asset.get("name", "").endswith(".apk"):
            apk_asset = asset
            break
            
    if not apk_asset:
        print("No APK asset found in the latest release details.")
        return

    apk_url = apk_asset.get("browser_download_url")
    size_bytes = apk_asset.get("size", 0)

    print(f"Found latest release version: {apk_version}")
    print(f"Latest APK URL: {apk_url}")
    print(f"File size: {size_bytes} bytes")

    # Formatting helper
    def format_size(bytes_val):
        if bytes_val >= 1024 * 1024:
            return f"{bytes_val / (1024 * 1024):.2f} MB"
        return f"{bytes_val / 1024:.1f} KB"

    formatted_size = format_size(size_bytes) if size_bytes > 0 else "2.97 MB"

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
            f"let apkSizeBytes = {size_bytes}; /* APK_SIZE_API */",
            content
        )

        with open(metadata_api_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Successfully updated api/extension-metadata.js")
    else:
        print(f"Error: Could not locate {metadata_api_path}")

if __name__ == "__main__":
    update_release_metadata()
