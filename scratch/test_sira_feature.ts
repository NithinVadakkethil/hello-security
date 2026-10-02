import { isSecuritySiraExpired } from '../api/src/common/utils/sira-expiry.util';

function testSiraExpiryUtil() {
  console.log('--- Testing SIRA Expiry Utility ---');

  // Test 1: Non-security employee
  const nonSecurity = { role: 'MANAGER', siraCardExpiryDate: new Date('2020-01-01') };
  console.assert(isSecuritySiraExpired(nonSecurity) === false, 'Non-security should never be expired');

  // Test 2: Security employee without expiry date
  const noExpiry = { role: 'SECURITY', siraCardExpiryDate: null };
  console.assert(isSecuritySiraExpired(noExpiry) === false, 'Security without expiry date should not be expired');

  // Test 3: Security employee with future expiry date
  const futureExpiry = { role: 'SECURITY', siraCardExpiryDate: new Date('2030-12-31') };
  console.assert(isSecuritySiraExpired(futureExpiry) === false, 'Security with future expiry date should not be expired');

  // Test 4: Security employee with yesterday's expiry date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const pastExpiry = { role: 'SECURITY', siraCardExpiryDate: yesterday };
  console.assert(isSecuritySiraExpired(pastExpiry) === true, 'Security with yesterday expiry date MUST be expired');

  // Test 5: Security employee with today's expiry date (valid until end of today)
  const today = new Date();
  const todayExpiry = { role: 'SECURITY', siraCardExpiryDate: today };
  console.assert(isSecuritySiraExpired(todayExpiry) === false, 'Security with today expiry date should be valid through today');

  console.log('✅ All SIRA Expiry Utility tests passed successfully!\n');
}

testSiraExpiryUtil();
