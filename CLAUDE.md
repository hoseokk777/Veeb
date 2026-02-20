# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 언어 및 커뮤니케이션 규칙

- **기본 응답 언어**: 한국어로 작성
- **코드 주석**: 한국어로 작성
- **커밋 메시지**: 한국어로 작성
- **문서화**: 한국어로 작성
- **변수명/함수명**: 영어 (코드 표준 준수)

## 프로젝트 개요

My Issue Board - 이슈/작업 관리 보드 애플리케이션

**기술 스택:**
- Frontend: React + Vite
- Backend: Supabase (PostgreSQL + Realtime)
- 스타일링: CSS

## 개발 환경 설정

### 프로젝트 위치
실제 애플리케이션 코드는 `issue-app/` 디렉토리에 있습니다.

### 필수 명령어

```bash
# 프로젝트 디렉토리로 이동
cd issue-app

# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:5173)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

### 환경 변수 설정

`issue-app/.env` 파일에 Supabase 연결 정보가 필요합니다:
- `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anon/public key

### 데이터베이스 초기화

Supabase SQL Editor에서 `issue-app/database.sql` 파일 실행하여 테이블 및 정책 생성

## 아키텍처

### 프로젝트 구조

```
issue-app/
├── src/
│   ├── App.jsx              # 메인 애플리케이션 컴포넌트 (이슈 보드 UI)
│   ├── App.css              # 애플리케이션 스타일
│   ├── supabaseClient.js    # Supabase 클라이언트 초기화
│   └── main.jsx             # 엔트리 포인트
├── database.sql             # 데이터베이스 스키마 및 정책
└── .env                     # 환경 변수 (gitignore에 포함)
```

### 주요 기능 흐름

1. **이슈 추가**: 폼 제출 → Supabase INSERT → 실시간 구독으로 자동 업데이트
2. **이슈 조회**: 컴포넌트 마운트 시 Supabase SELECT → 상태 초기화
3. **이슈 수정/삭제**: 버튼 클릭 → Supabase UPDATE/DELETE → 실시간 구독으로 자동 업데이트

### Supabase 실시간 구독

`App.jsx`의 `useEffect`에서 Supabase Realtime을 구독하여 다른 클라이언트의 변경사항을 실시간으로 반영합니다.
- INSERT 이벤트: 새 이슈를 목록 상단에 추가
- UPDATE 이벤트: 해당 이슈 업데이트
- DELETE 이벤트: 해당 이슈 제거

### 데이터베이스 스키마

**issues 테이블:**
- `id` (uuid, PK): 이슈 고유 ID
- `title` (text): 이슈 제목
- `status` (text): 이슈 상태 ('open' 또는 'closed')
- `created_at` (timestamp): 생성 시간
- `updated_at` (timestamp): 수정 시간 (자동 업데이트)
