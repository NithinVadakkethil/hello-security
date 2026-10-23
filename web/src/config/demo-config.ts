/**
 * Hello Orbit Multi-Tenant Feature Configuration
 *
 * Supported Profiles:
 * - 'full': Complete Hello Orbit product suite with all 21 modules enabled.
 *   Targeted for Demo server (https://demoorbit.helloentry.com/) and local dev.
 * - 'kaizen': Scoped operational set approved specifically for Kaizen.
 *   Targeted for Kaizen production (https://orbit.helloentry.com/).
 *
 * Enforced at build-time and runtime via NEXT_PUBLIC_FEATURE_PROFILE environment variable.
 */

export type FeatureProfile = 'full' | 'kaizen';

declare const process: { env: Record<string, string | undefined> };

export interface ProductFeatureFlags {
  /** Observation and incident reporting portal & statistics */
  readonly observations: boolean;
  /** Mobile incident reporting and history */
  readonly incidents: boolean;
  /** Maintenance ticket / snag logging, assignment, and completion */
  readonly snags: boolean;
  /** Maintenance category taxonomy master */
  readonly snagCategories: boolean;
  /** Technician workflows & assigned work tab */
  readonly maintenance: boolean;
  /** Daily biometric check-in & attendance tracking */
  readonly attendance: boolean;
  /** Biometric face registration and verification */
  readonly faceVerification: boolean;
  /** Patrol routes, scheduling, and mandatory sweeps */
  readonly patrols: boolean;
  /** QR checkpoint scanning and thermal label printing */
  readonly checkpoints: boolean;
  /** Checkpoint subtask inspection workflows */
  readonly inspections: boolean;
  /** Printable summary reports, periodic PDFs, and Excel export */
  readonly reports: boolean;
  /** Centralized multi-client management portal (/central) */
  readonly centralManager: boolean;
}

export const FEATURE_PROFILES: Record<FeatureProfile, ProductFeatureFlags> = {
  full: {
    observations: true,
    incidents: true,
    snags: true,
    snagCategories: true,
    maintenance: true,
    attendance: true,
    faceVerification: true,
    patrols: true,
    checkpoints: true,
    inspections: true,
    reports: true,
    centralManager: true,
  },
  kaizen: {
    observations: false,
    incidents: false,
    snags: false,
    snagCategories: false,
    maintenance: false,
    attendance: true,
    faceVerification: true,
    patrols: true,
    checkpoints: true,
    inspections: true,
    reports: true,
    centralManager: true,
  },
};

/**
 * Resolves the active feature profile for the web frontend.
 * Hierarchy:
 * 1. process.env.NEXT_PUBLIC_FEATURE_PROFILE (explicit 'full' | 'kaizen')
 * 2. In non-production (development / test), defaults to 'full' for developer productivity.
 * 3. In production, defaults to 'kaizen' to maintain backward compatibility unless explicitly set to 'full'.
 */
export function resolveFeatureProfile(): FeatureProfile {
  const envProfile = process.env.NEXT_PUBLIC_FEATURE_PROFILE?.trim().toLowerCase();
  if (envProfile === 'full' || envProfile === 'kaizen') {
    return envProfile;
  }
  if (process.env.NODE_ENV !== 'production') {
    return 'full';
  }
  return 'kaizen';
}

export const ACTIVE_FEATURE_PROFILE: FeatureProfile = resolveFeatureProfile();
export const DEMO_KAIZEN_FEATURES: ProductFeatureFlags = FEATURE_PROFILES[ACTIVE_FEATURE_PROFILE];

/**
 * Helper to query whether a specific feature is enabled in the current runtime.
 */
export function isFeatureEnabled(feature: keyof ProductFeatureFlags): boolean {
  return DEMO_KAIZEN_FEATURES[feature] === true;
}
