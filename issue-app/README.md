# My Issue Board

실시간으로 이슈를 관리할 수 있는 보드 애플리케이션입니다.

## 기술 스택

- **Frontend**: React + Vite
- **Backend**: Supabase (PostgreSQL + Realtime)
- **스타일**: CSS

## 기능

- ✅ 이슈 추가
- ✅ 이슈 목록 조회
- ✅ 이슈 상태 변경 (열림/닫힘)
- ✅ 이슈 삭제
- ✅ 실시간 동기화 (여러 창에서 동시에 작업 가능)

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 설정

1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 `database.sql` 파일의 내용을 실행하여 테이블 생성
3. `.env` 파일에 Supabase URL과 anon key 설정 확인

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:5173 으로 접속

## 데이터베이스 스키마

### issues 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | 기본 키 |
| title | text | 이슈 제목 |
| status | text | 이슈 상태 (open/closed) |
| created_at | timestamp | 생성 시간 |
| updated_at | timestamp | 수정 시간 |

## 실시간 기능

Supabase의 Realtime 기능을 사용하여 다음 이벤트를 실시간으로 감지합니다:

- INSERT: 새 이슈 추가
- UPDATE: 이슈 상태 변경
- DELETE: 이슈 삭제

여러 브라우저 창을 열어도 모든 창에서 동시에 업데이트가 반영됩니다.
