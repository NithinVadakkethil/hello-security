import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { subTaskMasterService } from './subtask-master.service';

export class SubTaskMasterController {
  async listMasters(req: Request, res: Response) {
    try {
      const clientId = req.user?.tenantId;
      if (!clientId) {
        return res.status(400).json({ success: false, error: { message: 'Client context required.' } });
      }
      const data = await subTaskMasterService.listMasters(clientId);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.errorCode || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }

  async getMasterByRole(req: Request, res: Response) {
    try {
      const clientId = req.user?.tenantId;
      const role = String(req.params.role);
      if (!clientId) {
        return res.status(400).json({ success: false, error: { message: 'Client context required.' } });
      }
      const data = await subTaskMasterService.getMasterByRole(clientId, role as UserRole);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.errorCode || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }

  async saveMaster(req: Request, res: Response) {
    try {
      const clientId = req.user?.tenantId;
      const userId = req.user?.id;
      if (!clientId) {
        return res.status(400).json({ success: false, error: { message: 'Client context required.' } });
      }
      const data = await subTaskMasterService.saveMaster(clientId, req.body, userId);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.errorCode || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }

  async deleteMaster(req: Request, res: Response) {
    try {
      const clientId = req.user?.tenantId;
      const userId = req.user?.id;
      const id = String(req.params.id);
      if (!clientId) {
        return res.status(400).json({ success: false, error: { message: 'Client context required.' } });
      }
      const data = await subTaskMasterService.deleteMaster(clientId, id, userId);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.errorCode || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }

  async previewApply(req: Request, res: Response) {
    try {
      const clientId = req.user?.tenantId;
      const siteId = String(req.params.siteId);
      const { roles } = req.body;

      if (!clientId) {
        return res.status(400).json({ success: false, error: { message: 'Client context required.' } });
      }
      if (!roles || !Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ success: false, error: { message: 'At least one role must be selected.' } });
      }

      const data = await subTaskMasterService.previewApplyMaster(clientId, siteId, roles);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.errorCode || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }

  async executeApply(req: Request, res: Response) {
    try {
      const clientId = req.user?.tenantId;
      const userId = req.user?.id;
      const siteId = String(req.params.siteId);
      const { roles } = req.body;

      if (!clientId) {
        return res.status(400).json({ success: false, error: { message: 'Client context required.' } });
      }
      if (!roles || !Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ success: false, error: { message: 'At least one role must be selected.' } });
      }

      const data = await subTaskMasterService.executeApplyMaster(clientId, siteId, roles, userId);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.errorCode || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
}

export const subTaskMasterController = new SubTaskMasterController();
