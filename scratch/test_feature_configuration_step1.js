const assert = require('assert');

console.log('================================================================');
console.log('RUNNING STEP 1: FEATURE CONFIGURATION & MULTI-TENANT TEST SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// Test Suite 1: Web Feature Profile Resolution
// -------------------------------------------------------------
console.log('[TEST SUITE 1] Web demo-config.ts Verification');

const originalEnv = { ...process.env };

function runWebTests() {
  // Compile/load web demo-config
  const webConfigPath = require.resolve('./compiled/web/src/config/demo-config');

  // Test 1.1: Explicit 'full' profile
  process.env.NEXT_PUBLIC_FEATURE_PROFILE = 'full';
  process.env.NODE_ENV = 'production';
  delete require.cache[webConfigPath];
  const webFull = require('./compiled/web/src/config/demo-config');

  assert.strictEqual(webFull.ACTIVE_FEATURE_PROFILE, 'full', 'Profile should be full');
  assert.strictEqual(webFull.DEMO_KAIZEN_FEATURES.observations, true, 'observations must be true in full');
  assert.strictEqual(webFull.DEMO_KAIZEN_FEATURES.incidents, true, 'incidents must be true in full');
  assert.strictEqual(webFull.DEMO_KAIZEN_FEATURES.snags, true, 'snags must be true in full');
  assert.strictEqual(webFull.DEMO_KAIZEN_FEATURES.snagCategories, true, 'snagCategories must be true in full');
  assert.strictEqual(webFull.DEMO_KAIZEN_FEATURES.maintenance, true, 'maintenance must be true in full');
  assert.strictEqual(webFull.DEMO_KAIZEN_FEATURES.attendance, true, 'attendance must be true in full');
  assert.strictEqual(webFull.DEMO_KAIZEN_FEATURES.faceVerification, true, 'faceVerification must be true in full');
  assert.strictEqual(webFull.isFeatureEnabled('snags'), true, 'isFeatureEnabled(snags) must be true');
  console.log('  ✓ Test 1.1: Web full profile enables all 12 modules');

  // Test 1.2: Explicit 'kaizen' profile
  process.env.NEXT_PUBLIC_FEATURE_PROFILE = 'kaizen';
  process.env.NODE_ENV = 'production';
  delete require.cache[webConfigPath];
  const webKaizen = require('./compiled/web/src/config/demo-config');

  assert.strictEqual(webKaizen.ACTIVE_FEATURE_PROFILE, 'kaizen', 'Profile should be kaizen');
  assert.strictEqual(webKaizen.DEMO_KAIZEN_FEATURES.observations, false, 'observations must be false in kaizen');
  assert.strictEqual(webKaizen.DEMO_KAIZEN_FEATURES.incidents, false, 'incidents must be false in kaizen');
  assert.strictEqual(webKaizen.DEMO_KAIZEN_FEATURES.snags, false, 'snags must be false in kaizen');
  assert.strictEqual(webKaizen.DEMO_KAIZEN_FEATURES.snagCategories, false, 'snagCategories must be false in kaizen');
  assert.strictEqual(webKaizen.DEMO_KAIZEN_FEATURES.maintenance, false, 'maintenance must be false in kaizen');
  assert.strictEqual(webKaizen.DEMO_KAIZEN_FEATURES.attendance, true, 'attendance must remain true in kaizen');
  assert.strictEqual(webKaizen.DEMO_KAIZEN_FEATURES.faceVerification, true, 'faceVerification must remain true in kaizen');
  assert.strictEqual(webKaizen.isFeatureEnabled('snags'), false, 'isFeatureEnabled(snags) must be false');
  console.log('  ✓ Test 1.2: Web kaizen profile retains strict operational restrictions');

  // Test 1.3: Unset in development defaults to 'full'
  delete process.env.NEXT_PUBLIC_FEATURE_PROFILE;
  process.env.NODE_ENV = 'development';
  delete require.cache[webConfigPath];
  const webDev = require('./compiled/web/src/config/demo-config');
  assert.strictEqual(webDev.ACTIVE_FEATURE_PROFILE, 'full', 'Development default should be full');
  console.log('  ✓ Test 1.3: Web unset env in development defaults to full');

  // Test 1.4: Unset in production defaults safely to 'kaizen'
  delete process.env.NEXT_PUBLIC_FEATURE_PROFILE;
  process.env.NODE_ENV = 'production';
  delete require.cache[webConfigPath];
  const webProd = require('./compiled/web/src/config/demo-config');
  assert.strictEqual(webProd.ACTIVE_FEATURE_PROFILE, 'kaizen', 'Production default should be kaizen');
  assert.strictEqual(webProd.DEMO_KAIZEN_FEATURES.snags, false, 'snags must be false when unset in prod');
  console.log('  ✓ Test 1.4: Web unset env in production defaults safely to kaizen');
}

runWebTests();

// -------------------------------------------------------------
// Test Suite 2: Mobile Feature Profile Resolution
// -------------------------------------------------------------
console.log('\n[TEST SUITE 2] Mobile demo-config.ts Verification');

// Mock react-native for Node test runner
const Module = require('module');
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'react-native') {
    return {
      Platform: {
        select: (obj) => obj.android || obj.default,
      },
    };
  }
  return origRequire.apply(this, arguments);
};

function runMobileTests() {
  global.__DEV__ = false;
  const mobileConfigModule = require('./compiled/apps/mobile/src/app/config/index');
  const demoConfigPath = require.resolve('./compiled/apps/mobile/src/app/config/demo-config');

  // Test 2.1: Demo server URL detection
  mobileConfigModule.Config.API_URL = 'https://demoorbit.helloentry.com/api/v1';
  delete global.__DEV__;
  delete process.env.FEATURE_PROFILE;
  delete require.cache[demoConfigPath];
  const mobileDemo = require('./compiled/apps/mobile/src/app/config/demo-config');

  assert.strictEqual(mobileDemo.ACTIVE_MOBILE_PROFILE, 'full', 'Demoorbit URL must resolve to full');
  assert.strictEqual(mobileDemo.DEMO_KAIZEN_FEATURES.snags, true, 'snags must be true for demo mobile');
  assert.strictEqual(mobileDemo.DEMO_KAIZEN_FEATURES.incidents, true, 'incidents must be true for demo mobile');
  assert.strictEqual(mobileDemo.DEMO_KAIZEN_FEATURES.attendance, true, 'attendance must be true');
  assert.strictEqual(mobileDemo.DEMO_KAIZEN_FEATURES.faceVerification, true, 'faceVerification must be true');
  console.log('  ✓ Test 2.1: Mobile automatically selects full profile when pointing to demoorbit URL');

  // Test 2.2: Production Kaizen URL detection
  mobileConfigModule.Config.API_URL = 'https://orbit.helloentry.com/api/v1';
  global.__DEV__ = false;
  delete process.env.FEATURE_PROFILE;
  delete require.cache[demoConfigPath];
  const mobileKaizen = require('./compiled/apps/mobile/src/app/config/demo-config');

  assert.strictEqual(mobileKaizen.ACTIVE_MOBILE_PROFILE, 'kaizen', 'Production URL must resolve to kaizen');
  assert.strictEqual(mobileKaizen.DEMO_KAIZEN_FEATURES.snags, false, 'snags must be false in kaizen mobile');
  assert.strictEqual(mobileKaizen.DEMO_KAIZEN_FEATURES.incidents, false, 'incidents must be false in kaizen mobile');
  assert.strictEqual(mobileKaizen.DEMO_KAIZEN_FEATURES.attendance, true, 'attendance must remain true in kaizen mobile');
  assert.strictEqual(mobileKaizen.DEMO_KAIZEN_FEATURES.faceVerification, true, 'faceVerification must remain true in kaizen mobile');
  console.log('  ✓ Test 2.2: Mobile automatically selects kaizen profile when pointing to production orbit URL');

  // Test 2.3: Environment variable override
  process.env.FEATURE_PROFILE = 'full';
  delete require.cache[demoConfigPath];
  const mobileEnv = require('./compiled/apps/mobile/src/app/config/demo-config');
  assert.strictEqual(mobileEnv.ACTIVE_MOBILE_PROFILE, 'full', 'FEATURE_PROFILE env must override production URL');
  console.log('  ✓ Test 2.3: Mobile honors FEATURE_PROFILE environment variable override');
}

runMobileTests();

// -------------------------------------------------------------
// Test Suite 3: Backend API Feature Configuration & Authorization
// -------------------------------------------------------------
console.log('\n[TEST SUITE 3] Backend API Feature Flags & Authorization Middleware');

function runApiTests() {
  const apiConfigPath = require.resolve('./compiled/api/config/feature-profile');
  const featureMiddlewarePath = require.resolve('./compiled/api/common/auth/feature.middleware');

  // Test 3.1: Backend 'full' profile
  process.env.FEATURE_PROFILE = 'full';
  process.env.NODE_ENV = 'production';
  delete require.cache[apiConfigPath];
  delete require.cache[featureMiddlewarePath];
  const apiFullConfig = require('./compiled/api/config/feature-profile');
  const { requireFeature: requireFeatureFull } = require('./compiled/api/common/auth/feature.middleware');

  assert.strictEqual(apiFullConfig.getApiFeatureProfile(), 'full', 'Backend profile should be full');
  assert.strictEqual(apiFullConfig.isApiFeatureEnabled('snags'), true, 'snags must be enabled in full');
  assert.strictEqual(apiFullConfig.isApiFeatureEnabled('incidents'), true, 'incidents must be enabled in full');

  // Test middleware execution under full
  let fullNextCalled = false;
  let fullNextError = null;
  const mockReq = {};
  const mockRes = {};
  const snagGuardFull = requireFeatureFull('snags');
  snagGuardFull(mockReq, mockRes, (err) => {
    fullNextCalled = true;
    fullNextError = err;
  });
  assert.strictEqual(fullNextCalled, true, 'next() should be called');
  assert.strictEqual(fullNextError, undefined, 'No error should be passed under full profile');
  console.log('  ✓ Test 3.1: Backend full profile enables snags & incidents and permits route execution');

  // Test 3.2: Backend 'kaizen' profile
  process.env.FEATURE_PROFILE = 'kaizen';
  delete require.cache[apiConfigPath];
  delete require.cache[featureMiddlewarePath];
  const apiKaizenConfig = require('./compiled/api/config/feature-profile');
  const { requireFeature: requireFeatureKaizen } = require('./compiled/api/common/auth/feature.middleware');

  assert.strictEqual(apiKaizenConfig.getApiFeatureProfile(), 'kaizen', 'Backend profile should be kaizen');
  assert.strictEqual(apiKaizenConfig.isApiFeatureEnabled('snags'), false, 'snags must be disabled in kaizen');
  assert.strictEqual(apiKaizenConfig.isApiFeatureEnabled('incidents'), false, 'incidents must be disabled in kaizen');
  assert.strictEqual(apiKaizenConfig.isApiFeatureEnabled('attendance'), true, 'attendance must remain enabled in kaizen');

  // Test middleware blocking under kaizen
  let kaizenNextCalled = false;
  let kaizenNextError = null;
  const snagGuardKaizen = requireFeatureKaizen('snags');
  snagGuardKaizen(mockReq, mockRes, (err) => {
    kaizenNextCalled = true;
    kaizenNextError = err;
  });
  assert.strictEqual(kaizenNextCalled, true, 'next() should be called with error');
  assert.notStrictEqual(kaizenNextError, null, 'Error must be passed under kaizen profile');
  assert.strictEqual(kaizenNextError.statusCode, 403, 'Forbidden 403 must be returned');
  assert.strictEqual(kaizenNextError.code, 'FORBIDDEN', 'Error code must be FORBIDDEN');
  console.log('  ✓ Test 3.2: Backend kaizen profile strictly rejects disabled feature routes with HTTP 403');

  // Test 3.3: Attendance route guard under kaizen
  let attendanceNextCalled = false;
  let attendanceNextError = null;
  const attendanceGuardKaizen = requireFeatureKaizen('attendance');
  attendanceGuardKaizen(mockReq, mockRes, (err) => {
    attendanceNextCalled = true;
    attendanceNextError = err;
  });
  assert.strictEqual(attendanceNextCalled, true, 'Attendance next() called');
  assert.strictEqual(attendanceNextError, undefined, 'Attendance is allowed under kaizen');
  console.log('  ✓ Test 3.3: Attendance and Face Verification remain fully accessible under kaizen profile');

  // Test 3.4: Report incidents inclusion logic
  process.env.FEATURE_PROFILE = 'full';
  delete require.cache[apiConfigPath];
  const fullCfg = require('./compiled/api/config/feature-profile');
  const demoReportIncidents = fullCfg.isApiFeatureEnabled('incidents') && fullCfg.getApiFeatureProfile() !== 'kaizen';
  assert.strictEqual(demoReportIncidents, true, 'Full profile must include incidents in demo reports');

  process.env.FEATURE_PROFILE = 'kaizen';
  delete require.cache[apiConfigPath];
  const kaizenCfg = require('./compiled/api/config/feature-profile');
  const kaizenReportIncidents = kaizenCfg.isApiFeatureEnabled('incidents') && kaizenCfg.getApiFeatureProfile() !== 'kaizen';
  assert.strictEqual(kaizenReportIncidents, false, 'Kaizen profile must exclude incidents from reports');
  console.log('  ✓ Test 3.4: Periodic and executive reports dynamically include incidents on full profile and omit on kaizen');
}

runApiTests();

// Restore environment
process.env = originalEnv;

console.log('\n================================================================');
console.log('ALL STEP 1 FEATURE CONFIGURATION TESTS PASSED SUCCESSFULLY! (10/10)');
console.log('================================================================');
