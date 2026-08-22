import { IdentificationMethod, SubscriptionStatus } from '@prisma/client';

export interface CreateClientDto {
  companyName: string;
  email: string;
  authorizedPerson?: string;
  phone?: string;
  address?: string;
  identificationMethod: IdentificationMethod;
  maxEmployees: number;
  isActive?: boolean;
  subscriptionStatus?: SubscriptionStatus;
}

export type UpdateClientDto = Partial<CreateClientDto>;

export interface ClientListQuery {
  page?: number;
  limit?: number;
  search?: string;
  subscriptionStatus?: SubscriptionStatus;
}
