# FarmAROI Stock - Android Application

This is an Android wrapper application for the FarmAROI Stock Management System. The app provides a native Android experience while loading the web application from https://stock.farmaroi.net.

## Features

- 🚀 Native Android app with WebView wrapper
- 🎨 Custom app icon and splash screen
- 📱 Full-screen browsing experience
- 🔄 Back button navigation support
- 💾 Offline support through PWA capabilities
- 📥 File download support
- 🔒 Secure HTTPS connection

## Requirements

### For Building
- **JDK 8 or higher** (Java Development Kit)
- **Android Studio** (recommended) OR **Android SDK Command-line Tools**
- **Gradle** (included via wrapper script)

### For Running
- Android device or emulator running **Android 8.0 (API 26) or higher**

## Quick Start

### Option 1: Build with Android Studio (Recommended)

1. **Open the project**:
   - Launch Android Studio
   - Click "Open an Existing Project"
   - Navigate to and select the `android-app` directory

2. **Sync and Build**:
   - Android Studio will automatically sync Gradle files
   - Wait for the sync to complete
   - Click **Build > Build Bundle(s) / APK(s) > Build APK(s)**

3. **Locate the APK**:
   - Once built, click "locate" in the notification
   - Or find it at: `android-app/app/build/outputs/apk/debug/app-debug.apk`

### Option 2: Build from Command Line

1. **Navigate to the project directory**:
   ```bash
   cd android-app
   ```

2. **Build the debug APK**:
   ```bash
   ./gradlew assembleDebug
   ```

3. **Or build the release APK** (unsigned):
   ```bash
   ./gradlew assembleRelease
   ```

4. **Find your APK**:
   - Debug: `app/build/outputs/apk/debug/app-debug.apk`
   - Release: `app/build/outputs/apk/release/app-release-unsigned.apk`

## Installation

### Install on Physical Device

1. **Enable Developer Options** on your Android device:
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times

2. **Enable USB Debugging**:
   - Go to Settings > Developer Options
   - Enable "USB Debugging"

3. **Transfer and Install**:
   - Transfer the APK to your device
   - Open the APK file and tap "Install"
   - You may need to allow "Install from Unknown Sources"

### Install on Emulator

1. **Using Android Studio**:
   - Click **Run > Run 'app'**
   - Select your emulator from the device list

2. **Using ADB**:
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

## Signing the APK for Release

To generate a signed APK for distribution:

1. **Create a keystore** (first time only):
   ```bash
   keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
   ```

2. **Update `app/build.gradle`** to include signing config:
   ```gradle
   android {
       signingConfigs {
           release {
               storeFile file("path/to/my-release-key.jks")
               storePassword "your-store-password"
               keyAlias "my-key-alias"
               keyPassword "your-key-password"
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               // ... other configs
           }
       }
   }
   ```

3. **Build signed APK**:
   ```bash
   ./gradlew assembleRelease
   ```

## Project Structure

```
android-app/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── java/net/farmaroi/stock/
│   │       │   ├── MainActivity.kt          # Main WebView activity
│   │       │   └── SplashActivity.kt        # Splash screen
│   │       ├── res/
│   │       │   ├── layout/
│   │       │   │   └── activity_main.xml    # Main layout
│   │       │   ├── values/
│   │       │   │   ├── strings.xml          # App strings
│   │       │   │   ├── colors.xml           # Color definitions
│   │       │   │   └── styles.xml           # App themes
│   │       │   ├── drawable/
│   │       │   │   └── splash_background.xml
│   │       │   └── mipmap-*/                # App icons (all densities)
│   │       └── AndroidManifest.xml          # App manifest
│   ├── build.gradle                         # App-level build config
│   └── proguard-rules.pro                   # ProGuard rules
├── gradle/
│   └── wrapper/
│       └── gradle-wrapper.properties        # Gradle wrapper config
├── build.gradle                             # Project-level build config
├── settings.gradle                          # Project settings
└── gradlew                                  # Gradle wrapper script (Unix)
```

## Customization

### Change App Name
Edit `app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">Your App Name</string>
```

### Change URL
Edit `app/src/main/java/net/farmaroi/stock/MainActivity.kt`:
```kotlin
companion object {
    private const val URL = "https://your-url.com"
}
```

### Change Colors
Edit `app/src/main/res/values/colors.xml` to match your branding.

### Update Icons
Replace icon files in `app/src/main/res/mipmap-*` directories with your own icons.

## Troubleshooting

### Build fails with "SDK not found"
- Install Android SDK via Android Studio
- Or set `ANDROID_HOME` environment variable:
  ```bash
  export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
  ```

### "Gradle sync failed"
- Check your internet connection
- Try **File > Invalidate Caches / Restart** in Android Studio

### WebView not loading
- Ensure you have an active internet connection
- Check the URL in `MainActivity.kt` is correct
- Verify INTERNET permission is in `AndroidManifest.xml`

### App crashes on launch
- Check minimum Android version (API 26+)
- Review Android Studio Logcat for error messages

## Testing Checklist

- [ ] App installs successfully
- [ ] Splash screen displays correctly
- [ ] Website loads in WebView
- [ ] Navigation works (back button)
- [ ] Login/authentication functions properly
- [ ] All web app features work as expected
- [ ] Downloads work (if applicable)
- [ ] App icon appears correctly on home screen

## Publishing to Google Play Store

1. Generate a signed release APK (see "Signing the APK" above)
2. Create a Google Play Developer account ($25 one-time fee)
3. Prepare store listing (screenshots, description, etc.)
4. Upload your signed APK
5. Complete the questionnaire and submit for review

## License

This Android wrapper is part of the FarmAROI Stock Management System.

## Support

For issues or questions, please contact your development team.
