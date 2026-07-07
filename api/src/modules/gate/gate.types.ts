export interface CreateGateDto {
  siteId: string;

  name: string;

  description?: string;

  latitude?: number;

  longitude?: number;

  sequence: number;
}

export interface UpdateGateDto {
  name?: string;

  description?: string;

  latitude?: number;

  longitude?: number;

  sequence?: number;

  isActive?: boolean;
}
