const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export async function fetchFromApi(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    if (!res.ok) {
      let detail = `${res.status}: ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.detail) detail = body.detail;
      } catch {
        /* response had no JSON body */
      }
      throw new Error(detail);
    }
    return await res.json();
  } catch (err) {
    console.error(`Error calling ${endpoint}:`, err);
    throw err;
  }
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '' && val !== 'All') {
      query.append(key, val);
    }
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  // ---- Dashboard ----
  getDashboardSummary: () => fetchFromApi('/dashboard/summary'),
  getNationalReference: () => fetchFromApi('/dashboard/national-reference'),

  // ---- Projects ----
  getProjects: (params = {}) => fetchFromApi(`/projects${buildQuery(params)}`),
  getProjectFilters: () => fetchFromApi('/projects/filters'),
  getProjectById: (id) => fetchFromApi(`/projects/${encodeURIComponent(id)}`),
  getProjectHistory: (id) => fetchFromApi(`/projects/${encodeURIComponent(id)}/history`),
  getProjectRisk: (id) => fetchFromApi(`/projects/${encodeURIComponent(id)}/risk`),
  getAlerts: (severity, page, limit) =>
    fetchFromApi(`/projects/alerts${buildQuery({ severity, page, limit })}`),

  // ---- Risk ----
  simulateRisk: (payload) =>
    fetchFromApi('/risk/simulate', { method: 'POST', body: JSON.stringify(payload) }),

  // ---- Analytics ----
  getMinistryAnalytics: () => fetchFromApi('/analytics/ministries'),
  getSectorAnalytics: () => fetchFromApi('/analytics/sectors'),
  getRegionAnalytics: () => fetchFromApi('/analytics/regions'),
  getBenchmarks: () => fetchFromApi('/analytics/benchmarks'),
  getDelayTaxonomy: () => fetchFromApi('/analytics/delay-taxonomy'),

  // ---- CUF / model evaluation ----
  getCUFComparison: () => fetchFromApi('/cuf/comparison'),
  getBaselineVsML: (refresh = false) =>
    fetchFromApi(`/cuf/baseline-vs-ml${refresh ? '?refresh=true' : ''}`),
  getModelInfo: () => fetchFromApi('/cuf/model-info'),
  runMonthlyPipelineSync: () =>
    fetchFromApi('/cuf/pipeline/monthly-sync', { method: 'POST' }),

  // ---- Assistant ----
  getAssistantStatus: () => fetchFromApi('/assistant/status'),
  chatAssistant: (message, projectId) =>
    fetchFromApi('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ message, project_id: projectId }),
    }),
  queryAssistant: (question, projectId) =>
    fetchFromApi('/assistant/query', {
      method: 'POST',
      body: JSON.stringify({ question, project_id: projectId }),
    }),

  // ---- Data source ----
  getDataSource: () => fetchFromApi('/datasource'),
  getDataSourceSchema: () => fetchFromApi('/datasource/schema'),
  getSampleCsvUrl: () => `${API_BASE}/datasource/sample-csv`,
  setDataSourceMode: (mode) =>
    fetchFromApi('/datasource/mode', { method: 'POST', body: JSON.stringify({ mode }) }),
  clearImportedDataset: () => fetchFromApi('/datasource/import', { method: 'DELETE' }),

  // Multipart upload: do not set Content-Type, the browser adds the boundary.
  importDataset: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/datasource/import`, { method: 'POST', body: form });
    if (!res.ok) {
      let detail = `Upload failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.detail) detail = body.detail;
      } catch {
        /* no JSON body */
      }
      throw new Error(detail);
    }
    return res.json();
  },
};

export { API_BASE };
