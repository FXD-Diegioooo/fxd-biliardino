export function ClubArt({ compact = false }: { compact?: boolean }) {
  return <svg className={`club-art ${compact ? 'compact' : ''}`} viewBox="0 0 380 330" fill="none" aria-hidden="true">
    <circle cx="185" cy="166" r="130" fill="#e9f1ff" />
    <g transform="rotate(-12 185 166)"><rect x="62" y="62" width="255" height="205" rx="35" fill="#153d7c"/><rect x="72" y="57" width="235" height="193" rx="29" fill="#77bb9b" stroke="#fff" strokeWidth="7"/><rect x="86" y="72" width="207" height="164" rx="19" stroke="#e7ffec" strokeWidth="2"/><path d="M190 72v164" stroke="#e7ffec" strokeWidth="2"/><circle cx="190" cy="154" r="27" stroke="#e7ffec" strokeWidth="2"/>
      {[111, 194].map((x, i) => <g key={x}><path d={`M${x} 40v225`} stroke="#b9c9e1" strokeWidth="8" strokeLinecap="round"/>{[112,188].map(y => <g key={y}><rect x={x-15} y={y-4} width="30" height="37" rx="9" fill={i ? '#fc6255' : '#3279f5'}/><circle cx={x} cy={y-9} r="12" fill={i ? '#fc6255' : '#3279f5'}/><path d={`M${x-5} ${y-9}v3m10-3v3`} stroke="white" strokeWidth="3" strokeLinecap="round"/></g>)}<rect x={x-8} y="257" width="16" height="34" rx="8" fill="#0d2346"/></g>)}
      <circle cx="240" cy="149" r="10" fill="white"/><path d="m237 141 8 5-3 8h-8l-2-7z" fill="#173558"/>
    </g>
    <path d="m57 66 3-12 6 10 12 2-10 7-3 12-5-11-12-2z" fill="#ffc344"/><path d="m316 211 4-13 6 12 13 3-12 7-3 13-6-12-13-3z" fill="#ffc344"/>
    <path d="m311 76 13-8m-5 24 16-1M51 218l-13 7" stroke="#3279f5" strokeWidth="5" strokeLinecap="round"/>
    <g transform="translate(269 20) rotate(14)"><rect width="66" height="40" rx="14" fill="#ffe8a6"/><path d="m24 14 4 7 5-10 5 10 5-7-3 16H27z" fill="#c78700"/></g>
  </svg>;
}
