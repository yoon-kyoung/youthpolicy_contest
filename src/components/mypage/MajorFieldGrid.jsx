import { useState } from 'react'
import Icon from '../../styles/Icon'

const FIELDS = [
  { id: 'engineering',  label: '공학/IT' },
  { id: 'humanities',   label: '인문/사회' },
  { id: 'arts',         label: '예술/체육' },
  { id: 'medical',      label: '의약/보건' },
  { id: 'education',    label: '교육/사범' },
  { id: 'science',      label: '자연과학' },
  { id: 'business',     label: '경상/경영' },
  { id: 'law',          label: '법학' },
  { id: 'agriculture',  label: '농림/수산' },
  { id: 'architecture', label: '건축/도시' },
]

export default function MajorFieldGrid({ value, onChange, isMobile }) {
  const [expanded, setExpanded] = useState(false)
  const toggle = (id) => {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id])
  }
  const clamp = isMobile && !expanded

  return (
    <div>
      <label style={isMobile ? { ...styles.label, fontSize: 13 } : styles.label}>
        <Icon name="menu_book" size={15} color="#374151"/>
        전공 분야 <span style={styles.multi}>(복수 선택)</span>
      </label>
      <div style={clamp ? { ...styles.group, maxHeight: 74, overflow: 'hidden' } : styles.group}>
        {FIELDS.map(f => {
          const active = value.includes(f.id)
          const s = active ? styles.btnActive : styles.btn
          return (
            <button
              key={f.id}
              type="button"
              style={isMobile ? { ...s, padding: '7px 12px', fontSize: 11.5 } : s}
              onClick={() => toggle(f.id)}
            >
              {f.label}
            </button>
          )
        })}
      </div>
      {isMobile && (
        <button type="button" style={styles.moreBtn} onClick={() => setExpanded(v => !v)}>
          {expanded ? '접기' : '더보기'}
          <span className="material-symbols-rounded" style={{ fontSize: 13, transform: expanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
        </button>
      )}
    </div>
  )
}

const base = {
  padding: '9px 16px',
  borderRadius: 20,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
}

const styles = {
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 14,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 10,
  },
  multi: {
    fontSize: 12,
    fontWeight: 400,
    color: '#9ca3af',
  },
  group: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    ...base,
    border: '1.5px solid #e5e7eb',
    backgroundColor: '#ffffff',
    color: '#374151',
  },
  btnActive: {
    ...base,
    border: '1.5px solid #007FFF',
    backgroundColor: '#F0F7FF',
    color: '#007FFF',
    fontWeight: 600,
  },
  moreBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    marginTop: 8,
    padding: 0,
    border: 'none',
    background: 'none',
    color: '#007FFF',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
