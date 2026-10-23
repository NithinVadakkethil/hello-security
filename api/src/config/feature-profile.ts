/**
 * Hello Orbit Backend Feature Configuration
 *
 * Supported Profiles:
 * - 'full': Exposes all backend modules (Snags, Incidents/Observations, Maintenance, Attendance, Face Verification).
 *   Targeted for Demo environment and local development.
 * - 'kaizen': Enforces Kaizen operational boundary (Snags, Incidents disabled/hidden; Attendance & Face Verification enabled).
 *   Targeted for Kaizen production.
 */

export type FeatureProfile = 'full' | 'kaizen';

export type ApiFeatureKey =
  | 'observations'
  | 'incidents'
  | 'snags'
  | 'snagCategories'
  | 'maintenance'
  | 'attendance'
  | 'faceVerification';

export interface ApiFeatureFlags {
  readonly observations: boolean;
  readonly incidents: boolean;
  readonly snags: boolean;
  readonly snagCategories: boolean;
  readonly maintenance: boolean;
  readonly attendance: boolean;
  readonly faceVerification: boolean;
}

export const API_FEATURE_PROFILES: Record<FeatureProfile, ApiFeatureFlags> = {
  full: {
    observations: true,
    incidents: true,
    snags: true,
    snagCategories: true,
    maintenance: true,
    attendance: true,
    faceVerification: true,
  },
  kaizen: {
    observations: false,
    incidents: false,
    snags: false,
    snagCategories: false,
    maintenance: false,
    attendance: true,
    faceVerification: true,
  },
};

/**
 * Resolves the backend feature profile.
 * Precedence:
 * 1. process.env.FEATURE_PROFILE ('full' | 'kaizen')
 * 2. In non-production (development | test), defaults to 'full'
 * 3. In production, defaults to 'kaizen'
 */
export function getApiFeatureProfile(): FeatureProfile {
  const envProfile = process.env.FEATURE_PROFILE?.trim().toLowerCase();
  if (envProfile === 'full' || envProfile === 'kaizen') {
    return envProfile;
  }
  if (process.env.NODE_ENV !== 'production') {
    return 'full';
  }
  return 'kaizen';
}

export function getFeatureFlags(): ApiFeatureFlags {
  return API_FEATURE_PROFILES[getApiFeatureProfile()];
}

export function isApiFeatureEnabled(feature: ApiFeatureKey): boolean {
  return getFeatureFlags()[feature] === true;
}
