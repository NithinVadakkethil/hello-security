const { z } = require('zod');

const EmployeeStatus = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' };
const IdentificationMethod = { QR: 'QR', RFID: 'RFID' };
const UserRole = { TECHNICIAN: 'TECHNICIAN', SECURITY: 'SECURITY', CLEANER: 'CLEANER' };

const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().nullable().optional(),

  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email address'),

  phone: z.string().trim().nullable().optional(),

  designation: z.string().trim().nullable().optional(),

  joiningDate: z.coerce.date().nullable().optional(),

  identificationMethod: z
    .nativeEnum(IdentificationMethod)
    .default(IdentificationMethod.QR),

  role: z.nativeEnum(UserRole),
});

const updateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).optional(),

  lastName: z.string().trim().nullable().optional(),

  phone: z.string().trim().nullable().optional(),

  designation: z.string().trim().nullable().optional(),

  joiningDate: z.coerce.date().nullable().optional(),

  status: z.nativeEnum(EmployeeStatus).optional(),
  role: z.nativeEnum(UserRole).optional(),
});

function runSchemaTests() {
  console.log('=== TESTING EMPLOYEE SCHEMA NULL & OPTIONAL LASTNAME VALIDATION ===\n');

  // Test 1: updateEmployeeSchema with lastName = null
  const payloadNullLastName = {
    firstName: 'Jonson',
    lastName: null,
    phone: null,
    role: 'TECHNICIAN',
  };

  const res1 = updateEmployeeSchema.safeParse(payloadNullLastName);
  console.log('Test 1 - Update with lastName: null:', res1.success ? '✅ PASSED' : `❌ FAILED: ${JSON.stringify(res1.error?.format())}`);
  if (!res1.success) throw new Error('updateEmployeeSchema rejected null lastName!');

  // Test 2: updateEmployeeSchema with lastName = undefined
  const payloadUndefinedLastName = {
    firstName: 'Jonson',
    role: 'TECHNICIAN',
  };
  const res2 = updateEmployeeSchema.safeParse(payloadUndefinedLastName);
  console.log('Test 2 - Update with lastName: undefined:', res2.success ? '✅ PASSED' : `❌ FAILED: ${JSON.stringify(res2.error?.format())}`);
  if (!res2.success) throw new Error('updateEmployeeSchema rejected undefined lastName!');

  // Test 3: updateEmployeeSchema with lastName = "Peninsula"
  const payloadStringLastName = {
    firstName: 'Jonson',
    lastName: 'Peninsula',
    role: 'TECHNICIAN',
  };
  const res3 = updateEmployeeSchema.safeParse(payloadStringLastName);
  console.log('Test 3 - Update with string lastName:', res3.success ? '✅ PASSED' : `❌ FAILED: ${JSON.stringify(res3.error?.format())}`);
  if (!res3.success) throw new Error('updateEmployeeSchema rejected string lastName!');

  // Test 4: createEmployeeSchema with null lastName
  const createPayloadNullLastName = {
    firstName: 'Jonson',
    lastName: null,
    email: 'jonson.test@helloorbit.com',
    role: 'TECHNICIAN',
  };
  const res4 = createEmployeeSchema.safeParse(createPayloadNullLastName);
  console.log('Test 4 - Create with lastName: null:', res4.success ? '✅ PASSED' : `❌ FAILED: ${JSON.stringify(res4.error?.format())}`);
  if (!res4.success) throw new Error('createEmployeeSchema rejected null lastName!');

  console.log('\n🎉 ALL EMPLOYEE SCHEMA NULL VALIDATION TESTS PASSED!');
}

runSchemaTests();
