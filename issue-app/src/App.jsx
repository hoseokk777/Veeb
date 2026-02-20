import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, getDeviceId, calculateDistance } from './supabaseClient'
// lucide-react 제거 — 인라인 SVG 직접 사용
import './App.css'

// 상단 1줄: 범위 탭
const SCOPE_TABS = [
  { key: 'all', label: '전체' },
  { key: 'popular', label: '인기', emoji: '🔥' },
  { key: 'nearby', label: '내 주변', emoji: '📍' },
]

// 상단 2줄 + 하단 입력용: 주제 카테고리
const CATEGORIES = [
  { key: '사건사고', label: '사건사고', emoji: '🚨' },
  { key: '맛집', label: '맛집', emoji: '🍴' },
  { key: '교통', label: '교통', emoji: '🚌' },
  { key: '행사', label: '행사', emoji: '🎸' },
  { key: '일상', label: '일상', emoji: '💬' },
]

// 전체 탭 참조용 (배지 표시 등)
const ALL_CATEGORIES = [...SCOPE_TABS, ...CATEGORIES]

// 반경 슬라이더 단계 (km)
const RADIUS_STEPS = [0.5, 1, 3, 5, 10]

// 테스트 모드: 위치 권한 없이도 '내 주변' 슬라이더 작동
const FALLBACK_LOCATION = { latitude: 37.5665, longitude: 126.9780 } // 서울 시청
const MOCK_DISTANCES = [0.15, 0.4, 0.8, 1.2, 1.8, 2.5, 3.3, 4.5, 5.8, 7.0, 8.5, 11.0]

// 카드 ID 기반 결정적 가상 거리 반환 (좌표 없는 카드용)
const getMockDistance = (issueId) => {
  let hash = 0
  const str = String(issueId)
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return MOCK_DISTANCES[Math.abs(hash) % MOCK_DISTANCES.length]
}

// 키워드 추출 불용어 (조사, 부사, 대명사, 일반 서술어)
const KW_STOPWORDS = new Set([
  '이', '가', '은', '는', '을', '를', '에', '의', '도', '로', '와', '과',
  '에서', '으로', '에게', '한테', '부터', '까지', '만', '처럼', '같이',
  '보다', '마다', '이랑', '랑', '하고', '나', '너', '저', '우리',
  '이거', '저거', '그거', '여기', '거기', '저기', '그냥', '진짜', '정말',
  '너무', '아주', '매우', '좀', '잘', '안', '못', '다', '더', '또',
  '왜', '어떻게', '아', '오', '헐', 'ㅋㅋ', 'ㅎㅎ', 'ㅠㅠ',
  '그리고', '그래서', '하지만', '그런데', '근데',
  '있다', '없다', '하다', '되다', '같다', '있는', '없는', '하는',
  '있어요', '없어요', '해요', '돼요', '같아요', '있어', '없어',
  '했어', '됐어', '같아', '합니다', '됩니다', '입니다', '해주세요',
  '것', '거', '수', '등', '중', '때', '곳', '분', '명', '개',
  '사람', '오늘', '내일', '어제', '지금', '이번', '요즘',
])
// 한국어 조사 접미사 (긴 것 먼저 매칭)
const KW_SUFFIXES = [
  '에서는', '에서도', '에서', '에게', '한테', '으로', '이랑', '에는',
  '에도', '까지', '부터', '처럼', '같이', '보다', '마다',
  '에', '을', '를', '이', '가', '은', '는', '도', '로', '의', '와', '과', '랑',
]

// 익명 닉네임 풀 (device_id 해시 기반 결정적 선택)
const NICK_MODIFIERS = [
  '잠들지 않는', '예리한', '빛나는', '뜨거운', '조용한',
  '날카로운', '끈질긴', '재빠른', '묵묵한', '감각적인',
  '냉정한', '열정적인', '은밀한', '대담한', '명석한',
]
const NICK_AREAS = [
  '범어동', '신곡동', '역삼동', '홍대', '강남',
  '을지로', '성수동', '이태원', '해운대', '서면',
  '둔산동', '봉선동', '수성구', '연남동', '망원동',
]
const generateNickname = (deviceId) => {
  if (!deviceId) return '익명'
  let hash = 0
  for (let i = 0; i < deviceId.length; i++) {
    hash = ((hash << 5) - hash) + deviceId.charCodeAt(i)
    hash |= 0
  }
  const h = Math.abs(hash)
  return `${NICK_MODIFIERS[h % NICK_MODIFIERS.length]} ${NICK_AREAS[(h >> 8) % NICK_AREAS.length]}`
}

// 영향력 레벨 (게이미피케이션)
const INFLUENCE_LEVELS = [
  { min: 0, label: '관찰자', color: '#666' },
  { min: 10, label: '참여자', color: '#4ECDC4' },
  { min: 30, label: '리포터', color: '#7C5CFC' },
  { min: 60, label: '인플루언서', color: '#FFD93D' },
  { min: 100, label: '레전드', color: '#FF6B6B' },
]

// 키워드 상태 문구 (#{keyword}는 런타임에 치환)
const STATUS_MESSAGES = [
  '실시간 #{keyword} 바이브 포착!',
  '비브가 #{keyword} 이슈를 분석 중입니다',
  '지금 뜨는 #{keyword} 소식만 모았어요',
  '#{keyword} 상황 실시간 관측 중',
]
const CATEGORY_STATUS = {
  '사건사고': ['#{keyword} 긴급 상황을 확인 중입니다', '#{keyword} 현장 소식을 추적 중'],
  '맛집':     ['#{keyword} 맛집 소식을 큐레이션 중', '#{keyword} 근처 핫플을 탐색 중'],
  '교통':     ['#{keyword} 교통 상황을 모니터링 중', '#{keyword} 도로 소식 수집 중'],
  '행사':     ['#{keyword} 행사 정보를 정리 중입니다', '#{keyword} 이벤트 소식을 수집 중'],
}

// 카드 내부 콘텐츠 — memo로 props 미변경 시 리렌더 방지
const IssueCardContent = memo(function IssueCardContent({
  issue, nickname, levelLabel, levelColor, isExpert, isReacted,
  badges, highlightedTitle, views, reactionCount, relativeTime,
  onDelete, onReaction, onShare, onImageClick,
}) {
  return (
    <>
      <div className="issue-header">
        <div className="issue-badges">
          <span className="time-badge">{relativeTime}</span>
          {isExpert && <span className="expert-chip">📢 전문가 제보</span>}
          {badges.map((badge) => (
            <motion.span
              key={badge.type}
              className={`issue-badge badge-${badge.type}`}
              initial={{ opacity: 0, scale: 0.5, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ delay: 0.35, type: "spring", stiffness: 350, damping: 22 }}
            >
              <span className="badge-dot" />
              {badge.type === 'hot' && 'LIVE'}
              {badge.type === 'fresh' && 'LIVE'}
              {badge.type === 'nearby' && (<>📍 현장<span className="badge-distance">{badge.distance}</span></>)}
            </motion.span>
          ))}
        </div>
        <button className="delete-button" onClick={() => onDelete(issue.id)} title="삭제">×</button>
      </div>

      {issue.image_url && (
        <div className="issue-image-container" onClick={() => onImageClick(issue.image_url)}>
          <div className="image-skeleton" />
          <img
            src={issue.image_url}
            alt=""
            className="issue-image"
            loading="lazy"
            onLoad={(e) => {
              e.target.classList.add('loaded')
              e.target.parentElement.classList.add('has-loaded')
            }}
          />
        </div>
      )}

      {issue.title && issue.title.trim() && (
        <div className="issue-content">
          <p className="issue-text">{highlightedTitle}</p>
        </div>
      )}

      <div className="issue-footer">
        <span className="footer-author">
          <span className="author-name">{nickname}</span>
          <span className="author-level" style={{ color: levelColor }}>{levelLabel}</span>
        </span>
        <div className="footer-stats">
          <button
            className={`reaction-button ${isReacted ? 'reacted' : ''}`}
            onClick={(e) => onReaction(e, issue.id)}
          >
            <svg className="reaction-heart" viewBox="0 0 24 24" width="14" height="14"
              fill={isReacted ? 'currentColor' : 'none'}
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span className="reaction-count">{reactionCount > 0 ? reactionCount : ''}</span>
          </button>
          <span className="view-count">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <motion.span
              key={views}
              initial={{ opacity: 0.4, scale: 1.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {views}
            </motion.span>
          </span>
          <button className="share-button" onClick={() => onShare(issue)} title="공유하기">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  )
})

function App() {
  const [issues, setIssues] = useState([])
  // filteredIssues는 useMemo로 동기 계산 (2단계 렌더링 깜빡임 방지)
  const [newIssue, setNewIssue] = useState('')
  const [loading, setLoading] = useState(false)

  const [filter, setFilter] = useState('all')           // 범위: all / popular / nearby
  const [categoryFilter, setCategoryFilter] = useState(null)  // 주제: null(전체) 또는 카테고리 key
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [radiusIdx, setRadiusIdx] = useState(() => {
    const saved = localStorage.getItem('veeb_default_radius')
    return saved !== null ? Number(saved) : 3
  })
  const nearbyRadius = RADIUS_STEPS[radiusIdx]
  const [currentTime, setCurrentTime] = useState(Date.now())

  // 이미지 업로드 상태
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  // 카테고리 선택 상태 (입력 폼용, 기본값: '일상')
  const [selectedCategory, setSelectedCategory] = useState('일상')

  // 키워드 대시보드 선택 상태
  const [activeKeyword, setActiveKeyword] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')

  // 조회 기록 (세션 내 중복 방지)
  const [viewedIds] = useState(() => {
    const viewed = new Set()
    try {
      const stored = sessionStorage.getItem('veeb_viewed_ids')
      if (stored) JSON.parse(stored).forEach(id => viewed.add(id))
    } catch {}
    return viewed
  })

  // My Vibe 패널
  const [controlOpen, setControlOpen] = useState(false)

  // 관심 키워드 (localStorage 영속)
  const [alertKeywords, setAlertKeywords] = useState(() => {
    try { return JSON.parse(localStorage.getItem('veeb_alert_keywords') || '[]') }
    catch { return [] }
  })
  const [newAlertKeyword, setNewAlertKeyword] = useState('')

  // 기본 반경 설정 (localStorage 영속)
  const [defaultRadiusIdx, setDefaultRadiusIdx] = useState(() => {
    const saved = localStorage.getItem('veeb_default_radius')
    return saved !== null ? Number(saved) : 3
  })

  // 토스트 메시지
  const [toast, setToast] = useState('')

  // 이미지 확대 모달
  const [lightboxSrc, setLightboxSrc] = useState(null)

  // 폭죽 파티클 상태
  const [confetti, setConfetti] = useState([])

  // 공감 리액션 상태 (localStorage 기반)
  const [reactedIds, setReactedIds] = useState(() => {
    const reacted = new Set()
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('veeb_reacted_')) {
        reacted.add(key.replace('veeb_reacted_', ''))
      }
    }
    return reacted
  })

  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const channelRef = useRef(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const filterKey = `${filter}-${categoryFilter}`
  const prevFilterRef = useRef(filterKey)

  // BroadcastChannel ref (같은 브라우저 탭 간 동기화)
  const broadcastRef = useRef(null)

  // Intersection Observer (스마트 조회수)
  const observerRef = useRef(null)
  const viewTimersRef = useRef(new Map())
  const issuesRef = useRef(issues)
  const reactedIdsRef = useRef(reactedIds)

  useEffect(() => {
    issuesRef.current = issues
  }, [issues])

  useEffect(() => {
    reactedIdsRef.current = reactedIds
  }, [reactedIds])

  useEffect(() => {
    prevFilterRef.current = filterKey
  })

  // My Vibe 열릴 때 body 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = controlOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [controlOpen])

  // 초기 이슈 목록 로드
  useEffect(() => {
    fetchIssues()
  }, [])

  // 상대 시간 자동 갱신 (1분마다)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // GPS 실시간 추적 (위치 변경 시 자동으로 거리 재계산)
  useEffect(() => {
    if (!navigator.geolocation) {
      // 지오로케이션 미지원 → 서울 중심 폴백
      console.warn('📍 Geolocation 미지원 → 서울 중심 폴백')
      setUserLocation(FALLBACK_LOCATION)
      return
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
      },
      () => {
        // GPS 오류 시 폴백 (앱이 멈추지 않도록)
        setUserLocation(prev => prev || FALLBACK_LOCATION)
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // ============================================================
  // 스마트 조회수: 카드 50% 이상 노출 + 1초 체류 시 views +1
  // ============================================================
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const issueId = entry.target.dataset.issueId
          if (!issueId || issueId.startsWith('temp-')) return

          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // 이미 카운트했거나 타이머 진행 중이면 무시
            if (viewedIds.has(issueId) || viewTimersRef.current.has(issueId)) return

            const timerId = setTimeout(() => {
              viewTimersRef.current.delete(issueId)
              if (viewedIds.has(issueId)) return

              viewedIds.add(issueId)
              try {
                sessionStorage.setItem('veeb_viewed_ids', JSON.stringify(Array.from(viewedIds)))
              } catch {}

              // 낙관적 조회수 증가
              const current = issuesRef.current.find(i => i.id === issueId)
              const newViews = (current?.views || 0) + 1

              setIssues(prev => prev.map(i =>
                i.id === issueId ? { ...i, views: newViews } : i
              ))

              // DB 업데이트 (fire-and-forget)
              supabase.from('issues')
                .update({ views: newViews })
                .eq('id', issueId)
                .then(({ error }) => {
                  if (error) console.warn('조회수 업데이트 실패:', error.message)
                })
            }, 1000)

            viewTimersRef.current.set(issueId, timerId)
          } else {
            // 화면에서 벗어남 → 타이머 취소
            const timerId = viewTimersRef.current.get(issueId)
            if (timerId) {
              clearTimeout(timerId)
              viewTimersRef.current.delete(issueId)
            }
          }
        })
      },
      { threshold: 0.5 }
    )

    return () => {
      observerRef.current?.disconnect()
      viewTimersRef.current.forEach(id => clearTimeout(id))
      viewTimersRef.current.clear()
    }
  }, [])

  // ============================================================
  // BroadcastChannel 동기화 (같은 브라우저의 다른 탭/창 간)
  // ============================================================
  useEffect(() => {
    const bc = new BroadcastChannel('veeb_sync')
    broadcastRef.current = bc

    bc.onmessage = (event) => {
      const { type, issue, issueId } = event.data

      if (type === 'NEW_ISSUE' && issue) {
        // 수신 데이터 검증
        console.log('📡 BroadcastChannel 수신 [NEW_ISSUE]:', {
          id: issue.id,
          title: issue.title?.substring(0, 20),
          hasImage: !!issue.image_url,
          imageLength: issue.image_url ? issue.image_url.length : 0,
          imageSrc시작: issue.image_url ? issue.image_url.substring(0, 40) : 'null',
          imageSize: issue.image_url ? Math.round(issue.image_url.length / 1024) + 'KB' : '없음'
        })

        // 깊은 복사로 새 객체 생성 (React 리렌더링 보장)
        const newIssue = { ...issue }

        // 중복 방지: ID 체크 후 추가
        setIssues(current => {
          const idx = current.findIndex(i => i.id === newIssue.id)
          if (idx >= 0) {
            // 이미 있지만 이미지가 없었으면 병합
            if (newIssue.image_url && !current[idx].image_url) {
              const merged = current.map((item, i) =>
                i === idx ? { ...item, image_url: newIssue.image_url } : item
              )
              console.log('🔄 BroadcastChannel: 기존 이슈에 이미지 병합')
              return merged
            }
            return current
          }
          // 새 배열 참조 생성 (깊은 복사)
          const nextState = [newIssue, ...current]
          console.log('➕ BroadcastChannel: 새 이슈 추가 (이미지:', !!newIssue.image_url, ')')
          return nextState
        })
      }

      if (type === 'DELETE_ISSUE' && issueId) {
        console.log('📡 BroadcastChannel 수신 [DELETE_ISSUE]:', issueId)
        setIssues(current => current.filter(i => i.id !== issueId))
      }

      if (type === 'UPDATE_REACTION' && issue) {
        console.log('📡 BroadcastChannel 수신 [UPDATE_REACTION]:', issue.id, issue.reaction_count)
        // map은 항상 새 배열을 반환하므로 리렌더링 보장
        setIssues(current =>
          current.map(i =>
            i.id === issue.id ? { ...i, reaction_count: issue.reaction_count } : i
          )
        )
      }
    }

    console.log('📡 BroadcastChannel "veeb_sync" 연결 완료')

    return () => {
      bc.close()
      broadcastRef.current = null
      console.log('📡 BroadcastChannel 해제')
    }
  }, [])

  // ============================================================
  // Supabase Realtime 구독 (다른 기기/브라우저 간 동기화)
  // ============================================================
  useEffect(() => {
    let isSubscribed = true

    const setupRealtimeSubscription = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }

      const channelName = `issues-realtime-${Date.now()}`
      const channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: false },
            presence: { key: '' }
          }
        })
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'issues' },
          async (payload) => {
            let newIssue = payload.new
            console.log('📥 Realtime INSERT:', {
              id: newIssue?.id,
              hasImage: !!newIssue?.image_url
            })

            // image_url 누락 시 DB에서 보완
            if (newIssue && !newIssue.image_url) {
              const { data: fullRow } = await supabase
                .from('issues')
                .select('*')
                .eq('id', newIssue.id)
                .single()

              if (fullRow?.image_url) {
                console.log('🔄 Realtime 누락 보완 - DB 조회:', Math.round(fullRow.image_url.length / 1024) + 'KB')
                newIssue = fullRow
              }
            }

            setIssues((current) => {
              // 이미 존재하는 카드 (낙관적 업데이트 포함) 검사
              const idx = current.findIndex(issue => issue.id === newIssue.id)
              if (idx >= 0) {
                // 이미지 보완만 필요한 경우
                if (newIssue.image_url && !current[idx].image_url) {
                  const updated = [...current]
                  updated[idx] = { ...current[idx], image_url: newIssue.image_url }
                  return updated
                }
                return current
              }
              // 낙관적 카드와 device_id로 매칭 (tempId→realId 전환 타이밍 이슈)
              const tempIdx = current.findIndex(issue =>
                String(issue.id).startsWith('temp-') &&
                issue.device_id === newIssue.device_id &&
                issue.title === newIssue.title
              )
              if (tempIdx >= 0) {
                const updated = [...current]
                updated[tempIdx] = { ...newIssue, _stableKey: current[tempIdx]._stableKey }
                return updated
              }
              return [newIssue, ...current]
            })
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'issues' },
          async (payload) => {
            let updated = payload.new

            if (updated && !updated.image_url) {
              const { data: fullRow } = await supabase
                .from('issues')
                .select('*')
                .eq('id', updated.id)
                .single()
              if (fullRow?.image_url) updated = fullRow
            }

            setIssues((current) =>
              current.map((issue) => {
                if (issue.id !== updated.id) return issue
                // _stableKey 보존 + 이미지 보존
                const preserved = {
                  ...updated,
                  ...(issue._stableKey ? { _stableKey: issue._stableKey } : {}),
                  ...(issue.image_url && !updated.image_url ? { image_url: issue.image_url } : {}),
                }
                return preserved
              })
            )
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'issues' },
          (payload) => {
            setIssues((current) => current.filter((issue) => issue.id !== payload.old.id))
          }
        )
        .subscribe((status, err) => {
          if (!isSubscribed) return
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime 구독 성공')
            reconnectAttempts.current = 0
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            attemptReconnect()
          }
        })

      channelRef.current = channel
    }

    const attemptReconnect = () => {
      if (!isSubscribed) return
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 10000)
        setTimeout(() => { if (isSubscribed) setupRealtimeSubscription() }, delay)
      }
    }

    setupRealtimeSubscription()

    return () => {
      isSubscribed = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  // ============================================================
  // 실시간 트렌드 키워드 추출 (1시간 이내 인기 글 기반)
  // ============================================================
  const trendKeywords = useMemo(() => {
    const now = Date.now()
    const HOUR = 3600000

    const recentIssues = issues.filter(i =>
      now - new Date(i.created_at).getTime() < HOUR
    )
    if (recentIssues.length === 0) return []

    const wordScores = new Map()

    recentIssues.forEach(issue => {
      const ageMs = now - new Date(issue.created_at).getTime()
      const base = (issue.views || 0) + (issue.reaction_count || 0) * 5
      const freshness = 1 - ageMs / HOUR
      const postScore = base * (1 + freshness * 9) + freshness * 50

      const tokens = (issue.title || '')
        .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
        .split(/\s+/)
        .map(w => {
          // 조사 접미사 제거 (긴 것부터 매칭)
          for (const sfx of KW_SUFFIXES) {
            if (w.length > sfx.length + 1 && w.endsWith(sfx)) {
              return w.slice(0, -sfx.length)
            }
          }
          return w
        })
        .filter(w => w.length >= 2 && !KW_STOPWORDS.has(w))

      // 같은 글 내 중복 단어 제거
      const unique = [...new Set(tokens)]
      unique.forEach(word => {
        const prev = wordScores.get(word) || { score: 0, count: 0 }
        // 3글자 이상 → 구체적 키워드 가중치 1.5배
        const lengthBonus = word.length >= 3 ? 1.5 : 1
        wordScores.set(word, {
          score: prev.score + postScore * lengthBonus,
          count: prev.count + 1,
        })
      })
    })

    return Array.from(wordScores.entries())
      .map(([word, { score, count }]) => ({ word, score, count }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }, [issues, currentTime])

  // 내 활동 파생 데이터 (Local First — device_id 기반)
  const myDeviceId = useMemo(() => getDeviceId(), [])
  const myPosts = useMemo(() =>
    issues.filter(i => i.device_id === myDeviceId),
    [issues, myDeviceId]
  )

  // 유저별 통계 (뱃지 + 영향력 계산용)
  const userStats = useMemo(() => {
    const stats = {}
    issues.forEach(issue => {
      const did = issue.device_id
      if (!did) return
      if (!stats[did]) stats[did] = { posts: 0, reactions: 0, categories: {} }
      stats[did].posts++
      stats[did].reactions += (issue.reaction_count || 0)
      const cat = issue.category || '일상'
      stats[did].categories[cat] = (stats[did].categories[cat] || 0) + 1
    })
    return stats
  }, [issues])

  // 현장 전문가 뱃지 판정
  const getUserBadges = (deviceId) => {
    const stat = userStats[deviceId]
    if (!stat) return []
    const badges = []
    Object.entries(stat.categories).forEach(([cat, count]) => {
      if (count >= 3 && stat.reactions >= 5) {
        badges.push({ type: 'expert', label: `${cat} 전문가`, emoji: '🏅' })
      }
    })
    if (stat.posts >= 5) badges.push({ type: 'active', label: '활동가', emoji: '⚡' })
    if (stat.reactions >= 20) badges.push({ type: 'loved', label: '공감 리더', emoji: '💜' })
    return badges
  }

  // 영향력 지수 계산
  const getInfluenceScore = (deviceId) => {
    const stat = userStats[deviceId]
    if (!stat) return 0
    return stat.posts * 2 + stat.reactions * 3
  }

  // 영향력 레벨 판정
  const getInfluenceLevel = (score) => {
    for (let i = INFLUENCE_LEVELS.length - 1; i >= 0; i--) {
      if (score >= INFLUENCE_LEVELS[i].min) return INFLUENCE_LEVELS[i]
    }
    return INFLUENCE_LEVELS[0]
  }

  // 다음 레벨까지 남은 점수
  const getNextLevelInfo = (score) => {
    for (let i = 0; i < INFLUENCE_LEVELS.length; i++) {
      if (score < INFLUENCE_LEVELS[i].min) {
        return { next: INFLUENCE_LEVELS[i], remaining: INFLUENCE_LEVELS[i].min - score }
      }
    }
    return null // 최고 레벨
  }

  // 서버 동기화 대비 로컬 데이터 내보내기 (Auth 연동 시 사용)
  const exportLocalData = () => ({
    device_id: myDeviceId,
    nickname: generateNickname(myDeviceId),
    alert_keywords: alertKeywords,
    default_radius: defaultRadiusIdx,
    reacted_ids: [...reactedIds],
  })

  // 반경 슬라이더 안내 문구 (변경 시 랜덤)
  const radiusMessage = useMemo(() => {
    const label = nearbyRadius < 1 ? `${nearbyRadius * 1000}m` : `${nearbyRadius}km`
    const pool = [
      `내 주변 ${label} 이내를 관측 중`,
      `반경 ${label} 실시간 스캔 중`,
      `${label} 이내 현장 소식을 수집 중`,
    ]
    return pool[Math.floor(Math.random() * pool.length)]
  }, [radiusIdx])

  // nearby 탭에서 위치 없을 때 요청 (side-effect 분리)
  useEffect(() => {
    if (filter === 'nearby' && !userLocation) {
      requestLocation()
    }
  }, [filter, userLocation])

  // 필터 결과를 동기 계산 (useMemo → setFilteredIssues 2단계 없이 즉시 반영)
  const filteredIssues = useMemo(() => {
    let result = issues

    // 1단계: 범위 필터
    if (filter === 'popular') {
      const now = Date.now()
      const HOUR = 3600000
      const getHotScore = (issue) => {
        const ageMs = now - new Date(issue.created_at).getTime()
        const base = (issue.views || 0) + (issue.reaction_count || 0) * 5
        // 관심 키워드 매칭 시 가중치 부여
        const kwBonus = alertKeywords.length > 0 &&
          alertKeywords.some(kw => (issue.title || '').includes(kw)) ? 30 : 0
        // 고등급 유저 가중치 (영향력 지수 비례)
        const authorInfluence = getInfluenceScore(issue.device_id)
        const influenceBonus = Math.min(authorInfluence * 0.3, 20) // 최대 +20
        if (ageMs < HOUR) {
          const freshness = 1 - ageMs / HOUR
          return base * (1 + freshness * 9) + freshness * 50 + kwBonus + influenceBonus
        }
        return base + kwBonus + influenceBonus
      }
      result = [...result].sort((a, b) => getHotScore(b) - getHotScore(a))
    } else if (filter === 'nearby') {
      const loc = userLocation || FALLBACK_LOCATION
      result = result.filter((issue) => {
        // 실제 좌표가 있으면 정확한 거리 계산
        if (issue.latitude && issue.longitude) {
          return calculateDistance(
            loc.latitude, loc.longitude,
            parseFloat(issue.latitude), parseFloat(issue.longitude)
          ) <= nearbyRadius
        }
        // 좌표 없는 카드 → 가상 거리로 필터링 (테스트 모드)
        return getMockDistance(issue.id) <= nearbyRadius
      })
    }

    // 2단계: 주제 카테고리 필터
    if (categoryFilter) {
      result = result.filter(issue => (issue.category || '일상') === categoryFilter)
    }

    // 3단계: 키워드 필터
    if (activeKeyword) {
      result = result.filter(issue => (issue.title || '').includes(activeKeyword))
    }

    return result
  }, [filter, categoryFilter, activeKeyword, nearbyRadius, issues, userLocation, currentTime, alertKeywords, userStats])

  // 이슈 목록 가져오기
  const fetchIssues = async () => {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ 이슈 로드 오류:', error)
    } else {
      console.log('✅ 이슈 로드 완료:', data?.length || 0, '개')
      setIssues(data || [])
    }
  }

  // 사용자 위치 정보 요청 (실패 시 서울 중심 폴백 → 앱이 절대 멈추지 않음)
  const requestLocation = () => {
    if (!navigator.geolocation) {
      console.warn('📍 Geolocation 미지원 → 서울 중심 폴백')
      setUserLocation(FALLBACK_LOCATION)
      setLocationError(null)
      return
    }
    setLocationLoading(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
        setLocationLoading(false)
      },
      (error) => {
        // GPS 실패해도 폴백 위치로 정상 작동
        console.warn('📍 위치 권한 거부/실패 → 서울 중심 폴백:', error.message)
        setUserLocation(FALLBACK_LOCATION)
        setLocationError(null)
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  // 이미지 선택 핸들러
  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 크기는 5MB 이하여야 합니다')
      e.target.value = ''
      return
    }
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다')
      e.target.value = ''
      return
    }

    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setSelectedImage(file)
    setImagePreview(URL.createObjectURL(file))

    requestAnimationFrame(() => { inputRef.current?.focus() })
  }

  // 이미지 선택 취소
  const handleRemoveImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // 이미지 초저용량 압축 → base64 (Canvas 400px + JPEG 50% → 동기화 전송 최우선)
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const blobUrl = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(blobUrl)

        const canvas = document.createElement('canvas')
        let { width, height } = img
        const MAX_WIDTH = 400

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width)
          width = MAX_WIDTH
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        const result = canvas.toDataURL('image/jpeg', 0.5)

        console.log('🖼️ 이미지 초저용량 압축:', {
          변환: `${img.width}x${img.height} → ${width}x${height}`,
          품질: '0.5 (50%)',
          크기: Math.round(result.length / 1024) + 'KB',
          base64시작: result.substring(0, 30) + '...'
        })

        resolve(result)
      }
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl)
        console.error('❌ 이미지 로드 실패')
        resolve(null)
      }
      img.src = blobUrl
    })
  }

  // ============================================================
  // 이슈 추가 (낙관적 업데이트: 카드 먼저 → DB/위치는 백그라운드)
  // ============================================================
  const handleAddIssue = async (e) => {
    e.preventDefault()
    if (!newIssue.trim() && !selectedImage) return
    if (!selectedCategory) return

    setLoading(true)

    // 이미지 압축 (로컬 작업이라 빠름)
    let imageBase64 = null
    if (selectedImage) {
      imageBase64 = await compressImage(selectedImage)
      if (!imageBase64) console.warn('⚠️ 이미지 압축 실패 → 텍스트만 전송')
    }

    // 즉시 사용할 위치: watchPosition이 갱신한 최신 userLocation 사용
    const quickLoc = userLocation || null

    // 임시 ID로 낙관적 카드 생성 (_stableKey로 키 안정성 보장)
    const tempId = `temp-${Date.now()}`
    const stableKey = `stable-${Date.now()}`
    const optimisticIssue = {
      id: tempId,
      _stableKey: stableKey,
      title: newIssue.trim() || ' ',
      status: 'open',
      created_at: new Date().toISOString(),
      device_id: getDeviceId(),
      latitude: quickLoc?.latitude || null,
      longitude: quickLoc?.longitude || null,
      reaction_count: 0,
      category: selectedCategory,
      views: 0,
      ...(imageBase64 ? { image_url: imageBase64 } : {})
    }

    // 1) UI에 카드 즉시 표시 (낙관적 업데이트)
    setIssues(current => [optimisticIssue, ...current])

    // 입력 즉시 초기화 (사용자는 바로 다음 글 작성 가능)
    const prevNewIssue = newIssue
    const prevImagePreview = imagePreview
    setNewIssue('')
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setLoading(false)
    requestAnimationFrame(() => { inputRef.current?.focus() })

    // 2) 백그라운드: DB 저장
    const issueData = {
      title: optimisticIssue.title,
      status: 'open',
      device_id: getDeviceId(),
      latitude: quickLoc?.latitude || null,
      longitude: quickLoc?.longitude || null,
      category: selectedCategory,
      ...(imageBase64 ? { image_url: imageBase64 } : {})
    }

    let { data, error } = await supabase.from('issues').insert([issueData]).select()

    // DB 컬럼 누락 시 단계적 재시도
    if (error) {
      console.warn('⚠️ Insert 실패, 재시도:', error.message)

      // 1차 재시도: image_url 제거 (가장 흔한 원인)
      const { image_url: _img, ...withoutImage } = issueData
      const retry1 = await supabase.from('issues').insert([withoutImage]).select()

      if (!retry1.error) {
        data = retry1.data
        error = null
        if (data?.[0] && imageBase64) data[0].image_url = imageBase64
      } else {
        // 2차 재시도: 기본 필드만 (category, views 등 확장 컬럼 모두 제거)
        console.warn('⚠️ 2차 재시도: 기본 필드만 사용')
        const fallbackData = {
          title: issueData.title,
          status: 'open',
          device_id: issueData.device_id,
          latitude: issueData.latitude,
          longitude: issueData.longitude,
        }
        const retry2 = await supabase.from('issues').insert([fallbackData]).select()
        data = retry2.data
        error = retry2.error

        // 성공 시 UI용 확장 필드 복원
        if (!error && data?.[0]) {
          if (imageBase64) data[0].image_url = imageBase64
          data[0].category = selectedCategory || '일상'
          data[0].views = 0
          data[0].reaction_count = 0
        }
      }
    }

    if (error) {
      console.error('❌ DB 저장 실패:', error)
      // 낙관적 카드 제거
      setIssues(current => current.filter(i => i.id !== tempId))
      alert('이슈 추가에 실패했습니다: ' + error.message)
    } else {
      const savedIssue = data[0]
      if (imageBase64 && !savedIssue.image_url) savedIssue.image_url = imageBase64

      // 3) 임시 카드 → 실제 DB 데이터로 교체 (_stableKey 보존)
      setIssues(current =>
        current.map(i => i.id === tempId ? { ...savedIssue, _stableKey: stableKey } : i)
      )

      // 4) BroadcastChannel 전송
      if (broadcastRef.current) {
        broadcastRef.current.postMessage({
          type: 'NEW_ISSUE',
          issue: { ...savedIssue }
        })
      }
    }

    if (prevImagePreview) URL.revokeObjectURL(prevImagePreview)
  }

  // 이슈 삭제
  // 공유하기 (useCallback — 외부 상태 미사용, 안정적 참조)
  const handleShare = useCallback(async (issue) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${issue.id}`
    const shareData = {
      title: '[Veeb] 현장 전문가의 실시간 제보!',
      text: `${issue.title}\n\n`,
      url: shareUrl,
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${issue.title}\n${shareUrl}`)
        setToast('링크가 복사되었습니다')
        setTimeout(() => setToast(''), 1800)
      }
    } catch (err) {
      // 사용자가 공유 취소한 경우 무시
      if (err.name !== 'AbortError') {
        await navigator.clipboard.writeText(`${shareData.title}\n${issue.title}\n${shareUrl}`)
        setToast('링크가 복사되었습니다')
        setTimeout(() => setToast(''), 1800)
      }
    }
  }, [])

  // 이슈 삭제 (useCallback — broadcastRef만 사용, 안정적 참조)
  const handleDeleteIssue = useCallback(async (id) => {
    if (!confirm('이 이슈를 삭제하시겠습니까?')) return

    const { error } = await supabase.from('issues').delete().eq('id', id)

    if (error) {
      console.error('❌ 이슈 삭제 오류:', error)
      alert('이슈 삭제에 실패했습니다')
    } else {
      // BroadcastChannel로 삭제 알림
      if (broadcastRef.current) {
        broadcastRef.current.postMessage({ type: 'DELETE_ISSUE', issueId: id })
        console.log('📡 BroadcastChannel 전송 [DELETE_ISSUE]:', id)
      }
    }
  }, [])

  // 공감 리액션 핸들러 (useCallback + ref 패턴 — 안정적 참조)
  const handleReaction = useCallback(async (e, issueId) => {
    const isReacted = reactedIdsRef.current.has(issueId)

    // 폭죽 파티클
    const rect = e.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top
    const confettiId = Date.now()
    const colors = ['#7C5CFC', '#A78BFA', '#A855F7', '#818CF8', '#C084FC']
    const particles = Array.from({ length: 16 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 160,
      y: -(Math.random() * 80 + 20) + (Math.random() - 0.3) * 40,
      rotation: Math.random() * 540 - 270,
      scale: 0.4 + Math.random() * 0.6,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 5,
      delay: Math.random() * 0.05
    }))
    setConfetti(prev => [...prev, { id: confettiId, x, y, particles }])
    setTimeout(() => { setConfetti(prev => prev.filter(c => c.id !== confettiId)) }, 900)

    const delta = isReacted ? -1 : 1
    const currentIssue = issuesRef.current.find(i => i.id === issueId)
    const newCount = Math.max(0, (currentIssue?.reaction_count || 0) + delta)

    setReactedIds(prev => {
      const next = new Set(prev)
      if (isReacted) {
        next.delete(issueId)
        localStorage.removeItem(`veeb_reacted_${issueId}`)
      } else {
        next.add(issueId)
        localStorage.setItem(`veeb_reacted_${issueId}`, 'true')
      }
      return next
    })

    setIssues(prev => prev.map(issue =>
      issue.id === issueId ? { ...issue, reaction_count: newCount } : issue
    ))

    // BroadcastChannel로 리액션 동기화
    if (broadcastRef.current) {
      broadcastRef.current.postMessage({
        type: 'UPDATE_REACTION',
        issue: { id: issueId, reaction_count: newCount }
      })
    }

    const { error: reactionError } = await supabase
      .from('issues')
      .update({ reaction_count: newCount })
      .eq('id', issueId)

    if (reactionError) {
      console.warn('⚠️ 리액션 DB 업데이트 실패:', reactionError.message)
    }
  }, [])

  // 거리 계산 (km 단위 반환) — 좌표 없으면 가상 거리 사용
  const getDistance = (issue) => {
    const loc = userLocation || FALLBACK_LOCATION
    // 실제 좌표가 있으면 정확한 거리 계산
    if (issue.latitude && issue.longitude) {
      return calculateDistance(
        loc.latitude, loc.longitude,
        parseFloat(issue.latitude), parseFloat(issue.longitude)
      )
    }
    // 좌표 없는 카드 → 가상 거리 반환 (테스트 모드)
    return getMockDistance(issue.id)
  }

  // 60분(1시간) 이내 여부
  const isWithin60Min = (issue) => {
    return currentTime - new Date(issue.created_at).getTime() < 60 * 60 * 1000
  }

  // 3축 배지 결정 (인기 / 최신 / 현장) — 복수 배지 반환
  const getBadges = (issue) => {
    const badges = []

    // 🔴 빨강 LIVE: 인기 급상승 (시간 무관, 점수 기준)
    // TODO: 실서비스 임계치로 복원 → score >= 50
    // 현재: 테스트용 강제 활성화 (score > 0)
    const score = (issue.views || 0) + (issue.reaction_count || 0) * 5
    if (score > 0) {
      badges.push({ type: 'hot' })
    }

    // 🟢 초록 LIVE: 최신 1시간 이내
    const fresh = isWithin60Min(issue)
    if (fresh) {
      badges.push({ type: 'fresh' })
    }

    // 📍 현장: 1시간 이내 + 5km 이내
    if (fresh) {
      const dist = getDistance(issue)
      if (dist !== null && dist <= 5) {
        const meters = dist * 1000
        const label = meters < 50 ? '바로 근처'
          : meters < 1000 ? Math.round(meters / 10) * 10 + 'm'
          : dist.toFixed(1).replace(/\.0$/, '') + 'km'
        badges.push({ type: 'nearby', distance: label })
      }
    }

    return badges
  }

  // 키워드 칩 클릭 핸들러 (랜덤 문구 + 카테고리별 조건부)
  const handleKeywordClick = (word) => {
    if (activeKeyword === word) {
      setActiveKeyword(null)
      setStatusMessage('')
      return
    }
    setActiveKeyword(word)
    // 카테고리 필터가 활성화된 경우 전용 문구 풀 우선 사용
    const pool = (categoryFilter && CATEGORY_STATUS[categoryFilter]) || STATUS_MESSAGES
    const template = pool[Math.floor(Math.random() * pool.length)]
    setStatusMessage(template.replace('#{keyword}', word))
  }

  // 관심 키워드 추가 (쉼표 구분 멀티 입력 + # 자동 처리)
  const handleAddAlertKeyword = (e) => {
    e.preventDefault()
    const raw = newAlertKeyword
    // 쉼표로 분리 → 각각 트림 + # 제거 → 빈 문자열/중복 제외
    const newKws = raw.split(',')
      .map(s => s.trim().replace(/^#+/, ''))
      .filter(s => s.length > 0 && !alertKeywords.includes(s))
    if (newKws.length === 0) return
    // 기존 목록에 없는 것만 추가
    const updated = [...alertKeywords, ...newKws]
    setAlertKeywords(updated)
    localStorage.setItem('veeb_alert_keywords', JSON.stringify(updated))
    setNewAlertKeyword('')
  }

  // 관심 키워드 삭제
  const handleRemoveAlertKeyword = (idx) => {
    const updated = alertKeywords.filter((_, i) => i !== idx)
    setAlertKeywords(updated)
    localStorage.setItem('veeb_alert_keywords', JSON.stringify(updated))
  }

  // 기본 반경 변경 (My Vibe → 즉시 반영 + localStorage 저장)
  const handleDefaultRadiusChange = (idx) => {
    setDefaultRadiusIdx(idx)
    setRadiusIdx(idx)
    localStorage.setItem('veeb_default_radius', String(idx))
  }

  // 제목 내 관심 키워드 하이라이트
  const highlightKeywords = (text) => {
    if (!text || alertKeywords.length === 0) return text
    // 키워드를 정규식으로 매칭 (긴 것 우선)
    const sorted = [...alertKeywords].sort((a, b) => b.length - a.length)
    const escaped = sorted.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const regex = new RegExp(`(${escaped.join('|')})`, 'g')
    const parts = text.split(regex)
    if (parts.length === 1) return text
    return parts.map((part, i) =>
      escaped.some(e => new RegExp(`^${e}$`).test(part))
        ? <mark key={i} className="kw-highlight">{part}</mark>
        : part
    )
  }

  // 조회수 포맷 (1000+ → 1.2k)
  const formatViews = (views) => {
    if (!views || views <= 0) return '0'
    if (views < 1000) return String(views)
    return (views / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  }

  // 시간 포맷팅
  const formatRelativeTime = (timestamp) => {
    const created = new Date(timestamp)
    const diffMs = currentTime - created.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffSecs < 10) return '방금 전'
    if (diffSecs < 60) return `${diffSecs}초 전`
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`

    return created.toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric'
    })
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <h1 className="brand-logo">Veeb</h1>
          <span className="brand-slogan">The Real Vibe</span>
        </div>
        <button className="control-btn" onClick={() => setControlOpen(true)} title="My Vibe" />
      </header>

      <div className="filter-section">
        <div className="scope-tabs">
          {SCOPE_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`scope-tab ${filter === tab.key ? 'active' : ''}`}
              onClick={() => {
                if (filter === tab.key) {
                  // 같은 탭 재클릭 → 카테고리 필터 초기화
                  setCategoryFilter(null)
                } else {
                  setFilter(tab.key)
                }
              }}
              disabled={tab.key === 'nearby' && locationLoading}
            >
              {tab.emoji && <span className="tab-emoji">{tab.emoji}</span>}
              {tab.label}
            </button>
          ))}
        </div>
        <div className="category-chips">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              className={`filter-chip ${categoryFilter === cat.key ? 'active' : ''}`}
              onClick={() => setCategoryFilter(categoryFilter === cat.key ? null : cat.key)}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {filter === 'nearby' && userLocation && (
        <div className="radius-slider-area">
          <input
            type="range"
            min={0}
            max={RADIUS_STEPS.length - 1}
            step={1}
            value={radiusIdx}
            onChange={(e) => setRadiusIdx(Number(e.target.value))}
            className="radius-slider"
          />
          <div className="radius-labels">
            {RADIUS_STEPS.map((step, i) => (
              <span key={step} className={`radius-label ${i === radiusIdx ? 'active' : ''}`}>
                {step < 1 ? `${step * 1000}m` : `${step}km`}
              </span>
            ))}
          </div>
          <div className="radius-status">
            <span className="status-dot" />
            {radiusMessage}
          </div>
        </div>
      )}

      {trendKeywords.length > 0 && (
        <div className="keyword-dashboard">
          <div className="keyword-header">
            <span className="keyword-title">실시간 트렌드</span>
          </div>
          <div className="keyword-list">
            {trendKeywords.map((kw, idx) => (
              <button
                key={kw.word}
                className={`keyword-tag ${activeKeyword === kw.word ? 'active' : ''}`}
                onClick={() => handleKeywordClick(kw.word)}
              >
                <span className="keyword-rank">{idx + 1}</span>
                #{kw.word}
              </button>
            ))}
          </div>
          {activeKeyword && statusMessage && (
            <motion.div
              className="keyword-status"
              key={statusMessage}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <span className="status-dot" />
              {statusMessage}
            </motion.div>
          )}
        </div>
      )}

      <div className="issues-list">
        {filter === 'nearby' && locationLoading ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <p className="empty-state-title">위치를 찾고 있어요</p>
            <p className="empty-state-desc">잠시만 기다려 주세요...</p>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="empty-state">
            {filter === 'popular' ? (
              <>
                <div className="empty-state-icon-emoji">🔥</div>
                <p className="empty-state-title">지금은 인기 글이 없어요</p>
                <p className="empty-state-desc">최근 1시간 내 글이 올라오면 여기에 표시됩니다</p>
              </>
            ) : filter === 'nearby' ? (
              <>
                <div className="empty-state-icon">
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                    <line x1="9" y1="9" x2="9.01" y2="9"/>
                    <line x1="15" y1="9" x2="15.01" y2="9"/>
                  </svg>
                </div>
                <p className="empty-state-title">이 근처는 아직 조용하네요</p>
                <p className="empty-state-desc">첫 번째 소식을 올려보세요!</p>
                <button className="empty-state-btn primary" onClick={() => inputRef.current?.focus()}>지금 현장 공유하기</button>
              </>
            ) : categoryFilter ? (
              <>
                <div className="empty-state-icon-emoji">{ALL_CATEGORIES.find(t => t.key === categoryFilter)?.emoji || '📋'}</div>
                <p className="empty-state-title">{categoryFilter} 카테고리에 글이 없어요</p>
                <p className="empty-state-desc">첫 번째 글을 올려보세요!</p>
                <button className="empty-state-btn primary" onClick={() => { setSelectedCategory(categoryFilter); inputRef.current?.focus() }}>지금 작성하기</button>
              </>
            ) : (
              <>
                <div className="empty-state-icon">
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </div>
                <p className="empty-state-title">아직 이슈가 없습니다</p>
                <p className="empty-state-desc">첫 번째 이슈를 작성해보세요!</p>
              </>
            )}
          </div>
        ) : (
          <>
            {filteredIssues.map((issue) => (
              <div
                key={issue._stableKey || issue.id}
                className={`issue-card${filter === 'popular' && (issue.views || 0) >= 5 ? ' hot-card' : ''}${alertKeywords.length > 0 && alertKeywords.some(kw => (issue.title || '').includes(kw)) ? ' kw-match' : ''}${getInfluenceLevel(getInfluenceScore(issue.device_id)).label === '레전드' ? ' legend-card' : ''}`}
                ref={(el) => {
                  if (el && observerRef.current) {
                    el.dataset.issueId = issue.id
                    observerRef.current.observe(el)
                  } else if (!el) {
                    const tid = viewTimersRef.current.get(issue.id)
                    if (tid) { clearTimeout(tid); viewTimersRef.current.delete(issue.id) }
                  }
                }}
              >
                {(() => {
                  const influenceScore = getInfluenceScore(issue.device_id)
                  const level = getInfluenceLevel(influenceScore)
                  return (
                    <IssueCardContent
                      issue={issue}
                      relativeTime={formatRelativeTime(issue.created_at)}
                      nickname={generateNickname(issue.device_id)}
                      levelLabel={level.label}
                      levelColor={level.color}
                      isExpert={getUserBadges(issue.device_id).length > 0 || influenceScore >= 30}
                      isReacted={reactedIds.has(issue.id)}
                      badges={getBadges(issue)}
                      highlightedTitle={highlightKeywords(issue.title)}
                      views={formatViews(issue.views || 0)}
                      reactionCount={issue.reaction_count || 0}
                      onDelete={handleDeleteIssue}
                      onReaction={handleReaction}
                      onShare={handleShare}
                      onImageClick={setLightboxSrc}
                    />
                  )
                })()}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="bottom-bar">
        <div className="input-category-area">
          <span className="input-category-label">무슨 카테고리의 글인가요?</span>
          <div className="input-category-chips">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                className={`input-chip ${selectedCategory === cat.key ? 'active' : ''}`}
                onClick={() => setSelectedCategory(selectedCategory === cat.key ? null : cat.key)}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {imagePreview && (
          <div className="image-preview-area">
            <div className="image-preview-wrapper">
              <img src={imagePreview} alt="미리보기" className="image-preview-thumb" />
              <button type="button" className="image-preview-remove" onClick={handleRemoveImage}>×</button>
            </div>
          </div>
        )}

        <form onSubmit={handleAddIssue} className="input-bar">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} hidden />
          <button
            type="button"
            className={`image-upload-btn ${selectedImage ? 'has-image' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="사진 첨부"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
          </button>
          <input
            ref={inputRef}
            type="text"
            value={newIssue}
            onChange={(e) => setNewIssue(e.target.value)}
            placeholder="무슨 일이 일어나고 있나요?"
            disabled={loading}
            className="input-field"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={loading || (!newIssue.trim() && !selectedImage) || !selectedCategory}
            className="send-button"
            title="전송"
          >
            {loading ? '⏳' : '➤'}
          </button>
        </form>
      </div>

      {/* My Vibe 패널 */}
      <AnimatePresence>
        {controlOpen && (
          <>
            <motion.div
              className="control-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setControlOpen(false)}
            />
            <motion.div
              className="control-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            >
              <div className="control-header">
                <button className="control-back" onClick={() => setControlOpen(false)} />
                <h2 className="control-title">My Vibe</h2>
              </div>

              <div className="control-body">
                {/* 로그인 안내 */}
                <div className="control-section">
                  <div className="login-card">
                    <p className="login-card-text">로그인하고 관심 키워드 실시간 푸시 알림을 받으세요</p>
                    <div className="login-buttons">
                      <button className="login-btn kakao" onClick={() => alert('카카오 로그인은 준비 중입니다')}>
                        <span className="login-btn-icon">💬</span> 카카오로 시작
                      </button>
                      <button className="login-btn google" onClick={() => alert('Google 로그인은 준비 중입니다')}>
                        <span className="login-btn-icon">G</span> Google로 시작
                      </button>
                    </div>
                  </div>
                </div>

                {/* 내 활동 + 프로필 + 뱃지 + 영향력 */}
                <div className="control-section">
                  {/* 프로필 닉네임 */}
                  <div className="vibe-profile">
                    <p className="vibe-nickname">{generateNickname(myDeviceId)}</p>
                    <span className="vibe-level-label" style={{ color: getInfluenceLevel(getInfluenceScore(myDeviceId)).color }}>
                      {getInfluenceLevel(getInfluenceScore(myDeviceId)).label}
                    </span>
                  </div>

                  {/* 통계 */}
                  <div className="activity-stats">
                    <div className="activity-stat">
                      <span className="activity-stat-num">{myPosts.length}</span>
                      <span className="activity-stat-label">작성</span>
                    </div>
                    <div className="activity-stat">
                      <span className="activity-stat-num">{reactedIds.size}</span>
                      <span className="activity-stat-label">공감</span>
                    </div>
                    <div className="activity-stat">
                      <span className="activity-stat-num">{getInfluenceScore(myDeviceId)}</span>
                      <span className="activity-stat-label">영향력</span>
                    </div>
                  </div>

                  {/* 영향력 프로그레스 바 */}
                  {(() => {
                    const score = getInfluenceScore(myDeviceId)
                    const level = getInfluenceLevel(score)
                    const nextInfo = getNextLevelInfo(score)
                    const maxForBar = nextInfo ? nextInfo.next.min : INFLUENCE_LEVELS[INFLUENCE_LEVELS.length - 1].min
                    const prevMin = level.min
                    const progress = nextInfo
                      ? Math.min(((score - prevMin) / (maxForBar - prevMin)) * 100, 100)
                      : 100
                    return (
                      <div className="influence-wrap">
                        <div className="influence-bar-wrap">
                          <div
                            className="influence-bar-fill"
                            style={{ width: `${progress}%`, backgroundColor: level.color }}
                          />
                        </div>
                        <p className="influence-next">
                          {nextInfo
                            ? `다음 레벨(${nextInfo.next.label})까지 ${nextInfo.remaining}점`
                            : '최고 레벨 달성!'
                          }
                        </p>
                      </div>
                    )
                  })()}

                  {/* 획득 뱃지 */}
                  <div className="vibe-badges-section">
                    <h4 className="vibe-badges-title">획득 뱃지</h4>
                    {getUserBadges(myDeviceId).length > 0 ? (
                      <div className="vibe-badges">
                        {getUserBadges(myDeviceId).map((badge, i) => (
                          <span key={i} className="vibe-badge-chip">
                            {badge.emoji} {badge.label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="vibe-badge-empty">더 활동하면 뱃지를 획득할 수 있어요</p>
                    )}
                  </div>

                  {/* 최근 글 목록 */}
                  <h4 className="vibe-badges-title" style={{ marginTop: '1rem' }}>최근 글</h4>
                  {myPosts.length > 0 ? (
                    <div className="activity-list">
                      {myPosts.slice(0, 5).map(post => (
                        <div key={post.id} className="activity-item">
                          <span className="activity-item-text">{post.title}</span>
                          <span className="activity-item-time">{formatRelativeTime(post.created_at)}</span>
                        </div>
                      ))}
                      {myPosts.length > 5 && (
                        <p className="activity-more">+{myPosts.length - 5}개 더</p>
                      )}
                    </div>
                  ) : (
                    <p className="activity-empty">아직 작성한 글이 없어요</p>
                  )}
                </div>

                {/* 관심 키워드 관리 */}
                <div className="control-section">
                  <h3 className="control-section-title">관심 키워드</h3>
                  <p className="control-section-desc">My Vibe에서 등록한 키워드가 포함된 글이 인기 탭 상단에 올라가요</p>
                  <form className="alert-keyword-form" onSubmit={handleAddAlertKeyword}>
                    <input
                      type="text"
                      value={newAlertKeyword}
                      onChange={(e) => setNewAlertKeyword(e.target.value)}
                      placeholder="키워드 입력 (쉼표로 여러 개)"
                      className="alert-keyword-input"
                      maxLength={60}
                    />
                    <button type="submit" className="alert-keyword-add" disabled={!newAlertKeyword.trim()}>추가</button>
                  </form>
                  {alertKeywords.length > 0 && (
                    <div className="alert-keyword-tags">
                      {alertKeywords.map((kw, i) => (
                        <span key={i} className="alert-keyword-tag">
                          #{kw}
                          <button className="alert-keyword-remove" onClick={() => handleRemoveAlertKeyword(i)}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 설정 */}
                <div className="control-section">
                  <h3 className="control-section-title">설정</h3>

                  <div className="setting-row">
                    <div className="setting-info">
                      <span className="setting-label">📍 위치 정보</span>
                      <span className="setting-desc">{userLocation ? '허용됨' : '확인 중'}</span>
                    </div>
                    <button className="setting-action" onClick={() => { requestLocation() }}>
                      {userLocation ? '재요청' : '허용하기'}
                    </button>
                  </div>

                  <div className="setting-row">
                    <div className="setting-info">
                      <span className="setting-label">📡 기본 탐지 반경</span>
                      <span className="setting-desc">
                        {RADIUS_STEPS[defaultRadiusIdx] < 1
                          ? `${RADIUS_STEPS[defaultRadiusIdx] * 1000}m`
                          : `${RADIUS_STEPS[defaultRadiusIdx]}km`}
                      </span>
                    </div>
                  </div>
                  <div className="setting-slider-wrap">
                    <input
                      type="range"
                      min={0}
                      max={RADIUS_STEPS.length - 1}
                      step={1}
                      value={defaultRadiusIdx}
                      onChange={(e) => handleDefaultRadiusChange(Number(e.target.value))}
                      className="setting-slider"
                    />
                    <div className="setting-slider-labels">
                      {RADIUS_STEPS.map((step, i) => (
                        <span key={step} className={`setting-slider-label ${i === defaultRadiusIdx ? 'active' : ''}`}>
                          {step < 1 ? `${step * 1000}m` : `${step}km`}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="setting-row">
                    <div className="setting-info">
                      <span className="setting-label">🌙 다크 모드</span>
                      <span className="setting-desc">항상 켜짐</span>
                    </div>
                    <button className={`toggle-switch on`} disabled>
                      <span className="toggle-thumb" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 이미지 라이트박스 */}
      <AnimatePresence>
        {lightboxSrc && (
          <motion.div
            className="lightbox-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setLightboxSrc(null)}
          >
            <motion.img
              src={lightboxSrc}
              className="lightbox-image"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            />
            <button className="lightbox-close" onClick={() => setLightboxSrc(null)}>×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 토스트 메시지 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {confetti.map(burst => (
        <div key={burst.id} className="confetti-container" style={{ left: burst.x, top: burst.y }}>
          {burst.particles.map(p => (
            <span
              key={p.id}
              className="confetti-particle"
              style={{
                '--tx': `${p.x}px`, '--ty': `${p.y}px`,
                '--r': `${p.rotation}deg`, '--s': p.scale, '--d': `${p.delay}s`,
                backgroundColor: p.color, width: p.size, height: p.size
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export default App
