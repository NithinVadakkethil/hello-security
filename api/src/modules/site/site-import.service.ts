import * as XLSX from 'xlsx';
import { UserRole } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { siteRepository } from './site.repository';
import { ENTITY } from '../../common/constants/entities';
import { PREFIX } from '../../common/constants/prefixes';
import { counterService } from '../../common/counter/counter.service';
import { generateCode } from '../../common/utils/code-generator';
import { normalizeRole } from '../../common/utils/role-matching';
import { auditLogService } from '../audit-log/audit-log.service';

export interface ImportRowNormalized {
  rowIndex: number;
  code: string;
  name: string;
  sequence?: number;
  role: string;
  roleEnum?: UserRole;
  taskName: string;
  description?: string;
  latitude?: number;
  longitude?: number;
}

export interface ImportError {
  row: number;
  checkpointName?: string;
  field: string;
  message: string;
}

export interface ImportWarning {
  row: number;
  message: string;
}

export interface ImportPreviewItem {
  rowIndex: number;
  checkpointCode: string;
  checkpointName: string;
  sequence: number | string;
  role?: string;
  roleDisplay: string;
  taskName: string;
  status: 'VALID' | 'WARNING' | 'ERROR';
  message?: string;
}

export interface ImportValidationResult {
  siteId: string;
  siteName: string;
  totalRows: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
  checkpointsCount: number;
  subtasksCount: number;
  subtasksByRole: Record<string, number>;
  existingCheckpointsCount: number;
  newCheckpointsToCreate: number;
  existingSubtasksSkippedCount: number;
  newSubtasksToCreateCount: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  preview: ImportPreviewItem[];
}

export interface CanonicalColumn {
  field: keyof ImportRowNormalized;
  excelHeader: string;
  aliases: string[];
}

export const CANONICAL_IMPORT_COLUMNS: CanonicalColumn[] = [
  { field: 'name', excelHeader: 'Checkpoint Name', aliases: ['checkpointname', 'gatename', 'name'] },
  { field: 'sequence', excelHeader: 'Sequence Number', aliases: ['sequencenumber', 'sequence', 'patrolorder', 'order'] },
  { field: 'role', excelHeader: 'Role', aliases: ['role', 'userrole', 'assignedrole'] },
  { field: 'taskName', excelHeader: 'Subtask', aliases: ['subtask', 'subtaskname', 'taskname', 'task', 'checkpointsubtask'] },
  { field: 'description', excelHeader: 'Description', aliases: ['description', 'desc', 'guardnote', 'instruction'] },
  { field: 'latitude', excelHeader: 'Latitude', aliases: ['latitude', 'lat'] },
  { field: 'longitude', excelHeader: 'Longitude', aliases: ['longitude', 'lng', 'lon'] },
];

const VALID_USER_ROLES: UserRole[] = [
  UserRole.SECURITY,
  UserRole.CLEANER,
  UserRole.TECHNICIAN,
  UserRole.SUPERVISOR,
  UserRole.SERVICE_ENGINEER,
  UserRole.PLUMBER,
  UserRole.LIFE_GUARD,
  UserRole.MANAGER,
  UserRole.CLIENT_ADMIN,
  UserRole.SUPER_ADMIN,
];

function getRoleDisplay(role: string): string {
  switch (role) {
    case 'CLEANER':
      return 'House Keeping';
    case 'SECURITY':
      return 'Security';
    case 'TECHNICIAN':
      return 'Technician';
    case 'SUPERVISOR':
      return 'Supervisor';
    case 'SERVICE_ENGINEER':
      return 'Service Engineer';
    case 'PLUMBER':
      return 'Plumber';
    case 'LIFE_GUARD':
      return 'Lifeguard';
    default:
      return role.replace(/_/g, ' ');
  }
}

export class SiteImportService {
  /**
   * Generate an Excel template buffer (.xlsx) using CANONICAL_IMPORT_COLUMNS.
   * Exports only editable configuration data. System IDs, gate codes, and QR codes are not exported.
   */
  async generateTemplateBuffer(siteId?: string): Promise<{ buffer: Buffer; checkpointCount: number }> {
    let exportRows: any[] = [];
    let checkpointCount = 0;

    if (siteId) {
      const gates = await prisma.gate.findMany({
        where: { siteId },
        orderBy: { sequence: 'asc' },
        include: {
          subTasks: {
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });

      checkpointCount = gates.length;

      if (gates.length > 0) {
        gates.forEach((gate) => {
          if (gate.subTasks.length > 0) {
            gate.subTasks.forEach((st) => {
              if (st.taskName && st.taskName.trim() !== '') {
                exportRows.push({
                  'Checkpoint Name': gate.name,
                  'Sequence Number': gate.sequence,
                  'Role': getRoleDisplay(st.role),
                  'Subtask': st.taskName.trim(),
                  'Description': st.description || gate.description || '',
                  'Latitude': gate.latitude !== null && gate.latitude !== undefined ? gate.latitude : '',
                  'Longitude': gate.longitude !== null && gate.longitude !== undefined ? gate.longitude : '',
                });
              }
            });
          } else {
            // Checkpoint with 0 subtasks -> Export a checkpoint-only row
            exportRows.push({
              'Checkpoint Name': gate.name,
              'Sequence Number': gate.sequence,
              'Role': '',
              'Subtask': '',
              'Description': gate.description || '',
              'Latitude': gate.latitude !== null && gate.latitude !== undefined ? gate.latitude : '',
              'Longitude': gate.longitude !== null && gate.longitude !== undefined ? gate.longitude : '',
            });
          }
        });
      }
    }

    if (exportRows.length === 0) {
      exportRows = [
        {
          'Checkpoint Name': 'Main Entrance Gate A',
          'Sequence Number': 1,
          'Role': 'Security',
          'Subtask': 'Doors are closed and cleaned',
          'Description': 'Inspect perimeter lock & hinges',
          'Latitude': '',
          'Longitude': '',
        },
        {
          'Checkpoint Name': 'Main Entrance Gate A',
          'Sequence Number': 1,
          'Role': 'Security',
          'Subtask': 'All Lights are working',
          'Description': 'Check overhead floodlights',
          'Latitude': '',
          'Longitude': '',
        },
        {
          'Checkpoint Name': 'Main Entrance Gate A',
          'Sequence Number': 1,
          'Role': 'Security',
          'Subtask': 'Clean As per Kaizen STD',
          'Description': '',
          'Latitude': '',
          'Longitude': '',
        },
        {
          'Checkpoint Name': 'Main Entrance Gate A',
          'Sequence Number': 1,
          'Role': 'House Keeping',
          'Subtask': 'All Area Cleaned',
          'Description': '',
          'Latitude': '',
          'Longitude': '',
        },
        {
          'Checkpoint Name': 'Main Entrance Gate A',
          'Sequence Number': 1,
          'Role': 'House Keeping',
          'Subtask': 'Floor is clean and dry',
          'Description': '',
          'Latitude': '',
          'Longitude': '',
        },
        {
          'Checkpoint Name': 'Main Entrance Gate A',
          'Sequence Number': 1,
          'Role': 'House Keeping',
          'Subtask': 'No unidentified Material Present',
          'Description': '',
          'Latitude': '',
          'Longitude': '',
        },
        {
          'Checkpoint Name': 'Main Entrance Gate A',
          'Sequence Number': 1,
          'Role': 'Technician',
          'Subtask': 'All Equipment functioning OK',
          'Description': 'Check power indicator lights',
          'Latitude': '',
          'Longitude': '',
        },
        {
          'Checkpoint Name': 'Main Entrance Gate A',
          'Sequence Number': 1,
          'Role': 'Technician',
          'Subtask': 'Auto Mode On',
          'Description': '',
          'Latitude': '',
          'Longitude': '',
        },
        {
          'Checkpoint Name': 'Main Entrance Gate A',
          'Sequence Number': 1,
          'Role': 'Technician',
          'Subtask': 'No Leakages',
          'Description': '',
          'Latitude': '',
          'Longitude': '',
        },
        {
          'Checkpoint Name': 'Loading Dock Gate B',
          'Sequence Number': 2,
          'Role': 'Security',
          'Subtask': 'Verify vehicle access logs',
          'Description': '',
          'Latitude': '',
          'Longitude': '',
        },
      ];
    }

    const headers = CANONICAL_IMPORT_COLUMNS.map((col) => col.excelHeader);
    const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: headers });
    
    worksheet['!cols'] = [
      { wch: 25 },
      { wch: 16 },
      { wch: 16 },
      { wch: 35 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Checkpoints');

    return {
      buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
      checkpointCount,
    };
  }

  /**
   * Parse raw file buffer using CANONICAL_IMPORT_COLUMNS mapping
   */
  parseFileBuffer(buffer: Buffer): ImportRowNormalized[] {
    let workbook: XLSX.WorkBook | null = null;

    try {
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch (e) {
      try {
        workbook = XLSX.read(buffer, { type: 'array' });
      } catch (e2) {
        workbook = XLSX.read(buffer.toString('utf-8'), { type: 'string' });
      }
    }

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'The uploaded spreadsheet file is empty.',
      );
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    // 2D Matrix Parsing
    const matrix: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', blankrows: false });
    if (!matrix || matrix.length === 0) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'No data rows found in the uploaded file.',
      );
    }

    // Build recognized keyword lookup from CANONICAL_IMPORT_COLUMNS
    const recognizedAliases = CANONICAL_IMPORT_COLUMNS.flatMap((col) => [
      col.excelHeader.toLowerCase().replace(/[\s_\-]+/g, ''),
      ...col.aliases,
    ]);

    let headerRowIndex = -1;
    let maxMatches = 0;

    for (let r = 0; r < Math.min(matrix.length, 15); r++) {
      const rowArr = matrix[r];
      if (!Array.isArray(rowArr)) continue;
      let matches = 0;
      rowArr.forEach((cell) => {
        const str = String(cell).toLowerCase().trim().replace(/[\s_\-]+/g, '');
        if (str && recognizedAliases.some((alias) => str.includes(alias) || alias.includes(str))) {
          matches++;
        }
      });

      if (matches > maxMatches) {
        maxMatches = matches;
        headerRowIndex = r;
      }
    }

    if (headerRowIndex === -1 || maxMatches === 0) {
      headerRowIndex = 0;
    }

    const rawHeaderCells: string[] = (matrix[headerRowIndex] || []).map((c) => String(c).trim());
    const dataRows = matrix.slice(headerRowIndex + 1);

    if (dataRows.length === 0) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'No import data found. Please add at least one checkpoint row to the template before uploading.',
      );
    }

    // Map header column indices to canonical field names
    const colIndexToFieldMap: Map<number, keyof ImportRowNormalized> = new Map();

    rawHeaderCells.forEach((hCell, colIdx) => {
      if (!hCell) return;
      const normalizedHeader = hCell.toLowerCase().replace(/[\s_\-]+/g, '');
      const matchedCol = CANONICAL_IMPORT_COLUMNS.find(
        (col) =>
          col.excelHeader.toLowerCase().replace(/[\s_\-]+/g, '') === normalizedHeader ||
          col.aliases.includes(normalizedHeader)
      );

      if (matchedCol) {
        colIndexToFieldMap.set(colIdx, matchedCol.field);
      }
    });

    const parsed: ImportRowNormalized[] = [];

    dataRows.forEach((rowCells, idx) => {
      if (!Array.isArray(rowCells) || rowCells.every((c) => String(c).trim() === '')) {
        return; // Skip empty rows
      }

      const rowObj: Partial<Record<keyof ImportRowNormalized, any>> = {};
      colIndexToFieldMap.forEach((field, colIdx) => {
        const rawVal = rowCells[colIdx] !== undefined ? rowCells[colIdx] : '';
        rowObj[field] = rawVal;
      });

      const rawCode = String(rowObj['code'] || '').trim();
      const rawName = String(rowObj['name'] || '').trim();
      const rawSeq = rowObj['sequence'] !== undefined ? rowObj['sequence'] : '';
      const rawRole = String(rowObj['role'] || '').trim();
      const rawTask = String(rowObj['taskName'] || '').trim();
      const rawDesc = String(rowObj['description'] || '').trim();
      const rawLat = rowObj['latitude'] !== undefined ? rowObj['latitude'] : '';
      const rawLng = rowObj['longitude'] !== undefined ? rowObj['longitude'] : '';

      const seqNum = rawSeq !== '' && !isNaN(Number(rawSeq)) ? Number(rawSeq) : undefined;
      const latNum = rawLat !== '' && !isNaN(Number(rawLat)) ? Number(rawLat) : undefined;
      const lngNum = rawLng !== '' && !isNaN(Number(rawLng)) ? Number(rawLng) : undefined;

      parsed.push({
        rowIndex: headerRowIndex + 2 + idx,
        code: rawCode,
        name: rawName,
        sequence: seqNum,
        role: rawRole,
        taskName: rawTask,
        description: rawDesc || undefined,
        latitude: latNum,
        longitude: lngNum,
      });
    });

    if (parsed.length === 0) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'No import data found. Please add at least one checkpoint row to the template before uploading.',
      );
    }

    return parsed;
  }

  /**
   * Validate import file data against site & database schema
   */
  async validateImport(siteId: string, buffer: Buffer): Promise<ImportValidationResult> {
    const site = await siteRepository.findById(siteId);
    if (!site) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Site not found.');
    }

    const rows = this.parseFileBuffer(buffer);

    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];
    const preview: ImportPreviewItem[] = [];

    const subtasksByRole: Record<string, number> = {};
    const groupedCheckpoints = new Map<string, {
      code: string;
      name: string;
      sequence?: number;
      latitude?: number;
      longitude?: number;
      description?: string;
      subtasks: Array<{ role: UserRole; taskName: string; description?: string; rowIndex: number }>;
    }>();

    // Fetch existing site gates for reference
    const existingGates = await prisma.gate.findMany({
      where: { siteId },
      include: {
        subTasks: {
          select: { role: true, taskName: true },
        },
      },
    });

    const existingGateNameMap = new Map<string, typeof existingGates[0]>();
    const existingGateCodeMap = new Map<string, typeof existingGates[0]>();

    existingGates.forEach((g) => {
      existingGateNameMap.set(g.name.toLowerCase().trim(), g);
      existingGateCodeMap.set(g.gateCode.toLowerCase().trim(), g);
    });

    let validRowsCount = 0;
    let validSubtasksCount = 0;

    rows.forEach((row) => {
      let isRowValid = true;

      // Validate Checkpoint Name
      if (!row.name && !row.code) {
        errors.push({
          row: row.rowIndex,
          field: 'Checkpoint Name',
          message: 'Checkpoint Name is required.',
        });
        isRowValid = false;
      }

      // Check if this is a Checkpoint-Only Row (checkpoint name present, but subtask & role are both empty)
      const isCheckpointOnlyRow = (row.name || row.code) && (!row.taskName && !row.role);

      let roleEnum: UserRole | undefined;

      if (!isCheckpointOnlyRow) {
        // Validate Subtask
        if (!row.taskName) {
          errors.push({
            row: row.rowIndex,
            checkpointName: row.name || row.code,
            field: 'Subtask',
            message: 'Subtask name cannot be empty.',
          });
          isRowValid = false;
        }

        // Validate Role
        if (!row.role) {
          errors.push({
            row: row.rowIndex,
            checkpointName: row.name || row.code,
            field: 'Role',
            message: 'User Role is required.',
          });
          isRowValid = false;
        } else {
          const normalized = normalizeRole(row.role) as UserRole;
          if (VALID_USER_ROLES.includes(normalized)) {
            roleEnum = normalized;
          } else {
            errors.push({
              row: row.rowIndex,
              checkpointName: row.name || row.code,
              field: 'Role',
              message: `Invalid role "${row.role}". Valid roles: Security, House Keeping, Technician, Supervisor, Service Engineer, Plumber, Lifeguard.`,
            });
            isRowValid = false;
          }
        }
      }

      if (isRowValid) {
        validRowsCount++;

        // Group by Checkpoint Name
        const checkpointNameVal = row.name || row.code || 'Unnamed Checkpoint';
        const checkpointKey = `NAME_${checkpointNameVal.toLowerCase().trim()}`;

        let group = groupedCheckpoints.get(checkpointKey);
        if (!group) {
          group = {
            code: row.code,
            name: checkpointNameVal,
            sequence: row.sequence,
            latitude: row.latitude,
            longitude: row.longitude,
            description: row.description,
            subtasks: [],
          };
          groupedCheckpoints.set(checkpointKey, group);
        } else {
          if (!group.name && checkpointNameVal) group.name = checkpointNameVal;
          if (group.sequence === undefined && row.sequence !== undefined) group.sequence = row.sequence;
          if (group.latitude === undefined && row.latitude !== undefined) group.latitude = row.latitude;
          if (group.longitude === undefined && row.longitude !== undefined) group.longitude = row.longitude;
        }

        if (roleEnum && row.taskName) {
          validSubtasksCount++;
          subtasksByRole[roleEnum] = (subtasksByRole[roleEnum] || 0) + 1;

          group.subtasks.push({
            role: roleEnum,
            taskName: row.taskName,
            description: row.description,
            rowIndex: row.rowIndex,
          });

          preview.push({
            rowIndex: row.rowIndex,
            checkpointCode: 'Auto',
            checkpointName: group.name,
            sequence: row.sequence ?? 'Auto',
            role: roleEnum,
            roleDisplay: getRoleDisplay(roleEnum),
            taskName: row.taskName,
            status: 'VALID',
          });
        } else {
          // Valid Checkpoint-Only Row
          preview.push({
            rowIndex: row.rowIndex,
            checkpointCode: 'Auto',
            checkpointName: group.name,
            sequence: row.sequence ?? 'Auto',
            role: '',
            roleDisplay: 'N/A (Checkpoint Only)',
            taskName: '(No Subtasks)',
            status: 'VALID',
          });
        }
      } else {
        preview.push({
          rowIndex: row.rowIndex,
          checkpointCode: '-',
          checkpointName: row.name || row.code || '-',
          sequence: row.sequence ?? '-',
          role: row.role || '-',
          roleDisplay: row.role || '-',
          taskName: row.taskName || '-',
          status: 'ERROR',
          message: errors[errors.length - 1]?.message || 'Invalid row data',
        });
      }
    });

    // Determine existing vs new counts
    let existingCheckpointsCount = 0;
    let newCheckpointsToCreate = 0;
    let existingSubtasksSkippedCount = 0;
    let newSubtasksToCreateCount = 0;

    groupedCheckpoints.forEach((group) => {
      const matchedGate = group.name ? existingGateNameMap.get(group.name.toLowerCase().trim()) : undefined;

      if (matchedGate) {
        existingCheckpointsCount++;
        const existingSubtaskSet = new Set(
          matchedGate.subTasks.map((st) => `${st.role}_${st.taskName.toLowerCase().trim()}`)
        );

        group.subtasks.forEach((st) => {
          const key = `${st.role}_${st.taskName.toLowerCase().trim()}`;
          if (existingSubtaskSet.has(key)) {
            existingSubtasksSkippedCount++;
          } else {
            newSubtasksToCreateCount++;
          }
        });
      } else {
        newCheckpointsToCreate++;
        newSubtasksToCreateCount += group.subtasks.length;
      }
    });

    return {
      siteId,
      siteName: site.name,
      totalRows: rows.length,
      validRows: validRowsCount,
      errorCount: errors.length,
      warningCount: warnings.length,
      checkpointsCount: groupedCheckpoints.size,
      subtasksCount: validSubtasksCount,
      subtasksByRole,
      existingCheckpointsCount,
      newCheckpointsToCreate,
      existingSubtasksSkippedCount,
      newSubtasksToCreateCount,
      errors,
      warnings,
      preview: preview.slice(0, 100),
    };
  }

  /**
   * Execute transactional import to database
   */
  async executeImport(siteId: string, buffer: Buffer, userId?: string, clientId?: string) {
    const validation = await this.validateImport(siteId, buffer);

    if (validation.errorCount > 0 && validation.validRows === 0) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        `Import failed. Found ${validation.errorCount} validation errors.`,
      );
    }

    const rows = this.parseFileBuffer(buffer);

    const groupedCheckpoints = new Map<string, {
      code: string;
      name: string;
      sequence?: number;
      latitude?: number;
      longitude?: number;
      description?: string;
      subtasks: Array<{ role: UserRole; taskName: string; description?: string }>;
    }>();

    rows.forEach((row) => {
      if (!row.name && !row.code) return;

      const isCheckpointOnlyRow = !row.taskName && !row.role;
      let normalizedRole: UserRole | undefined;

      if (!isCheckpointOnlyRow) {
        if (!row.taskName || !row.role) return;
        const norm = normalizeRole(row.role) as UserRole;
        if (!VALID_USER_ROLES.includes(norm)) return;
        normalizedRole = norm;
      }

      const checkpointNameVal = row.name || row.code || 'Unnamed Checkpoint';
      const checkpointKey = `NAME_${checkpointNameVal.toLowerCase().trim()}`;

      let group = groupedCheckpoints.get(checkpointKey);
      if (!group) {
        group = {
          code: row.code,
          name: checkpointNameVal,
          sequence: row.sequence,
          latitude: row.latitude,
          longitude: row.longitude,
          description: row.description,
          subtasks: [],
        };
        groupedCheckpoints.set(checkpointKey, group);
      } else {
        if (!group.name && checkpointNameVal) group.name = checkpointNameVal;
        if (group.sequence === undefined && row.sequence !== undefined) group.sequence = row.sequence;
        if (group.latitude === undefined && row.latitude !== undefined) group.latitude = row.latitude;
        if (group.longitude === undefined && row.longitude !== undefined) group.longitude = row.longitude;
      }

      if (normalizedRole && row.taskName) {
        group.subtasks.push({
          role: normalizedRole,
          taskName: row.taskName.trim(),
          description: row.description,
        });
      }
    });

    const site = await siteRepository.findById(siteId);
    if (!site) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Site not found.');
    }

    let createdGatesCount = 0;
    let createdSubtasksCount = 0;
    let skippedSubtasksCount = 0;

    await prisma.$transaction(async (tx) => {
      const maxGate = await tx.gate.findFirst({
        where: { siteId },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      });
      let nextSeq = (maxGate?.sequence ?? 0) + 1;

      for (const [_, group] of groupedCheckpoints) {
        let gate = await tx.gate.findFirst({
          where: {
            siteId,
            name: { equals: group.name, mode: 'insensitive' as const },
          },
        });

        if (!gate) {
          // ALWAYS generate a FRESH unique gate code for the destination site using site counter
          let seqCounter = await counterService.next(ENTITY.GATE, site.id);
          let gateCode = generateCode(PREFIX.GATE, seqCounter);
          let existingCode = await tx.gate.findFirst({ where: { siteId, gateCode } });
          while (existingCode) {
            seqCounter = await counterService.next(ENTITY.GATE, site.id);
            gateCode = generateCode(PREFIX.GATE, seqCounter);
            existingCode = await tx.gate.findFirst({ where: { siteId, gateCode } });
          }

          const seq = group.sequence || nextSeq++;

          gate = await tx.gate.create({
            data: {
              siteId,
              gateCode,
              name: group.name,
              sequence: seq,
              description: group.description || null,
              latitude: group.latitude || null,
              longitude: group.longitude || null,
              qrCode: gateCode, // Fresh unique QR payload for destination checkpoint!
            },
          });
          createdGatesCount++;
        }

        const existingSubtasks = await tx.gateSubTask.findMany({
          where: { gateId: gate.id },
          select: { role: true, taskName: true },
        });

        const existingSet = new Set(
          existingSubtasks.map((st) => `${st.role}_${st.taskName.toLowerCase().trim()}`)
        );

        const subtasksToInsert: Array<{
          gateId: string;
          role: UserRole;
          taskName: string;
          description?: string;
          displayOrder: number;
          isRequired: boolean;
          isActive: boolean;
        }> = [];

        group.subtasks.forEach((st, idx) => {
          const key = `${st.role}_${st.taskName.toLowerCase().trim()}`;
          if (existingSet.has(key)) {
            skippedSubtasksCount++;
          } else {
            existingSet.add(key);
            subtasksToInsert.push({
              gateId: gate!.id,
              role: st.role,
              taskName: st.taskName,
              description: st.description || undefined,
              displayOrder: idx,
              isRequired: true,
              isActive: true,
            });
          }
        });

        if (subtasksToInsert.length > 0) {
          const res = await tx.gateSubTask.createMany({
            data: subtasksToInsert,
            skipDuplicates: true,
          });
          createdSubtasksCount += res.count;
        }
      }
    });

    if (userId && clientId) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'CREATE',
        entity: 'SiteImport',
        entityId: siteId,
      });
    }

    return {
      success: true,
      siteId,
      siteName: site.name,
      checkpointsProcessed: groupedCheckpoints.size,
      checkpointsCreated: createdGatesCount,
      subtasksCreated: createdSubtasksCount,
      duplicatesSkipped: skippedSubtasksCount,
    };
  }
}

export const siteImportService = new SiteImportService();
