import { useState } from 'react'
import Icon from '../../styles/Icon'

const FIELDS = [
  { id: 'no_limit',      label: '제한없음' },
  { id: 'basic_welfare', label: '기초생활수급자' },
  { id: 'near_poverty',  label: '차상위계층' },
  { id: 'disability',    label: '장애인' },
  { id: 'single_parent', label: '한부모가정' },
  { id: 'female',        label: '여성' },
  { id: 'sme',           label: '중소기업' },
  { id: 'local_talent',  label: '지역인재' },
  { id: 'military',      label: '군인' },
  { id: 'farmer',        label: '농업인' },
  { id: 'multicultural', label: '다문화가정' },
  { id: 'defector',      label: '북한이탈주민' },
  { id: 'career_break',  label: '경력단절자' },
  { id: 'homeless',      label: '무주택자' },
  { id: 'single_hh',     label: '1인가구' },
  { id: 'startup',       label: '(예비)창업자' },
  { id: 'farm_return',   label: '귀농/귀촌' },
  { id: 'low_credit',    label: '금융취약자' },
  { id: 'veteran',       label: '보훈대상자' },
  { id: 'foreign',       label: '외국인/재외동포' },
  { id: 'etc',           label: '기타' },
]

export default function SpecialFieldGrid({ value, onChange, isMobile }) {
  const [expanded, setExpanded] = useState(false)
  const toggle = (id) => {
    if (id === 'no_limit') {
      onChange(value.includes('no_limit') ? [] : ['no_limit'])
      return
    }
    const next = value.includes(id)
      ? value.filter(v => v !== id)
      : [...value.filter(v => v !== 'no_limit'), id]
    onChange(next)
  }
  const clamp = isMobile && !expanded

  return (
    <div>
      <label style={isMobile ? { ...styles.label, fontSize: 13 } : styles.label}>
        <Icon name="grade" size={15} color="#374151"/>
        특화 분야 <span style={styles.multi}>(복수 선택)</span>
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
