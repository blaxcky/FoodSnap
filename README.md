# FoodSnap

FoodSnap is a mobile-first, local-only food logger available as a PWA and a native Android app. It captures only what matters for later AI analysis:

- food name
- direct grams or pieces
- before/after weight difference
- optional note

There is no calorie database, account system, or backend. Everything is local and static-hosting friendly.

## Features

- autocomplete suggestions from your own saved foods
- direct mode and before/after difference mode
- session editing, duplication, deletion, and plain-text export
- camera, gallery, and recursive photo-folder imports
- duplicate-safe Android folder scans at each cold app start and whenever Photos opens
- offline-capable PWA

## Stack

- React, TypeScript, and Vite
- `localStorage` for log data
- IndexedDB for photo blobs and folder-import history
- `vite-plugin-pwa` for browser installation and offline caching
- Capacitor 8 for the native Android package

## Local setup

```bash
npm install
npm test
npm run dev
npm run build
```

## Android app

The Android package ID is permanently set to `io.github.blaxcky.foodsnap`. Android 7.0 (API 24) or newer is required.

To build locally, install Android Studio/SDK and use JDK 21, then run:

```bash
npm run android:sync
cd android
./gradlew test lint assembleDebug
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. `npm run android:open` opens the project in Android Studio.

Direct camera mode requests only Android's `CAMERA` permission. Folder import uses Android's system document-tree picker and does not request broad storage or media access. Android retains read access to the selected folder and its subfolders across app and device restarts. If the folder is moved or access is revoked, select it again in Settings; already imported photos are not removed.

The PWA and APK have separate app storage. Installing the APK does not migrate browser data, and uninstalling either version does not affect the other's data. Food-memory backups can be exported and imported manually.

## Install releases and Obtainium

Each push to `main` publishes a signed universal APK in [GitHub Releases](https://github.com/blaxcky/FoodSnap/releases). Download `FoodSnap-vX.Y.Z.apk`, allow installation from your browser or file manager, and open it.

For automatic update tracking with [Obtainium](https://obtainium.imranr.dev/), add:

```text
https://github.com/blaxcky/FoodSnap
```

The release tag and APK version use `v<package major>.<package minor>.<GitHub run number>`. The release signing certificate SHA-256 fingerprint is:

```text
3C:B1:65:2F:96:BC:D5:81:E0:59:09:0E:62:A9:1E:70:25:32:94:76:EB:EA:24:04:68:00:16:BB:A7:44:40:7F
```

Verify a downloaded APK with Android SDK tools:

```bash
apksigner verify --print-certs FoodSnap-vX.Y.Z.apk
aapt dump badging FoodSnap-vX.Y.Z.apk
sha256sum --check FoodSnap-vX.Y.Z.apk.sha256
```

## Release signing

The release keystore and recovery password are local-only files under the ignored `.signing/` directory. Keep an encrypted backup: losing the key makes it impossible to update existing APK installations.

The Android release workflow requires these repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS` (`foodsnap`)
- `ANDROID_KEY_PASSWORD`

The workflow runs the web tests and build, synchronizes Capacitor, runs Gradle tests and lint, builds a signed universal APK, and publishes the APK plus its SHA-256 checksum. Re-running the same workflow run updates its existing release.

## GitHub Pages deployment

`.github/workflows/deploy.yml` builds and publishes the PWA. Configure `Settings -> Pages -> Build and deployment` to use GitHub Actions. The workflow derives the project-page base path automatically; native builds always use `/`.

The PWA service worker is registered only in a browser. The Capacitor app loads its bundled assets directly, and its app data is isolated from the website by Android.

## Architecture decisions

- No client-side router keeps static hosting straightforward.
- A platform-neutral folder adapter preserves the browser File System Access flow and delegates Android access to a small native Storage Access Framework plugin.
- Imported photos are resized to at most 1600 pixels on the longest edge and encoded as JPEG at quality 0.82 before IndexedDB storage.
- Folder import history uses relative path, byte size, and modification time for duplicate detection. Selecting a different folder clears that history.
- The Android folder is scanned once per new app process and whenever the Photos tab opens; the PWA scans whenever the Photos tab opens.
