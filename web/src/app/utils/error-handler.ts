import { AxiosError } from 'axios';
import toast from 'react-hot-toast';
import { ApiErrorResponse } from '../types/api';

export interface ParsedError {
  message: string;
  code?: string;
  validationErrors?: Record<string, string[]>;
}

export const parseError = (error: unknown): ParsedError => {
  const result: ParsedError = {
    message: 'An unexpected error occurred. Please try again.',
  };

  if (error instanceof AxiosError) {
    const apiError = error.response?.data as ApiErrorResponse | undefined;
    if (apiError) {
      result.message = apiError.message || result.message;
      result.code = apiError.code;
      result.validationErrors = apiError.validationErrors;
      return result;
    }

    if (error.message === 'Network Error') {
      result.message = 'Network error. Please check your internet connection.';
      result.code = 'NETWORK_ERROR';
      return result;
    }

    result.message = error.message;
  } else if (error instanceof Error) {
    result.message = error.message;
  } else if (typeof error === 'string') {
    result.message = error;
  }

  return result;
};

export const showErrorToast = (error: unknown, defaultMessage?: string): void => {
  const parsed = parseError(error);
  const message = defaultMessage || parsed.message;
  
  if (parsed.validationErrors) {
    // If there are detailed validation errors, display the first one or a clean summary
    const firstKey = Object.keys(parsed.validationErrors)[0];
    const firstVal = parsed.validationErrors[firstKey]?.[0];
    if (firstVal) {
      toast.error(`${firstKey}: ${firstVal}`);
      return;
    }
  }

  toast.error(message);
};
