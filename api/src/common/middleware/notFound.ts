import { Request, Response } from 'express';
import { ErrorCodes } from '../errors/ErrorCodes';
import { HttpStatus } from '../errors/HttpStatus';
import { ApiResponse } from '../responses/apiResponse';

export function notFound(req: Request, res: Response) {
  return ApiResponse.error(
    res,
    HttpStatus.NOT_FOUND,
    ErrorCodes.NOT_FOUND,
    `Route ${req.originalUrl} not found`,
  );
}
