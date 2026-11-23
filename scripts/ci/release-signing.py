#!/usr/bin/env python3
"""Switch the generated android/app/build.gradle to the private release key (CI only).
Reads the keystore path and passwords from environment variables, never from the repository."""
import re, sys
p = 'android/app/build.gradle'
s = open(p).read()
block = """        release {
            storeFile file(System.getenv('ORAMUS_KEYSTORE_PATH'))
            storePassword System.getenv('ORAMUS_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ORAMUS_KEY_ALIAS')
            keyPassword System.getenv('ORAMUS_KEY_PASSWORD')
        }
"""
if 'ORAMUS_KEYSTORE_PATH' not in s:
    s = s.replace('    signingConfigs {\n', '    signingConfigs {\n' + block, 1)
# in buildTypes.release, use the release config instead of debug
m = re.search(r'(\n        release \{[^}]*?)signingConfig signingConfigs\.debug', s[s.index('buildTypes'):])
if not m:
    sys.exit('release buildType with debug signing not found')
i = s.index('buildTypes') + m.start(1)
s = s[:i] + m.group(1) + 'signingConfig signingConfigs.release' + s[i + len(m.group(0)):]
open(p, 'w').write(s)
print('release signing configured')
