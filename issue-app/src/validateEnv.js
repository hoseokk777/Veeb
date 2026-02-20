// 환경 변수 검증 스크립트
// 이 파일을 임포트하면 자동으로 환경 변수를 검증합니다

const validateEnv = () => {
  console.log('\n==============================================')
  console.log('🔍 환경 변수 검증 시작')
  console.log('==============================================\n')

  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  let hasError = false

  // 1. URL 검증
  console.log('1️⃣ VITE_SUPABASE_URL 검증')
  if (!url) {
    console.error('   ❌ 환경 변수가 설정되지 않았습니다!')
    console.error('   💡 .env 파일에 VITE_SUPABASE_URL을 추가하세요')
    hasError = true
  } else if (!url.startsWith('https://')) {
    console.error('   ❌ URL이 https://로 시작하지 않습니다!')
    console.error('   현재 값:', url)
    console.error('   💡 https://your-project-id.supabase.co 형식이어야 합니다')
    hasError = true
  } else if (url.includes('your-project') || url === 'your_supabase_project_url') {
    console.error('   ❌ 예시 URL이 그대로 사용되고 있습니다!')
    console.error('   💡 Supabase Dashboard에서 실제 프로젝트 URL을 복사하세요')
    hasError = true
  } else if (!url.includes('.supabase.co')) {
    console.error('   ❌ URL 형식이 올바르지 않습니다!')
    console.error('   현재 값:', url)
    console.error('   💡 .supabase.co로 끝나야 합니다')
    hasError = true
  } else {
    console.log('   ✅ URL 형식 정상:', url)
  }

  // 2. Anon Key 검증
  console.log('\n2️⃣ VITE_SUPABASE_ANON_KEY 검증')
  if (!key) {
    console.error('   ❌ 환경 변수가 설정되지 않았습니다!')
    console.error('   💡 .env 파일에 VITE_SUPABASE_ANON_KEY를 추가하세요')
    hasError = true
  } else if (key === 'your_supabase_anon_key') {
    console.error('   ❌ 예시 키가 그대로 사용되고 있습니다!')
    console.error('   💡 Supabase Dashboard에서 실제 anon key를 복사하세요')
    hasError = true
  } else if (!key.startsWith('eyJ')) {
    console.error('   ❌ Anon key가 eyJ로 시작하지 않습니다!')
    console.error('   현재 값:', key.substring(0, 50) + '...')
    console.error('   💡 올바른 JWT 토큰 형식이어야 합니다')
    console.error('   💡 혹시 service_role 키를 사용하신 건 아닌가요?')
    console.error('   💡 Supabase Dashboard > Settings > API에서 "anon" 또는 "public" 키를 사용하세요')
    hasError = true
  } else if (key.length < 100) {
    console.error('   ❌ Anon key가 너무 짧습니다!')
    console.error('   현재 길이:', key.length)
    console.error('   💡 일반적으로 JWT 토큰은 200자 이상입니다')
    hasError = true
  } else {
    console.log('   ✅ Anon key 형식 정상')
    console.log('   키 시작 부분:', key.substring(0, 30) + '...')
    console.log('   키 길이:', key.length, '자')
  }

  // 3. 최종 결과
  console.log('\n==============================================')
  if (hasError) {
    console.error('❌ 환경 변수 검증 실패!')
    console.error('\n💡 해결 방법:')
    console.error('1. https://app.supabase.com/ 접속')
    console.error('2. 본인의 프로젝트 선택')
    console.error('3. Settings > API 메뉴로 이동')
    console.error('4. "Project URL"과 "anon public" 키를 복사')
    console.error('5. issue-app/.env 파일에 붙여넣기')
    console.error('6. 개발 서버 재시작 (npm run dev)')
    console.error('\n')
  } else {
    console.log('✅ 환경 변수 검증 성공!')
    console.log('모든 설정이 올바릅니다.')
    console.log('\n')
  }
  console.log('==============================================\n')

  return !hasError
}

// 자동 실행
validateEnv()

export default validateEnv
