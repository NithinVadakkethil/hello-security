import * as XLSX from 'xlsx';
import { UserRole } from '@prisma/client';
import { siteImportService } from './site-import.service';
import { prisma } from '../../database/prisma';
import { siteRepository } from './site.repository';
import { AppError } from '../../common/errors/AppError';
import { counterService } from '../../common/counter/counter.service';

import { auditLogService } from '../audit-log/audit-log.service';

function createExcelBuffer(rows: any[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Checkpoints');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('SiteImportService - Automatic Category Creation & Bulk Import', () => {
  const mockSiteClientA = {
    id: 'site-peninsula-2',
    name: 'Peninsula 2',
    clientId: 'client-kaizen-peninsula',
  };

  const existingClientACategories = [
    {
      id: 'cat-corridor',
      name: 'Corridor /Floor',
      normalizedName: 'corridor /floor',
      clientId: 'client-kaizen-peninsula',
    },
    {
      id: 'cat-utility',
      name: 'Utility',
      normalizedName: 'utility',
      clientId: 'client-kaizen-peninsula',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(auditLogService, 'create').mockResolvedValue({} as any);
  });

  describe('1. Missing category is created automatically', () => {
    it('should validate missing category as VALID and auto-create it in the database during import', async () => {
      jest.spyOn(siteRepository, 'findById').mockResolvedValue(mockSiteClientA as any);
      jest.spyOn(prisma.checkpointCategory, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.gate, 'findMany').mockResolvedValue([]);

      const buffer = createExcelBuffer([
        {
          'Sequence Number': 1,
          'Checkpoint Name': 'Pump Room Alpha',
          'Floor': 'Basement 1',
          'Category / Utility': 'WM/FHR',
          'Role': 'Technician',
          'Subtask': 'Inspect pressure gauge',
        },
      ]);

      // 1. Validation phase: should be valid and report as a new category to create
      const validation = await siteImportService.validateImport(mockSiteClientA.id, buffer);
      expect(validation.validRows).toBe(1);
      expect(validation.invalidRows).toBe(0);
      expect(validation.errorCount).toBe(0);
      expect(validation.newCategoriesToCreate).toEqual(['WM/FHR']);
      expect(validation.preview[0].status).toBe('VALID');
      expect(validation.preview[0].isNewCategory).toBe(true);

      // 2. Execution phase: category is created and assigned
      const createdCategory = {
        id: 'cat-wmfhr-new',
        name: 'WM/FHR',
        normalizedName: 'wm/fhr',
        clientId: mockSiteClientA.clientId,
      };

      jest.spyOn(counterService, 'reserveRange').mockResolvedValue(100);

      const mockTx: any = {
        checkpointCategory: {
          findMany: jest.fn().mockResolvedValue([]),
          upsert: jest.fn().mockResolvedValue(createdCategory),
        },
        gate: {
          findMany: jest.fn().mockResolvedValue([]),
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn().mockResolvedValue({}),
        },
        gateSubTask: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      const executeResult = await siteImportService.executeImport(
        mockSiteClientA.id,
        buffer,
        'user-1',
        mockSiteClientA.clientId
      );

      expect(executeResult.success).toBe(true);
      expect(executeResult.checkpointsCreated).toBe(1);
      expect(executeResult.newCategoriesCreated).toContain('WM/FHR');
      expect(executeResult.newCategoriesCount).toBe(1);

      // Verify category was upserted with correct schema fields
      expect(mockTx.checkpointCategory.upsert).toHaveBeenCalledWith({
        where: {
          clientId_normalizedName: {
            clientId: mockSiteClientA.clientId,
            normalizedName: 'wm/fhr',
          },
        },
        update: {},
        create: {
          clientId: mockSiteClientA.clientId,
          name: 'WM/FHR',
          normalizedName: 'wm/fhr',
          description: null,
        },
      });

      // Verify gate was created with the newly created category ID
      expect(mockTx.gate.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            name: 'Pump Room Alpha',
            categoryId: 'cat-wmfhr-new',
          }),
        ]),
        skipDuplicates: true,
      });
    });
  });

  describe('2. Existing categories are reused', () => {
    it('should reuse existing category ID and not create duplicate category record', async () => {
      jest.spyOn(siteRepository, 'findById').mockResolvedValue(mockSiteClientA as any);
      jest.spyOn(prisma.checkpointCategory, 'findMany').mockResolvedValue(existingClientACategories as any);
      jest.spyOn(prisma.gate, 'findMany').mockResolvedValue([]);
      jest.spyOn(counterService, 'reserveRange').mockResolvedValue(101);

      const buffer = createExcelBuffer([
        {
          'Sequence Number': 1,
          'Checkpoint Name': 'Main Electrical Room',
          'Floor': 'Level 1',
          'Category / Utility': 'Utility',
          'Role': 'Technician',
          'Subtask': 'Check breakers',
        },
      ]);

      const mockTx: any = {
        checkpointCategory: {
          findMany: jest.fn().mockResolvedValue(existingClientACategories),
          upsert: jest.fn(),
        },
        gate: {
          findMany: jest.fn().mockResolvedValue([]),
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn().mockResolvedValue({}),
        },
        gateSubTask: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      const executeResult = await siteImportService.executeImport(
        mockSiteClientA.id,
        buffer,
        'user-1',
        mockSiteClientA.clientId
      );

      expect(executeResult.success).toBe(true);
      expect(executeResult.existingCategoriesReused).toContain('Utility');
      expect(executeResult.existingCategoriesCount).toBe(1);
      expect(executeResult.newCategoriesCount).toBe(0);

      // Category upsert/create should NOT be called because it already exists
      expect(mockTx.checkpointCategory.upsert).not.toHaveBeenCalled();

      // Gate created with existing category id
      expect(mockTx.gate.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            name: 'Main Electrical Room',
            categoryId: 'cat-utility',
          }),
        ]),
        skipDuplicates: true,
      });
    });
  });

  describe('3. Repeated category names create only one master record', () => {
    it('should create only one master category record when the same category appears in dozens of rows', async () => {
      jest.spyOn(siteRepository, 'findById').mockResolvedValue(mockSiteClientA as any);
      jest.spyOn(prisma.checkpointCategory, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.gate, 'findMany').mockResolvedValue([]);
      jest.spyOn(counterService, 'reserveRange').mockResolvedValue(200);

      const rows: any[] = [];
      for (let i = 1; i <= 25; i++) {
        rows.push({
          'Sequence Number': i,
          'Checkpoint Name': `Garbage Chute Floor ${i}`,
          'Floor': `Floor ${i}`,
          'Category / Utility': 'Garbage',
          'Role': 'House Keeping',
          'Subtask': 'Clear waste chute',
        });
      }

      const buffer = createExcelBuffer(rows);

      const newGarbageCategory = {
        id: 'cat-garbage-unique',
        name: 'Garbage',
        normalizedName: 'garbage',
        clientId: mockSiteClientA.clientId,
      };

      const mockTx: any = {
        checkpointCategory: {
          findMany: jest.fn().mockResolvedValue([]),
          upsert: jest.fn().mockResolvedValue(newGarbageCategory),
        },
        gate: {
          findMany: jest.fn().mockResolvedValue([]),
          createMany: jest.fn().mockResolvedValue({ count: 25 }),
          update: jest.fn().mockResolvedValue({}),
        },
        gateSubTask: {
          createMany: jest.fn().mockResolvedValue({ count: 25 }),
        },
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      const executeResult = await siteImportService.executeImport(
        mockSiteClientA.id,
        buffer,
        'user-1',
        mockSiteClientA.clientId
      );

      // Exactly 1 category master created
      expect(mockTx.checkpointCategory.upsert).toHaveBeenCalledTimes(1);
      expect(executeResult.newCategoriesCount).toBe(1);
      expect(executeResult.newCategoriesCreated).toEqual(['Garbage']);
      expect(executeResult.checkpointsCreated).toBe(25);
    });
  });

  describe('4. Multiple categories in one XLSX are handled correctly', () => {
    it('should correctly handle both existing and missing categories across multiple rows', async () => {
      jest.spyOn(siteRepository, 'findById').mockResolvedValue(mockSiteClientA as any);
      // Client has "Corridor /Floor" and "Utility", but lacks "WM/FHR" and "Wash & Pray"
      jest.spyOn(prisma.checkpointCategory, 'findMany').mockResolvedValue(existingClientACategories as any);
      jest.spyOn(prisma.gate, 'findMany').mockResolvedValue([]);
      jest.spyOn(counterService, 'reserveRange').mockResolvedValue(300);

      const buffer = createExcelBuffer([
        {
          'Sequence Number': 1,
          'Checkpoint Name': 'Main Corridor',
          'Floor': 'L1',
          'Category / Utility': 'Corridor /Floor', // Existing
          'Role': 'Security',
          'Subtask': 'Patrol',
        },
        {
          'Sequence Number': 2,
          'Checkpoint Name': 'Water Pump 1',
          'Floor': 'B1',
          'Category / Utility': 'WM/FHR', // Missing
          'Role': 'Technician',
          'Subtask': 'Check pump',
        },
        {
          'Sequence Number': 3,
          'Checkpoint Name': 'Switchboard Room',
          'Floor': 'L1',
          'Category / Utility': 'Utility', // Existing
          'Role': 'Technician',
          'Subtask': 'Inspect switchboard',
        },
        {
          'Sequence Number': 4,
          'Checkpoint Name': 'Prayer Room',
          'Floor': 'L2',
          'Category / Utility': 'Wash & Pray', // Missing
          'Role': 'Cleaner',
          'Subtask': 'Clean carpets',
        },
      ]);

      const mockTx: any = {
        checkpointCategory: {
          findMany: jest.fn().mockResolvedValue(existingClientACategories),
          upsert: jest.fn().mockImplementation((args: any) => ({
            id: `cat-${args.create.normalizedName}`,
            name: args.create.name,
            normalizedName: args.create.normalizedName,
            clientId: mockSiteClientA.clientId,
          })),
        },
        gate: {
          findMany: jest.fn().mockResolvedValue([]),
          createMany: jest.fn().mockResolvedValue({ count: 4 }),
          update: jest.fn().mockResolvedValue({}),
        },
        gateSubTask: {
          createMany: jest.fn().mockResolvedValue({ count: 4 }),
        },
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      const executeResult = await siteImportService.executeImport(
        mockSiteClientA.id,
        buffer,
        'user-1',
        mockSiteClientA.clientId
      );

      expect(executeResult.checkpointsCreated).toBe(4);
      expect(executeResult.existingCategoriesCount).toBe(2);
      expect(executeResult.existingCategoriesReused).toEqual(
        expect.arrayContaining(['Corridor /Floor', 'Utility'])
      );
      expect(executeResult.newCategoriesCount).toBe(2);
      expect(executeResult.newCategoriesCreated).toEqual(
        expect.arrayContaining(['WM/FHR', 'Wash & Pray'])
      );

      // Only the 2 missing categories were upserted
      expect(mockTx.checkpointCategory.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('5. Blank category cells follow existing business rules', () => {
    it('should import checkpoints with null categoryId and not create blank or garbage categories', async () => {
      jest.spyOn(siteRepository, 'findById').mockResolvedValue(mockSiteClientA as any);
      jest.spyOn(prisma.checkpointCategory, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.gate, 'findMany').mockResolvedValue([]);
      jest.spyOn(counterService, 'reserveRange').mockResolvedValue(400);

      const buffer = createExcelBuffer([
        {
          'Sequence Number': 1,
          'Checkpoint Name': 'Open Staircase A',
          'Floor': 'L1',
          'Category / Utility': '', // empty string
          'Role': 'Security',
          'Subtask': 'Patrol',
        },
        {
          'Sequence Number': 2,
          'Checkpoint Name': 'Open Staircase B',
          'Floor': 'L2',
          'Category / Utility': '   ', // whitespace only
          'Role': 'Security',
          'Subtask': 'Patrol',
        },
        {
          'Sequence Number': 3,
          'Checkpoint Name': 'Open Staircase C',
          'Floor': 'L3',
          'Category / Utility': 'N/A', // literal N/A string
          'Role': 'Security',
          'Subtask': 'Patrol',
        },
      ]);

      const mockTx: any = {
        checkpointCategory: {
          findMany: jest.fn().mockResolvedValue([]),
          upsert: jest.fn(),
        },
        gate: {
          findMany: jest.fn().mockResolvedValue([]),
          createMany: jest.fn().mockResolvedValue({ count: 3 }),
          update: jest.fn().mockResolvedValue({}),
        },
        gateSubTask: {
          createMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      const executeResult = await siteImportService.executeImport(
        mockSiteClientA.id,
        buffer,
        'user-1',
        mockSiteClientA.clientId
      );

      // No category master records should be created
      expect(mockTx.checkpointCategory.upsert).not.toHaveBeenCalled();
      expect(executeResult.newCategoriesCount).toBe(0);
      expect(executeResult.uncategorizedCheckpoints).toBe(3);

      // Gates created with categoryId: null
      expect(mockTx.gate.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ name: 'Open Staircase A', categoryId: null }),
          expect.objectContaining({ name: 'Open Staircase B', categoryId: null }),
          expect.objectContaining({ name: 'Open Staircase C', categoryId: null }),
        ]),
        skipDuplicates: true,
      });
    });
  });

  describe('6. Categories remain scoped to the correct client/tenant', () => {
    it('should create categories scoped strictly to site.clientId and never touch another client', async () => {
      jest.spyOn(siteRepository, 'findById').mockResolvedValue(mockSiteClientA as any);
      jest.spyOn(counterService, 'reserveRange').mockResolvedValue(500);

      const buffer = createExcelBuffer([
        {
          'Sequence Number': 1,
          'Checkpoint Name': 'Tenanted Checkpoint',
          'Floor': 'L1',
          'Category / Utility': 'Client A Specific Cat',
          'Role': 'Security',
          'Subtask': 'Patrol',
        },
      ]);

      const mockTx: any = {
        checkpointCategory: {
          findMany: jest.fn().mockResolvedValue([]),
          upsert: jest.fn().mockResolvedValue({
            id: 'cat-tenant-a',
            name: 'Client A Specific Cat',
            normalizedName: 'client a specific cat',
            clientId: mockSiteClientA.clientId,
          }),
        },
        gate: {
          findMany: jest.fn().mockResolvedValue([]),
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn().mockResolvedValue({}),
        },
        gateSubTask: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      await siteImportService.executeImport(
        mockSiteClientA.id,
        buffer,
        'user-1',
        mockSiteClientA.clientId
      );

      // Verify category creation used site.clientId
      expect(mockTx.checkpointCategory.upsert).toHaveBeenCalledWith({
        where: {
          clientId_normalizedName: {
            clientId: 'client-kaizen-peninsula',
            normalizedName: 'client a specific cat',
          },
        },
        update: {},
        create: {
          clientId: 'client-kaizen-peninsula',
          name: 'Client A Specific Cat',
          normalizedName: 'client a specific cat',
          description: null,
        },
      });
    });

    it('should reject execution if user tenantId does not match the site clientId', async () => {
      jest.spyOn(siteRepository, 'findById').mockResolvedValue(mockSiteClientA as any);

      const buffer = createExcelBuffer([
        {
          'Sequence Number': 1,
          'Checkpoint Name': 'Gate 1',
          'Floor': 'L1',
          'Category / Utility': 'Utility',
          'Role': 'Security',
          'Subtask': 'Patrol',
        },
      ]);

      await expect(
        siteImportService.executeImport(mockSiteClientA.id, buffer, 'user-1', 'DIFFERENT_CLIENT_ID')
      ).rejects.toThrow(AppError);
    });
  });

  describe('7. Failed imports follow rollback behavior and do not leave orphaned categories', () => {
    it('should rollback category creation if checkpoint or subtask insertion fails in the transaction', async () => {
      jest.spyOn(siteRepository, 'findById').mockResolvedValue(mockSiteClientA as any);
      jest.spyOn(counterService, 'reserveRange').mockResolvedValue(600);

      const buffer = createExcelBuffer([
        {
          'Sequence Number': 1,
          'Checkpoint Name': 'Gate with Failure',
          'Floor': 'L1',
          'Category / Utility': 'OrphanCandidateCategory',
          'Role': 'Security',
          'Subtask': 'Patrol',
        },
      ]);

      // Simulate a transaction failure on gate creation
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        const failingTx: any = {
          checkpointCategory: {
            findMany: jest.fn().mockResolvedValue([]),
            upsert: jest.fn().mockResolvedValue({
              id: 'cat-orphan',
              name: 'OrphanCandidateCategory',
              normalizedName: 'orphancandidatecategory',
              clientId: mockSiteClientA.clientId,
            }),
          },
          gate: {
            findMany: jest.fn().mockResolvedValue([]),
            createMany: jest.fn().mockRejectedValue(new Error('Database disk full or constraint failure')),
            update: jest.fn(),
          },
          gateSubTask: { createMany: jest.fn() },
        };
        return cb(failingTx);
      });

      await expect(
        siteImportService.executeImport(mockSiteClientA.id, buffer, 'user-1', mockSiteClientA.clientId)
      ).rejects.toThrow(AppError);
    });

    it('should not create categories if all associated rows failed validation', async () => {
      jest.spyOn(siteRepository, 'findById').mockResolvedValue(mockSiteClientA as any);

      // Rows are missing required checkpoint names and valid roles
      const buffer = createExcelBuffer([
        {
          'Sequence Number': 1,
          'Checkpoint Name': '', // missing
          'Floor': 'L1',
          'Category / Utility': 'InvalidRowCategory',
          'Role': 'InvalidRole',
          'Subtask': 'Task',
        },
      ]);

      const upsertSpy = jest.spyOn(prisma.checkpointCategory, 'upsert');

      await expect(
        siteImportService.executeImport(mockSiteClientA.id, buffer, 'user-1', mockSiteClientA.clientId)
      ).rejects.toThrow(AppError);

      expect(upsertSpy).not.toHaveBeenCalled();
    });
  });

  describe('8. Re-importing a file does not create duplicate categories', () => {
    it('should reuse all categories on subsequent import of the same file', async () => {
      jest.spyOn(siteRepository, 'findById').mockResolvedValue(mockSiteClientA as any);
      jest.spyOn(counterService, 'reserveRange').mockResolvedValue(700);

      const buffer = createExcelBuffer([
        {
          'Sequence Number': 1,
          'Checkpoint Name': 'Main Gate',
          'Floor': 'L1',
          'Category / Utility': 'Stair',
          'Role': 'Security',
          'Subtask': 'Patrol',
        },
      ]);

      // On second import, "Stair" already exists in the database
      const existingStair = {
        id: 'cat-stair-existing',
        name: 'Stair',
        normalizedName: 'stair',
        clientId: mockSiteClientA.clientId,
      };

      const mockTx: any = {
        checkpointCategory: {
          findMany: jest.fn().mockResolvedValue([existingStair]),
          upsert: jest.fn(),
        },
        gate: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'gate-existing', name: 'Main Gate', gateCode: 'GT-001', sequence: 1, subTasks: [] },
          ]),
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
          update: jest.fn().mockResolvedValue({}),
        },
        gateSubTask: {
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      const result = await siteImportService.executeImport(
        mockSiteClientA.id,
        buffer,
        'user-1',
        mockSiteClientA.clientId
      );

      expect(result.newCategoriesCount).toBe(0);
      expect(result.existingCategoriesReused).toEqual(['Stair']);
      expect(mockTx.checkpointCategory.upsert).not.toHaveBeenCalled();
    });
  });

  describe('9. Existing checkpoint IDs and QR identities remain unchanged', () => {
    it('should preserve existing checkpoint ID and QR payload and only update category', async () => {
      jest.spyOn(siteRepository, 'findById').mockResolvedValue(mockSiteClientA as any);

      const existingGate = {
        id: 'gate-permanent-id-123',
        siteId: mockSiteClientA.id,
        gateCode: 'GT-1001',
        qrCode: 'GT-1001-QR-SECRET',
        name: 'Preserved Gate Alpha',
        sequence: 1,
        categoryId: null,
        subTasks: [{ role: UserRole.SECURITY, taskName: 'Patrol' }],
      };

      const buffer = createExcelBuffer([
        {
          'Sequence Number': 1,
          'Checkpoint Name': 'Preserved Gate Alpha',
          'Floor': 'L1',
          'Category / Utility': 'Utility',
          'Role': 'Security',
          'Subtask': 'Patrol',
        },
      ]);

      const mockTx: any = {
        checkpointCategory: {
          findMany: jest.fn().mockResolvedValue(existingClientACategories),
          upsert: jest.fn(),
        },
        gate: {
          findMany: jest.fn().mockResolvedValue([existingGate]),
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
          update: jest.fn().mockResolvedValue({}),
        },
        gateSubTask: {
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      const result = await siteImportService.executeImport(
        mockSiteClientA.id,
        buffer,
        'user-1',
        mockSiteClientA.clientId
      );

      expect(result.checkpointsCreated).toBe(0); // No new gate created!

      // Verify that existing gate was updated ONLY for categoryId, and its ID / QR code was untouched
      expect(mockTx.gate.update).toHaveBeenCalledWith({
        where: { id: 'gate-permanent-id-123' },
        data: { categoryId: 'cat-utility' },
      });
      expect(mockTx.gate.createMany).not.toHaveBeenCalled();
    });
  });

  describe('10. Exported checkpoint spreadsheet can be re-imported successfully for the same client', () => {
    it('should export site checkpoints and validate the exported file with 100% success', async () => {
      const siteGates = [
        {
          id: 'gate-1',
          siteId: mockSiteClientA.id,
          name: 'Main Lobby',
          sequence: 1,
          description: 'Ground Floor',
          latitude: 25.123,
          longitude: 55.456,
          categoryId: 'cat-corridor',
          category: {
            id: 'cat-corridor',
            name: 'Corridor /Floor',
          },
        },
        {
          id: 'gate-2',
          siteId: mockSiteClientA.id,
          name: 'Service Lift',
          sequence: 2,
          description: 'Basement',
          latitude: 25.124,
          longitude: 55.457,
          categoryId: 'cat-utility',
          category: {
            id: 'cat-utility',
            name: 'Utility',
          },
        },
      ];

      jest.spyOn(prisma.gate, 'findMany').mockResolvedValue(siteGates as any);

      // Export template
      const exportResult = await siteImportService.generateTemplateBuffer(mockSiteClientA.id);
      expect(exportResult.checkpointCount).toBe(2);

      // Validate exported buffer
      jest.spyOn(siteRepository, 'findById').mockResolvedValue(mockSiteClientA as any);
      jest.spyOn(prisma.checkpointCategory, 'findMany').mockResolvedValue(existingClientACategories as any);
      jest.spyOn(prisma.gate, 'findMany').mockResolvedValue([
        { id: 'gate-1', name: 'Main Lobby', gateCode: 'GT-1', sequence: 1, subTasks: [] },
        { id: 'gate-2', name: 'Service Lift', gateCode: 'GT-2', sequence: 2, subTasks: [] },
      ] as any);

      const validation = await siteImportService.validateImport(mockSiteClientA.id, exportResult.buffer);

      expect(validation.totalRows).toBe(2);
      expect(validation.validRows).toBe(2);
      expect(validation.invalidRows).toBe(0);
      expect(validation.errorCount).toBe(0);
      expect(validation.existingCategoriesReused).toEqual(
        expect.arrayContaining(['Corridor /Floor', 'Utility'])
      );
      expect(validation.preview[0].status).toBe('VALID');
      expect(validation.preview[1].status).toBe('VALID');
    });
  });
});
