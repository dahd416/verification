import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Helper to get auth header
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Auth API
export const authAPI = {
  login: (email, password) => 
    axios.post(`${API}/auth/login`, { email, password }),
  register: (data) => 
    axios.post(`${API}/auth/register`, data),
  getMe: () => 
    axios.get(`${API}/auth/me`, { headers: getAuthHeader() }),
};

// Courses API
export const coursesAPI = {
  getAll: () => 
    axios.get(`${API}/courses`, { headers: getAuthHeader() }),
  getById: (id) => 
    axios.get(`${API}/courses/${id}`, { headers: getAuthHeader() }),
  create: (data) => 
    axios.post(`${API}/courses`, data, { headers: getAuthHeader() }),
  update: (id, data) => 
    axios.put(`${API}/courses/${id}`, data, { headers: getAuthHeader() }),
  delete: (id) => 
    axios.delete(`${API}/courses/${id}`, { headers: getAuthHeader() }),
  downloadAllDiplomas: (courseId) => 
    axios.get(`${API}/courses/${courseId}/download-all-diplomas`, { 
      headers: getAuthHeader(),
      responseType: 'blob'
    }),
};

// Templates API
export const templatesAPI = {
  getAll: () => 
    axios.get(`${API}/templates`, { headers: getAuthHeader() }),
  getById: (id) => 
    axios.get(`${API}/templates/${id}`, { headers: getAuthHeader() }),
  create: (data) => 
    axios.post(`${API}/templates`, data, { headers: getAuthHeader() }),
  update: (id, data) => 
    axios.put(`${API}/templates/${id}`, data, { headers: getAuthHeader() }),
  delete: (id) => 
    axios.delete(`${API}/templates/${id}`, { headers: getAuthHeader() }),
  duplicate: (id) => 
    axios.post(`${API}/templates/${id}/duplicate`, {}, { headers: getAuthHeader() }),
};

// Recipients API
export const recipientsAPI = {
  getAll: (courseId = null) => {
    const params = courseId ? `?course_id=${courseId}` : '';
    return axios.get(`${API}/recipients${params}`, { headers: getAuthHeader() });
  },
  create: (data) => 
    axios.post(`${API}/recipients`, data, { headers: getAuthHeader() }),
  delete: (id) => 
    axios.delete(`${API}/recipients/${id}`, { headers: getAuthHeader() }),
  bulkImport: (courseId, file) => {
    const formData = new FormData();
    formData.append('course_id', courseId);
    formData.append('file', file);
    return axios.post(`${API}/recipients/bulk`, formData, { 
      headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' } 
    });
  },
  downloadTemplate: () => 
    axios.get(`${API}/recipients/csv-template`, { 
      headers: getAuthHeader(),
      responseType: 'blob'
    }),
};

// Diplomas API
export const diplomasAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.course_id) params.append('course_id', filters.course_id);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    const queryString = params.toString();
    return axios.get(`${API}/diplomas${queryString ? `?${queryString}` : ''}`, { headers: getAuthHeader() });
  },
  getById: (id) => 
    axios.get(`${API}/diplomas/${id}`, { headers: getAuthHeader() }),
  generate: (data) => 
    axios.post(`${API}/diplomas/generate`, data, { headers: getAuthHeader() }),
  revoke: (id) => 
    axios.post(`${API}/diplomas/${id}/revoke`, {}, { headers: getAuthHeader() }),
  reactivate: (id) => 
    axios.post(`${API}/diplomas/${id}/reactivate`, {}, { headers: getAuthHeader() }),
  delete: (id) => 
    axios.delete(`${API}/diplomas/${id}`, { headers: getAuthHeader() }),
  getData: (id) =>
    axios.get(`${API}/diplomas/${id}/data`),
  downloadPdf: (id) => 
    axios.get(`${API}/diplomas/${id}/download-pdf`, { 
      headers: getAuthHeader(),
      responseType: 'blob'
    }),
  downloadPdfPublic: (certificateId) => 
    axios.get(`${API}/diplomas/by-certificate/${certificateId}/download-pdf`, { 
      responseType: 'blob'
    }),
  sendEmail: (id) =>
    axios.post(`${API}/diplomas/${id}/send-email`, {}, { headers: getAuthHeader() }),
  sendBulkEmail: (diplomaIds) =>
    axios.post(`${API}/diplomas/send-bulk-email`, { diploma_ids: diplomaIds }, { headers: getAuthHeader() }),
};

// Settings API
export const settingsAPI = {
  get: () =>
    axios.get(`${API}/settings`, { headers: getAuthHeader() }),
  update: (data) =>
    axios.put(`${API}/settings`, data, { headers: getAuthHeader() }),
  testEmail: () =>
    axios.post(`${API}/settings/test-email`, {}, { headers: getAuthHeader() }),
  getPublic: () =>
    axios.get(`${API}/settings/public`),
};

// Email Templates API
export const emailTemplatesAPI = {
  getAll: () =>
    axios.get(`${API}/email-templates`, { headers: getAuthHeader() }),
  get: (id) =>
    axios.get(`${API}/email-templates/${id}`, { headers: getAuthHeader() }),
  create: (data) =>
    axios.post(`${API}/email-templates`, data, { headers: getAuthHeader() }),
  update: (id, data) =>
    axios.put(`${API}/email-templates/${id}`, data, { headers: getAuthHeader() }),
  delete: (id) =>
    axios.delete(`${API}/email-templates/${id}`, { headers: getAuthHeader() }),
  duplicate: (id) =>
    axios.post(`${API}/email-templates/${id}/duplicate`, {}, { headers: getAuthHeader() }),
  preview: (data) =>
    axios.post(`${API}/email-templates/preview`, data, { headers: getAuthHeader() }),
};

// Verification API (public)
export const verifyAPI = {
  verify: (certificateId) => 
    axios.get(`${API}/verify/${certificateId}`),
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => 
    axios.get(`${API}/dashboard`, { headers: getAuthHeader() }),
};

// Scan Logs API
export const scanLogsAPI = {
  getAll: (diplomaId = null) => {
    const params = diplomaId ? `?diploma_id=${diplomaId}` : '';
    return axios.get(`${API}/scan-logs${params}`, { headers: getAuthHeader() });
  },
  clear: () => 
    axios.delete(`${API}/scan-logs/clear`, { headers: getAuthHeader() }),
};

// Upload API
export const uploadAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${API}/upload`, formData, { 
      headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' } 
    });
  },
};

// Seed API (for development)
export const seedAPI = {
  seed: () => axios.post(`${API}/seed`),
};
