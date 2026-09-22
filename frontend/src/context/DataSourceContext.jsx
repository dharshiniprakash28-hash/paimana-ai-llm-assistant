import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

/**
 * Tracks which dataset is active: DEMO (500 synthetic projects) or REAL
 * (an imported PAIMANA CSV/XLSX extract).
 *
 * The backend is the source of truth and persists the selection to disk, so a
 * browser refresh keeps the imported dataset active. `version` increments on
 * every change and is used by pages as a dependency to refetch their data.
 */

const DataSourceContext = createContext(null);

const FALLBACK_STATUS = {
  mode: 'DEMO',
  label: 'Demo Data - Synthetic',
  is_synthetic: true,
  disclaimer:
    'Demo data is synthetic and for demonstration purposes only. It is not official PAIMANA data.',
  active_project_count: 0,
  demo_project_count: 0,
  imported_project_count: 0,
  has_imported_dataset: false,
  import_meta: null,
  available_modes: [
    { value: 'DEMO', label: 'Demo Data - Synthetic', enabled: true },
    { value: 'REAL', label: 'Real PAIMANA Data - Imported', enabled: false },
  ],
};

export function DataSourceProvider({ children }) {
  const [status, setStatus] = useState(FALLBACK_STATUS);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await api.getDataSource();
      setStatus(res);
      setError(null);
      return res;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const switchMode = useCallback(
    async (mode) => {
      if (mode === status.mode) return status;
      setSwitching(true);
      setError(null);
      try {
        const res = await api.setDataSourceMode(mode);
        setStatus(res);
        setVersion((v) => v + 1);
        return res;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setSwitching(false);
      }
    },
    [status]
  );

  const applyImportResult = useCallback((result) => {
    if (result?.data_source) {
      setStatus(result.data_source);
      setVersion((v) => v + 1);
    }
  }, []);

  const clearImported = useCallback(async () => {
    const res = await api.clearImportedDataset();
    setStatus(res);
    setVersion((v) => v + 1);
    return res;
  }, []);

  const value = {
    status,
    loading,
    switching,
    error,
    version,
    refresh,
    switchMode,
    applyImportResult,
    clearImported,
    isReal: status.mode === 'REAL',
    isSynthetic: status.is_synthetic !== false,
  };

  return <DataSourceContext.Provider value={value}>{children}</DataSourceContext.Provider>;
}

export function useDataSource() {
  const ctx = useContext(DataSourceContext);
  if (!ctx) {
    throw new Error('useDataSource must be used inside a DataSourceProvider');
  }
  return ctx;
}

export default DataSourceContext;
