import { IdentificationMethod, SubscriptionStatus } from '@prisma/client';

export interface CreateClientDto {
  companyName: string;
  email: string;
  phone?: string;
  address?: string;
  identificationMethod: IdentificationMethod;
  maxEmployees: number;
}

export interface UpdateClientDto extends Partial<CreateClientDto> {}

export interface ClientListQuery {
  page?: number;
  limit?: number;
  search?: string;
  subscriptionStatus?: SubscriptionStatus;
}
