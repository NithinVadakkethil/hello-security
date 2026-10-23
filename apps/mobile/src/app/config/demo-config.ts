/**
 * Hello Orbit Mobile Feature Configuration
 *
 * Supported Profiles:
 * - 'full': Complete Hello Orbit mobile suite (Snag Reporting, Maintenance Job Tab, Incident Reporting, Face Verification, Attendance).
 *   Targeted for Demo testing and full-feature deployments.
 * - 'kaizen': Operational set approved for Kaizen (Incidents & Snags hidden, Attendance & Face Verification active).
 *   Targeted for Kaizen production builds.
 */

import { Config } from './index';

declare const process: { env?: Record<string, string | undefined> } | undefined;
declare const __DEV__: boolean | undefined;

export type FeatureProfile = 'full' | 'kaizen';

export interface MobileFeatureFlags {
  /** Incident reporting modal and history tab in mobile */
  readonly observations: boolean;
  readonly incidents: boolean;
  /** Maintenance ticket reporting & technician jobs tab */
  readonly snags: boolean;
  readonly snagCategories: boolean;
  /** Biometric daily attendance tracking */
  readonly attendance: boolean;
  /** Biometric face registration and 1:1 SFace verification */
  readonly faceVerification: boolean;
  /** QR patrol scanning */
  readonly scanner: boolean;
}

export const MOBILE_FEATURE_PROFILES: Record<FeatureProfile, MobileFeatureFlags> = {
  full: {
    observations: true,
    incidents: true,
    snags: true,
    snagCategories: true,
    attendance: true,
    faceVerification: true,
    scanner: true,
  },
  kaizen: {
    observations: false,
    incidents: false,
    snags: false,
    snagCategories: false,
    attendance: true,
    faceVerification: true,
    scanner: true,
  },
};

/**
 * Optional compile-time override.
 * When set to 'full' or 'kaizen', this takes precedence.
 * When set to null, environment detection is used.
 */
export const MOBILE_PROFILE_OVERRIDE: FeatureProfile | null = null;

/**
 * Resolves the mobile feature profile:
 * 1. Compile-time override (MOBILE_PROFILE_OVERRIDE)
 * 2. Bundler environment variable (process.env.FEATURE_PROFILE)
 * 3. Connected API host: if pointing to demoorbit.helloentry.com, automatically 'full'
 * 4. Local development mode (__DEV__), defaults to 'full'
 * 5. Production build default: 'kaizen'
 */
export function resolveMobileFeatureProfile(): FeatureProfile {
  if (MOBILE_PROFILE_OVERRIDE) {
    return MOBILE_PROFILE_OVERRIDE;
  }

  const envProfile =
    typeof process !== 'undefined' &&
    (process.env as any)?.FEATURE_PROFILE?.trim()?.toLowerCase();
  if (envProfile === 'full' || envProfile === 'kaizen') {
    return envProfile;
  }

  if (Config?.API_URL?.includes('demoorbit')) {
    return 'full';
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'full';
  }

  return 'kaizen';
}

export const ACTIVE_MOBILE_PROFILE: FeatureProfile = resolveMobileFeatureProfile();
export const DEMO_KAIZEN_FEATURES: MobileFeatureFlags =
  MOBILE_FEATURE_PROFILES[ACTIVE_MOBILE_PROFILE];

export function isMobileFeatureEnabled(feature: keyof MobileFeatureFlags): boolean {
  return DEMO_KAIZEN_FEATURES[feature] === true;
}
