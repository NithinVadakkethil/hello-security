export interface EnrollManagerDto {
  name: string;
  email: string;
}

export interface ManagerClientDto {
  clientId: string;
  clientCode: string;
  companyName: string;
  clientLogoUrl?: string | null;
  siteCount: number;
  isActive: boolean;
}

export interface EnrolledManagerDto {
  id: string;
  userId: string;
  email: string;
  name: string;
  createdAt: Date;
  isActive: boolean;
}
