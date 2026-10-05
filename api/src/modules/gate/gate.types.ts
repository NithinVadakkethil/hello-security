export interface CreateGateDto {
  siteId: string;

  name: string;

  description?: string;

  latitude?: number;

  longitude?: number;

  sequence: number;

  categoryId?: string | null;
}

export interface UpdateGateDto {
  name?: string;

  description?: string;

  latitude?: number;

  longitude?: number;

  sequence?: number;

  categoryId?: string | null;

  isActive?: boolean;
}
