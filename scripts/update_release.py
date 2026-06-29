import json
import re
import os

def parse_size_input(size_str):
    size_str = size_str.lower().replace(" ", "").strip()
    if not size_str:
        return 24103822, "22.99 MB" # Default fallback
    if "mb" in size_str:
        try:
            val = float(size_str.replace("mb", ""))
            return int(val * 1024 * 1024), f"{val:.2f} MB"
        except ValueError:
            pass
    elif "kb" in size_str:
        try:
            val = float(size_str.replace("kb", ""))
            return int(val * 1024), f"{val:.1f} KB"
        except ValueError:
            pass
    
    try:
        val = float(size_str)
        if val > 100000: # assume raw bytes
            bytes_val = int(val)
            if bytes_val >= 1024 * 1024:
                return bytes_val, f"{bytes_val / (1024*1024):.2f} MB"
            return bytes_val, f"{bytes_val / 1024:.1f} KB"
        else: # assume MB value (e.g. 22.5)
            return int(val * 1024 * 1024), f"{val:.2f} MB"
    except ValueError:
        print("Invalid size format. Defaulting to 22.99 MB.")
        return 24103822, "22.99 MB"

def update_release_metadata():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    pkg_path = os.path.join(root_dir, 'VinyasApp', 'package.json')
    
    # 1. Read version from VinyasApp package.json
    apk_version = "v1.0.0"
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, 'r', encoding='utf-8') as f:
                pkg_data = json.load(f)
                version_raw = pkg_data.get("version", "1.0.0")
                apk_version = f"v{version_raw}" if not version_raw.startswith("v") else version_raw
            print(f"Loaded client version from VinyasApp/package.json: {apk_version}")
        except Exception as e:
            print(f"Warning: Could not read VinyasApp/package.json: {e}. Defaulting to v1.0.0")
    else:
        print(f"Warning: VinyasApp/package.json not found at {pkg_path}. Defaulting to v1.0.0")

    # 2. Get input from developer on APK file size
    try:
        size_input = input("Enter the APK file size (e.g. '22.5', '22.5 MB', or raw bytes): ").strip()
    except EOFError:
        size_input = "22.5 MB" # Fallback if run in non-interactive environment
        print(f"Non-interactive session: Defaulting size to {size_input}")
        
    size_bytes, formatted_size = parse_size_input(size_input)
    print(f"Parsed Size: {formatted_size} ({size_bytes} bytes)")

    ext_page_path = os.path.join(root_dir, 'src', 'components', 'ExtensionPage.jsx')
    metadata_api_path = os.path.join(root_dir, 'api', 'extension-metadata.js')

    # 3. Update ExtensionPage.jsx
    if os.path.exists(ext_page_path):
        with open(ext_page_path, 'r', encoding='utf-8') as f:
            content = f.read()

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

    # 4. Update api/extension-metadata.js fallback fields
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
