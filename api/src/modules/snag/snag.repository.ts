import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AssignSnagDto, CompleteSnagJobDto, CreateSnagDto, SnagFilterDto } from './snag.types';

export class SnagRepository {
  create(clientId: string, employeeId: string, data: CreateSnagDto) {
    return prisma.snag.create({
      data: {
        clientId,
        employeeId,
        siteId: data.siteId,
        gateId: data.gateId || null,
        patrolSessionId: data.patrolSessionId || null,
        categoryId: data.categoryId || null,
        subCategoryId: data.subCategoryId || null,
        category: data.category,
        subCategory: data.subCategory || null,
        description: data.description,
        priority: data.priority,
        images: data.images || [],
        latitude: data.latitude || null,
        longitude: data.longitude || null,
      },
      include: {
        site: { select: { id: true, name: true, siteCode: true } },
        gate: { select: { id: true, name: true, gateCode: true } },
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
      },
    });
  }

  findById(id: string) {
    return prisma.snag.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, companyName: true } },
        site: { select: { id: true, name: true, siteCode: true, latitude: true, longitude: true } },
        gate: {
          select: {
            id: true,
            name: true,
            gateCode: true,
            latitude: true,
            longitude: true,
            subTasks: {
              where: { isActive: true },
              orderBy: { displayOrder: 'asc' },
              select: {
                id: true,
                taskName: true,
                description: true,
                role: true,
                isRequired: true,
                displayOrder: true,
              },
            },
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            designation: true,
            phone: true,
            email: true,
          },
        },
        patrolSession: { select: { id: true, patrolCode: true } },
        comments: {
          include: {
            user: { select: { id: true, email: true, role: true, employee: { select: { firstName: true, lastName: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
        history: {
          include: {
            user: { select: { id: true, email: true, role: true, employee: { select: { firstName: true, lastName: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
        assignments: {
          include: {
            assignedTo: { select: { id: true, email: true, role: true, employee: { select: { firstName: true, lastName: true } } } },
            assignedBy: { select: { id: true, email: true, role: true, employee: { select: { firstName: true, lastName: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async list(clientId: string, filters: SnagFilterDto = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.SnagWhereInput = {
      clientId,
      ...(filters.siteId && { siteId: filters.siteId }),
      ...(filters.gateId && { gateId: filters.gateId }),
      ...(filters.patrolSessionId && { patrolSessionId: filters.patrolSessionId }),
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...(filters.assignedToId && { assignments: { some: { assignedToId: filters.assignedToId } } }),
      ...(filters.status && { status: filters.status }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.category && { category: { contains: filters.category, mode: 'insensitive' } }),
      ...(filters.subCategory && { subCategory: { contains: filters.subCategory, mode: 'insensitive' } }),
    };

    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { category: { contains: filters.search, mode: 'insensitive' } },
        { subCategory: { contains: filters.search, mode: 'insensitive' } },
        { site: { name: { contains: filters.search, mode: 'insensitive' } } },
        { gate: { name: { contains: filters.search, mode: 'insensitive' } } },
        { employee: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { employee: { lastName: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const [snags, total] = await Promise.all([
      prisma.snag.findMany({
        where,
        skip,
        take: limit,
        include: {
          client: { select: { id: true, companyName: true } },
          site: { select: { id: true, name: true } },
          gate: { select: { id: true, name: true, gateCode: true } },
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
          assignments: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              assignedTo: { select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.snag.count({ where }),
    ]);

    return {
      snags,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStats(clientId: string) {
    const [total, open, inProgress, waiting, resolved, closed, highPriority] = await Promise.all([
      prisma.snag.count({ where: { clientId } }),
      prisma.snag.count({ where: { clientId, status: 'OPEN' } }),
      prisma.snag.count({ where: { clientId, status: 'IN_PROGRESS' } }),
      prisma.snag.count({ where: { clientId, status: 'WAITING' } }),
      prisma.snag.count({ where: { clientId, status: 'RESOLVED' } }),
      prisma.snag.count({ where: { clientId, status: 'CLOSED' } }),
      prisma.snag.count({ where: { clientId, priority: 'HIGH' } }),
    ]);

    return {
      total,
      open,
      inProgress,
      waiting,
      resolved,
      closed,
      highPriority,
    };
  }

  updateStatus(id: string, status: string) {
    return prisma.snag.update({
      where: { id },
      data: { status },
    });
  }

  addComment(snagId: string, userId: string, comment: string) {
    return prisma.snagComment.create({
      data: {
        snagId,
        userId,
        comment,
      },
      include: {
        user: { select: { id: true, email: true, role: true, employee: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  addHistory(snagId: string, userId: string, action: string, previousState?: string, newState?: string, notes?: string) {
    return prisma.snagHistory.create({
      data: {
        snagId,
        userId,
        action,
        previousState: previousState || null,
        newState: newState || null,
        notes: notes || null,
      },
    });
  }

  async assign(snagId: string, assignedById: string, dto: AssignSnagDto) {
    const assignment = await prisma.snagAssignment.create({
      data: {
        snagId,
        assignedById,
        assignedToId: dto.assignedToId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      include: {
        assignedTo: { select: { id: true, email: true, role: true, employee: { select: { firstName: true, lastName: true } } } },
        assignedBy: { select: { id: true, email: true, role: true, employee: { select: { firstName: true, lastName: true } } } },
      },
    });

    const snag = await prisma.snag.findUnique({ where: { id: snagId }, select: { status: true } });
    if (snag && (snag.status === 'OPEN' || snag.status === 'UNASSIGNED')) {
      await prisma.snag.update({
        where: { id: snagId },
        data: { status: 'ASSIGNED' },
      });
    }

    return assignment;
  }

  async completeJob(snagId: string, userId: string, data: CompleteSnagJobDto) {
    const existing = await prisma.snag.findUnique({ where: { id: snagId } });
    if (!existing) return null;

    const mergedImages = Array.from(new Set([...(existing.images || []), ...(data.images || [])]));
    const updateData: Prisma.SnagUpdateInput = {
      status: 'RESOLVED',
      images: mergedImages,
    };
    if (data.latitude) updateData.latitude = data.latitude;
    if (data.longitude) updateData.longitude = data.longitude;

    const updatedSnag = await prisma.snag.update({
      where: { id: snagId },
      data: updateData,
      include: {
        site: { select: { id: true, name: true } },
        gate: { select: { id: true, name: true, gateCode: true } },
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        assignments: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            assignedTo: { select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });

    return updatedSnag;
  }
}

export const snagRepository = new SnagRepository();
