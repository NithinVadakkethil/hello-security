import { getEmployeeDisplayName } from '../apps/mobile/src/app/utils/user-helpers';

console.log('=== TESTING EMPLOYEE DISPLAY NAME RESOLUTION ===');

// Test 1: Sulav Kunwar
const sulavUser = {
  id: 'cmt6wyq25001hhpypt9437k7l',
  email: 'sulav.peninsula1@helloorbit.com',
  role: 'SECURITY',
  firstName: 'Sulav',
  lastName: 'Kunwar',
};
console.log('Test 1 (Sulav Kunwar):', getEmployeeDisplayName(sulavUser));
if (getEmployeeDisplayName(sulavUser) !== 'Sulav Kunwar') {
  throw new Error('Test 1 failed!');
}

// Test 2: Security Guard with employee object
const guardUser = {
  id: 'user123',
  email: 'john.guard@helloorbit.com',
  employee: {
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
  },
};
console.log('Test 2 (John Doe):', getEmployeeDisplayName(guardUser));
if (getEmployeeDisplayName(guardUser) !== 'John Doe') {
  throw new Error('Test 2 failed!');
}

// Test 3: Technician
const techUser = {
  id: 'user456',
  email: 'alex.tech@helloorbit.com',
  firstName: 'Alex',
  lastName: 'Smith',
};
console.log('Test 3 (Alex Smith):', getEmployeeDisplayName(techUser));
if (getEmployeeDisplayName(techUser) !== 'Alex Smith') {
  throw new Error('Test 3 failed!');
}

// Test 4: House Keeping
const hkUser = {
  id: 'user789',
  email: 'mary.hk@helloorbit.com',
  employee: {
    firstName: 'Mary',
    lastName: 'Jane',
  },
};
console.log('Test 4 (Mary Jane):', getEmployeeDisplayName(hkUser));
if (getEmployeeDisplayName(hkUser) !== 'Mary Jane') {
  throw new Error('Test 4 failed!');
}

// Test 5: Missing name fallback
const missingNameUser = {
  id: 'user999',
  email: 'anonymous.employee@helloorbit.com',
};
console.log('Test 5 (Missing name fallback):', getEmployeeDisplayName(missingNameUser));
if (getEmployeeDisplayName(missingNameUser) !== 'anonymous.employee') {
  throw new Error('Test 5 failed!');
}

// Test 6: Null user
console.log('Test 6 (Null user):', getEmployeeDisplayName(null));
if (getEmployeeDisplayName(null) !== 'User') {
  throw new Error('Test 6 failed!');
}

console.log('=== ALL EMPLOYEE DISPLAY NAME TESTS PASSED 100% ===');
