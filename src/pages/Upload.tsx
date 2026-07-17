import {
  CloudDownload,
  History,
  Link2,
  ShieldAlert,
  Upload as UploadIcon,
} from 'lucide-react'
import { useCallback, useMemo, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { MotionCard } from '../components/MotionCard'
import { useData } from '../context/DataContext'
import { isPullDue, parseDriveLink } from '../lib/drive'
import { formatGermanyDateTime } from '../lib/germanyTime'
import type { UploadMode } from '../lib/merge'
import type { ValidationReport } from '../lib/validate'
import type { Snapshot } from '../types'

export function Upload() {
  const {
    cloudEnabled,
    lastSynced,
    snapshot,
    versions,
    driveSettings,
    prepareUpload,
    publishSnapshot,
    restoreVersion,
    pullFromDrive,
    saveDriveUrl,
  } = useData()

  const [password, setPassword] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<UploadMode>('merge')
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [driveUrl, setDriveUrl] = useState(driveSettings.url)
  const [candidate, setCandidate] = useState<Snapshot | null>(null)
  const [report, setReport] = useState<ValidationReport | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [restoreId, setRestoreId] = useState<string | null>(null)

  const driveInfo = useMemo(() => parseDriveLink(driveUrl), [driveUrl])
  const pullDue = isPullDue(driveSettings)

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f) {
      setFile(f)
      setCandidate(null)
      setReport(null)
    }
  }, [])

  async function runValidate(fromFile: File | null) {
    setBusy(true)
    setMsg(null)
    try {
      if (fromFile) {
        const prepared = await prepareUpload(fromFile, mode)
        setCandidate(prepared.candidate)
        setReport(prepared.report)
      } else {
        throw new Error('Choose a file first')
      }
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Validate failed' })
    } finally {
      setBusy(false)
    }
  }

  async function runPublish(force = false) {
    if (!candidate) {
      setMsg({ type: 'err', text: 'Validate a file first' })
      return
    }
    if (!password) {
      setMsg({ type: 'err', text: 'Enter the upload password' })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      await publishSnapshot(candidate, {
        password,
        mode,
        force,
        note: file?.name || candidate.sourceFile,
      })
      setMsg({
        type: 'ok',
        text: force
          ? 'Published with warnings/errors forced. History saved.'
          : cloudEnabled
            ? 'Published & synced. Version saved to history.'
            : 'Published locally. Version saved in this browser.',
      })
      setFile(null)
      setCandidate(null)
      setReport(null)
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Publish failed' })
    } finally {
      setBusy(false)
    }
  }

  async function runDrivePull() {
    saveDriveUrl(driveUrl)
    setBusy(true)
    setMsg(null)
    try {
      const prepared = await pullFromDrive(mode)
      setCandidate(prepared.candidate)
      setReport(prepared.report)
      setFile(null)
      setMsg({
        type: 'ok',
        text: 'Pulled from Drive — review validation, then publish.',
      })
    } catch (e) {
      setMsg({
        type: 'err',
        text:
          e instanceof Error
            ? e.message
            : 'Drive pull failed. Deploy supabase/functions/pull-excel if CORS blocks the browser.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function runRestore(id: string) {
    if (!password) {
      setMsg({ type: 'err', text: 'Enter password to restore' })
      return
    }
    setBusy(true)
    setMsg(null)
    setRestoreId(id)
    try {
      await restoreVersion(id, password)
      setMsg({ type: 'ok', text: 'Restored previous snapshot. Current state was archived.' })
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Restore failed' })
    } finally {
      setBusy(false)
      setRestoreId(null)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Data workflow</h1>
          <p>
            Merge or replace Excel uploads, validate before publish, pull from Drive, and restore
            older versions.
          </p>
        </div>
        <Link className="btn ghost" to="/quick-add">
          Mobile quick-add →
        </Link>
      </div>

      {pullDue && driveSettings.url && (
        <div className="alert-item" style={{ marginBottom: '0.9rem' }}>
          Weekly Drive pull is due
          {driveSettings.lastPulledAt
            ? ` (last ${formatGermanyDateTime(driveSettings.lastPulledAt)})`
            : ' (never pulled)'}
          . Use “Pull from link” below.
        </div>
      )}

      <div className="grid two" style={{ marginBottom: '0.9rem' }}>
        <MotionCard interactive={false}>
          <h2>1 · Upload Excel</h2>
          <div
            className={`dropzone ${drag ? 'drag' : ''}`}
            style={{ marginTop: '0.75rem' }}
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
          >
            <UploadIcon size={26} style={{ marginBottom: 8, opacity: 0.8 }} />
            <strong>Drop tracker .xlsx</strong>
            <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
              or pick from your computer
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setCandidate(null)
                setReport(null)
              }}
            />
            {file && (
              <div style={{ marginTop: '0.65rem', fontWeight: 600 }}>Selected: {file.name}</div>
            )}
          </div>

          <div className="chip-row" style={{ marginTop: '1rem' }}>
            <span className="chip-label">Mode</span>
            <button
              type="button"
              className={`chip ${mode === 'merge' ? 'active' : ''}`}
              onClick={() => {
                setMode('merge')
                setCandidate(null)
                setReport(null)
              }}
            >
              Merge new only
            </button>
            <button
              type="button"
              className={`chip ${mode === 'replace' ? 'active' : ''}`}
              onClick={() => {
                setMode('replace')
                setCandidate(null)
                setReport(null)
              }}
            >
              Replace all
            </button>
          </div>
          <p className="hint-inline" style={{ marginTop: 0 }}>
            {mode === 'merge'
              ? 'Keeps existing history; adds only new transactions / events from the file.'
              : 'Full replace — dashboard becomes exactly what’s in this Excel.'}
          </p>

          <div className="field">
            <label htmlFor="pw">Upload password</label>
            <input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Shared password"
              autoComplete="current-password"
            />
          </div>

          <div className="page-actions">
            <button
              className="btn ghost"
              type="button"
              disabled={busy || !file}
              onClick={() => void runValidate(file)}
            >
              Validate
            </button>
            <button
              className="btn"
              type="button"
              disabled={busy || !candidate}
              onClick={() => void runPublish(false)}
            >
              {busy ? 'Working…' : 'Publish'}
            </button>
          </div>
        </MotionCard>

        <MotionCard interactive={false}>
          <h2>
            <CloudDownload size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
            Drive / OneDrive link
          </h2>
          <p className="hint-inline">
            Paste a share link (“Anyone with the link”). OneDrive/Google usually block browser
            downloads — without Supabase <code>pull-excel</code>, use <strong>Upload Excel</strong>{' '}
            on the left instead.
          </p>
          {!cloudEnabled && (
            <div className="alert-item" style={{ marginBottom: '0.75rem' }}>
              Cloud pull helper not configured (no <code>VITE_SUPABASE_URL</code>). Pull from link
              will fail — upload the .xlsx file manually.
            </div>
          )}
          <div className="field">
            <label htmlFor="drive">Share URL</label>
            <input
              id="drive"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/…"
            />
          </div>
          <div className="badge" style={{ marginBottom: '0.75rem' }}>
            <Link2 size={12} /> {driveInfo.provider}
          </div>
          <p className="hint-inline">{driveInfo.hint}</p>
          <div className="page-actions" style={{ marginTop: '0.85rem' }}>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                saveDriveUrl(driveUrl)
                setMsg({ type: 'ok', text: 'Drive link saved on this device.' })
              }}
            >
              Save link
            </button>
            <button
              className="btn"
              type="button"
              disabled={busy || !driveUrl}
              onClick={() => void runDrivePull()}
            >
              Pull from link
            </button>
          </div>
          {driveSettings.lastPulledAt && (
            <div className="hint-inline" style={{ marginTop: '0.75rem' }}>
              Last pull:{' '}
              {formatGermanyDateTime(driveSettings.lastPulledAt)}
            </div>
          )}
        </MotionCard>
      </div>

      {report && candidate && (
        <div style={{ marginBottom: '0.9rem' }}>
        <MotionCard interactive={false}>
          <div className="card-head">
            <h2>
              <ShieldAlert size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
              Validation before publish
            </h2>
            <span className={`badge ${report.ok ? 'ok' : 'warn'}`}>
              {report.ok ? 'Ready' : 'Has errors'}
            </span>
          </div>
          <div className="chip-row">
            <span className="badge">
              {report.summary.events} events
            </span>
            <span className="badge">
              {report.summary.transactions} transactions
            </span>
            <span className="badge">
              {report.summary.unpaid} unpaid
            </span>
            <span className="badge">
              cash Δ €{report.summary.cashMismatch.toFixed(2)}
            </span>
            {report.merge && (
              <span className="badge ok">
                +{report.merge.addedTransactions} new txs
              </span>
            )}
          </div>
          <div className="alert-list" style={{ marginTop: '0.75rem' }}>
            {report.issues.map((issue) => (
              <div
                key={issue.code + issue.message}
                className="alert-item"
                style={
                  issue.level === 'error'
                    ? { background: 'var(--danger-soft)', borderColor: 'transparent' }
                    : issue.level === 'info'
                      ? { background: 'var(--ok-soft)', borderColor: 'transparent' }
                      : undefined
                }
              >
                <strong style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                  {issue.level}
                </strong>{' '}
                {issue.message}
              </div>
            ))}
          </div>
          {!report.ok && (
            <button
              className="btn ghost"
              type="button"
              style={{ marginTop: '0.85rem' }}
              disabled={busy}
              onClick={() => void runPublish(true)}
            >
              Publish anyway (force)
            </button>
          )}
        </MotionCard>
        </div>
      )}

      {msg && <div className={`msg ${msg.type}`} style={{ marginBottom: '0.9rem' }}>{msg.text}</div>}

      <MotionCard interactive={false}>
        <div className="card-head">
          <h2>
            <History size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
            Upload history
          </h2>
          <span className="hint-inline">
            {versions.length} version{versions.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Mode</th>
                <th>Source</th>
                <th>Size</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td>
                    {formatGermanyDateTime(v.createdAt)}
                  </td>
                  <td>
                    <span className="pill completed">{v.mode}</span>
                  </td>
                  <td>{v.sourceFile}</td>
                  <td>
                    {v.summary.events} ev · {v.summary.transactions} tx
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ padding: '0.35rem 0.65rem' }}
                      disabled={busy}
                      onClick={() => void runRestore(v.id)}
                    >
                      {restoreId === v.id ? '…' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
              {versions.length === 0 && (
                <tr>
                  <td colSpan={5}>No versions yet — publish once to start history.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '1rem' }} className="badge">
          Live snapshot:{' '}
          {lastSynced ? formatGermanyDateTime(lastSynced) : 'never'}
          {snapshot
            ? ` · ${snapshot.events.length} events · ${snapshot.transactions.length} txs`
            : ''}
        </div>
      </MotionCard>
    </>
  )
}
