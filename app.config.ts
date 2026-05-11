import type { ExpoConfig } from '@expo/config-types';

// `deploymentTarget` is a valid Expo iOS config key enforced at build time
// but not yet reflected in @expo/config-types@54. Cast to bypass the gap.
type IOSWithDeploymentTarget = ExpoConfig['ios'] & {
  deploymentTarget?: string;
};

const iosConfig: IOSWithDeploymentTarget = {
  bundleIdentifier: 'com.kylelaguerta.questum',
  supportsTablet: false,
  deploymentTarget: '26.0',
  infoPlist: {
    ITSAppUsesNonExemptEncryption: false,
  },
};

const config: ExpoConfig = {
  name: 'Questum',
  slug: 'questum',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/questum-icon.png',
  scheme: 'questum',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/images/questum-splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0E1116',
  },
  assetBundlePatterns: ['**/*'],
  ios: iosConfig,
  plugins: ['expo-router', 'expo-font', 'expo-sqlite', 'expo-notifications'],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
