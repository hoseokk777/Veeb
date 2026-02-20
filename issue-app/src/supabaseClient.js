import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 환경 변수 유효성 검사
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다!')
  console.error('💡 .env 파일을 확인하세요:')
  console.error('   - VITE_SUPABASE_URL')
  console.error('   - VITE_SUPABASE_ANON_KEY')
}

if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
  console.error('❌ VITE_SUPABASE_URL은 https://로 시작해야 합니다!')
  console.error('현재 값:', supabaseUrl)
}

console.log('🔧 Supabase 클라이언트 초기화 중...')
console.log('📍 URL:', supabaseUrl)
console.log('🔑 Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : '없음')

// WebSocket 타임아웃 및 연결 안정성 강화
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10  // 초당 이벤트 제한
    },
    // WebSocket 연결 옵션
    timeout: 30000,  // 30초로 타임아웃 증가 (기본값: 10초)
    heartbeatIntervalMs: 15000,  // 15초마다 heartbeat (기본값: 30초)
  },
  auth: {
    autoRefreshToken: true,
    persistSession: false,  // 익명 사용자이므로 세션 저장 불필요
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'x-client-info': 'my-issue-board-app'
    }
  }
})

// Supabase 연결 테스트
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('❌ Supabase 연결 테스트 실패:', error)
  } else {
    console.log('✅ Supabase 연결 테스트 성공')
  }
})

// 기기 고유 ID 생성 또는 가져오기 (어뷰징 방지용)
export const getDeviceId = () => {
  let deviceId = localStorage.getItem('device_id')

  if (!deviceId) {
    // UUID v4 형식의 고유 ID 생성
    deviceId = crypto.randomUUID()
    localStorage.setItem('device_id', deviceId)
    console.log('🆔 새 기기 ID 생성:', deviceId)
  } else {
    console.log('🆔 기존 기기 ID 사용:', deviceId)
  }

  return deviceId
}

// 두 지점 간의 거리 계산 (Haversine 공식, km 단위)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371 // 지구 반지름 (km)
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return distance
}

const toRad = (degree) => {
  return degree * (Math.PI / 180)
}
