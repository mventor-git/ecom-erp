# mventor-ticket-041 â€” Build Installable APK (EAS Cloud Build)

**Status:** Ready â€” requires one user step (Expo account login)
**Created:** 2026-08-02
**Priority:** High

## Goal
Produce a signed, installable **APK** of the customer app so it can be installed on Android phones without Expo Go.

## Why EAS (cloud), not local
This machine has no Java JDK and no Android SDK, so a local Gradle build is impossible. EAS Build compiles in Expo's cloud â€” no Android tooling needed locally.

## Prep completed (mventor-ticket-040)
- `eas.json` â€” `preview` profile builds an **APK** (`buildType: apk`), `production` builds an AAB for Play Store
- `app.json` â€” package `com.comfortsign.customer`, scheme `comfortsign`, versionCode 1, branded icons, splash, notification permission
- `eas-cli` installed (devDependency)

## Steps to run (user action required)

```powershell
cd D:\Projects\On-Dev\comfort-sign\mobile-app

# 1. Log in to an Expo account (create one free at expo.dev)
npx eas-cli login

# 2. Link the project (creates app ID; set the app secret if asked)
npx eas-cli init

# 3. Configure build settings (accept defaults)
npx eas-cli build:configure

# 4. Build the APK (cloud build, ~5â€“15 min; you can also:
#    npx eas-cli build -p android --profile preview --local  with Android SDK)
npx eas-cli build --platform android --profile preview

# 5. Download: the CLI prints a link. Install the APK on the phone
#    (allow "install unknown apps" for the browser/files app).
```

## Acceptance Criteria
- [x] `eas.json` preview profile outputs APK
- [x] app.json android package/scheme/icons valid (`expo config` resolves)
- [ ] APK produced by `eas build` and installs on a device (requires Expo login â€” user step)
- [ ] App loads against the configured `API_BASE_URL` from the APK

## Notes
- First build generates an Android keystore in EAS; keep it (EAS stores it) â€” it is required for future updates with the same app identity
- For Google sign-in in the built app: create an **Android OAuth client** in Google Cloud Console with the **SHA-1 of the EAS keystore** (shown in `eas build` output / `eas credentials`) and paste the client ID into `src/config.ts`
- Push notifications work in the standalone APK via the Expo push service (no FCM project needed)

## Related
- mventor-ticket-040 (features this build ships)
