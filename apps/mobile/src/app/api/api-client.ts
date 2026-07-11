import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Config } from '../config';
import { useAuthStore } from '../store/auth-store';
import { ApiResponse, AuthData } from '../types/api';
import { tokenManager } from '../utils/token-manager';

export const apiClient = axios.create({
  baseURL: Config.API_URL,
  timeout: Config.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Separate instance to avoid interceptor loops during refresh/login calls
export const authClient = axios.create({
  baseURL: Config.API_URL,
  timeout: Config.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string | PromiseLike<string>) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Attach Access Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenManager.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Catch 401s and Refresh Token
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!error.response) {
      return Promise.reject(error);
    }

    // Auto-refresh token if 401 and request hasn't been retried yet
    if (error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = tokenManager.getRefreshToken();

      if (!refreshToken) {
        isRefreshing = false;
        tokenManager.clearTokens();
        useAuthStore.getState().clearAuth();
        return Promise.reject(error);
      }

      try {
        const response = await authClient.post<ApiResponse<AuthData>>('/auth/refresh', {
          refreshToken,
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken, user } =
          response.data.data;

        // Persist new tokens
        tokenManager.setAccessToken(newAccessToken);
        if (newRefreshToken) {
          tokenManager.setRefreshToken(newRefreshToken);
        }

        // Sync store state
        useAuthStore.getState().setAuth(user);

        // Resume failure queue
        processQueue(null, newAccessToken);
        isRefreshing = false;

        // Retry original request
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        tokenManager.clearTokens();
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
