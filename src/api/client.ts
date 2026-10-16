// Deprecated API client - CampusConnect migrated from Spring Boot + MySQL to Supabase
// Retained for backward compatibility
export const apiClient = {
  get: async () => ({ data: { data: [] } }),
  post: async () => ({ data: { message: 'Success' } }),
  put: async () => ({ data: { message: 'Success' } }),
  patch: async () => ({ data: { message: 'Success' } }),
  delete: async () => ({ data: { message: 'Success' } }),
};

export default apiClient;
