import { useState } from 'react'
import Icon from '../../styles/Icon'
import { PUSH_GRANTED_AT_KEY } from './UserInfoView'

const isPushGranted = () => typeof Notification !== 'undefined' && Notification.permission === 'granted'

export default function UserInfoEditForm({ user, onSave, onCancel, saveError }) {
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone,
    currentPw: '',
    newPw: '',
    confirmPw: '',
  })
  const [errors, setErrors] = useState({})
  const [showPwChange, setShowPwChange] = useState(false)
  const [pushGranted, setPushGranted] = useState(isPushGranted)
  const [pushError, setPushError] = useState('')

  const handlePushToggle = async () => {
    if (pushGranted) return
    setPushError('')
    if (typeof Notification === 'undefined') {
      setPushError('이 브라우저는 알림 기능을 지원하지 않아요.')
      return
    }
    if (Notification.permission === 'denied') {
      setPushError('브라우저에서 알림이 차단되어 있어요. 브라우저 설정에서 이 사이트의 알림 권한을 허용해주세요.')
      return
    }
    const result = await Notification.requestPermission()
    if (result === 'granted') {
      localStorage.setItem(PUSH_GRANTED_AT_KEY, new Date().toISOString().slice(0, 10))
      setPushGranted(true)
    } else {
      setPushError('알림 권한이 거부됐어요.')
    }
  }

  const set = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = '이름을 입력해주세요'
    if (!form.phone.trim()) errs.phone = '전화번호를 입력해주세요'
    if (showPwChange) {
      if (!form.currentPw) errs.currentPw = '현재 비밀번호를 입력해주세요'
      if (form.newPw.length > 0 && form.newPw.length < 8) errs.newPw = '비밀번호는 8자 이상이어야 합니다'
      if (form.newPw && form.newPw !== form.confirmPw) errs.confirmPw = '비밀번호가 일치하지 않습니다'
    }
    return errs
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSave({ name: form.name, phone: form.phone })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={styles.sectionTitle}><Icon name="edit" size={16} color="#111827" style={{marginRight:6}}/>정보 수정</div>

      <Field label="이름" error={errors.name}>
        <input style={inputStyle(!!errors.name)} value={form.name} onChange={set('name')} placeholder="이름 입력" />
      </Field>

      <Field label="이메일">
        <input style={{ ...inputStyle(false), backgroundColor: '#f9fafb', color: '#9ca3af' }} value={user.email} disabled />
      </Field>

      <Field label="전화번호" error={errors.phone}>
        <input style={inputStyle(!!errors.phone)} value={form.phone} onChange={set('phone')} placeholder="010-0000-0000" />
      </Field>

      <div style={styles.pushRow}>
        <div>
          <div style={styles.pushLabel}>푸시 알림</div>
          <div style={styles.pushDesc}>
            {pushGranted ? '정책 마감일, 신청 결과 등을 알려드려요' : '브라우저 알림을 허용하면 켤 수 있어요'}
          </div>
        </div>
        <Switch checked={pushGranted} onChange={handlePushToggle} />
      </div>
      {pushError && <div style={{ ...styles.pushDesc, color: '#ef4444', marginTop: -8, marginBottom: 14 }}>{pushError}</div>}

      <button
        type="button"
        style={styles.pwToggleBtn}
        onClick={() => setShowPwChange(v => !v)}
      >
        <Icon name={showPwChange ? 'expand_less' : 'expand_more'} size={16} style={{marginRight:2}}/> 비밀번호 변경
      </button>

      {showPwChange && (
        <div style={styles.pwSection}>
          <Field label="현재 비밀번호" error={errors.currentPw}>
            <input type="password" style={inputStyle(!!errors.currentPw)} value={form.currentPw} onChange={set('currentPw')} placeholder="현재 비밀번호" />
          </Field>
          <Field label="새 비밀번호" error={errors.newPw}>
            <input type="password" style={inputStyle(!!errors.newPw)} value={form.newPw} onChange={set('newPw')} placeholder="새 비밀번호 (8자 이상)" />
          </Field>
          <Field label="비밀번호 확인" error={errors.confirmPw}>
            <input type="password" style={inputStyle(!!errors.confirmPw)} value={form.confirmPw} onChange={set('confirmPw')} placeholder="비밀번호 재입력" />
          </Field>
        </div>
      )}

      {saveError && (
        <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8, padding: '8px 12px', background: '#fff5f5', borderRadius: 8, border: '1px solid #fecaca' }}>
          {saveError}
        </div>
      )}
      <div style={styles.btnRow}>
        <button type="button" style={styles.cancelBtn} onClick={onCancel}>취소</button>
        <button type="submit" style={styles.saveBtn}>저장</button>
      </div>
    </form>
  )
}

function Switch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        border: 'none',
        padding: 2,
        cursor: 'pointer',
        flexShrink: 0,
        backgroundColor: checked ? '#007FFF' : '#d1d5db',
        transition: 'background-color 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
      }}
    >
      <span style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        transition: 'transform 0.15s',
      }} />
    </button>
  )
}

function Field({ label, error, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={styles.label}>{label}</label>
      {children}
      {error && <div style={styles.error}>{error}</div>}
    </div>
  )
}

const inputStyle = (hasError) => ({
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: `1.5px solid ${hasError ? '#ef4444' : '#d1d5db'}`,
  fontSize: 14,
  color: '#111827',
  backgroundColor: '#ffffff',
})

const styles = {
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 18,
    display: 'flex',
    alignItems: 'center',
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: '#374151',
    marginBottom: 6,
  },
  error: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  pushRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    marginBottom: 14,
  },
  pushLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#111827',
  },
  pushDesc: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  pwToggleBtn: {
    fontSize: 13,
    color: '#007FFF',
    fontWeight: 500,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: '0 0 14px',
    display: 'block',
  },
  pwSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: '14px 14px 2px',
    marginBottom: 14,
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 10,
    border: '1.5px solid #d1d5db',
    backgroundColor: '#ffffff',
    color: '#374151',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  saveBtn: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 10,
    border: 'none',
    backgroundColor: '#007FFF',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
