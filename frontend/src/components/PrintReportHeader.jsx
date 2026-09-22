import React from 'react';

/**
 * Only rendered on paper. `print-only` keeps it hidden on screen and visible in
 * the print stylesheet, so the exported report carries a title, timestamp, the
 * active data source and the appropriate disclosure.
 */
export default function PrintReportHeader({ dataSource, nationalReference }) {
  const now = new Date();
  const stamp = now.toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return (
    <div className="print-only print-report-header">
      <h1>PAIMANA-AI Executive Monitoring Report</h1>
      <table className="print-meta">
        <tbody>
          <tr>
            <th>Generated</th>
            <td>{stamp}</td>
          </tr>
          <tr>
            <th>Data Source</th>
            <td>{dataSource?.label || 'Not available'}</td>
          </tr>
          <tr>
            <th>Projects in dataset</th>
            <td>{dataSource?.active_project_count ?? 'Not available'}</td>
          </tr>
          <tr>
            <th>Problem statement</th>
            <td>Smart India Hackathon 2026 &mdash; SIH26103</td>
          </tr>
        </tbody>
      </table>

      <p className="print-disclosure">
        <strong>Data source disclosure:</strong> {dataSource?.disclaimer}
      </p>
      {nationalReference && (
        <p className="print-disclosure">
          <strong>National figures:</strong> {nationalReference.label}, quoted from{' '}
          {nationalReference.source}. These are national reference statistics and are not
          derived from the dataset loaded in this application.
        </p>
      )}
      <p className="print-disclosure">
        <strong>Analysis disclosure:</strong> Risk scores, drivers, alerts and financial
        impact figures in this report are PAIMANA-AI derived analysis produced by a
        prototype engine. They are not official Government of India predictions or
        forecasts. Financial impact values are derived estimates and state the formula used.
      </p>
    </div>
  );
}
