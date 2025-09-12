import axios, { AxiosInstance } from 'axios';

export const createHttpClient = (baseURL: string, headers: Record<string, string> = {}): AxiosInstance => {
  return axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    timeout: 10000,
  });
};
