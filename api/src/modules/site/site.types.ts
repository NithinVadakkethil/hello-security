export interface CreateSiteDto {
  name: string;
  address: string;

  latitude?: number;
  longitude?: number;

  radius?: number;

  contactPerson?: string;
  contactPhone?: string;
}

export interface UpdateSiteDto {
  name?: string;
  address?: string;

  latitude?: number;
  longitude?: number;

  radius?: number;

  contactPerson?: string;
  contactPhone?: string;

  isActive?: boolean;
}
