-- issues 테이블 생성 (위치 정보 및 기기 식별값 포함)
create table if not exists public.issues (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  status text not null default 'open',
  latitude decimal(10, 8),  -- 위도 (예: 37.12345678)
  longitude decimal(11, 8),  -- 경도 (예: 127.12345678)
  device_id text,  -- 기기 식별값 (어뷰징 방지용)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS) 활성화
alter table public.issues enable row level security;

-- 모든 사용자가 읽을 수 있도록 허용
create policy "누구나 이슈를 볼 수 있습니다"
  on public.issues for select
  using (true);

-- 모든 사용자가 이슈를 추가할 수 있도록 허용
create policy "누구나 이슈를 추가할 수 있습니다"
  on public.issues for insert
  with check (true);

-- 모든 사용자가 이슈를 수정할 수 있도록 허용
create policy "누구나 이슈를 수정할 수 있습니다"
  on public.issues for update
  using (true);

-- 모든 사용자가 이슈를 삭제할 수 있도록 허용
create policy "누구나 이슈를 삭제할 수 있습니다"
  on public.issues for delete
  using (true);

-- updated_at 자동 업데이트 트리거 함수
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- updated_at 트리거 생성
create trigger set_updated_at
  before update on public.issues
  for each row
  execute procedure public.handle_updated_at();

-- 위치 기반 검색을 위한 인덱스 생성 (성능 향상)
create index if not exists issues_location_idx on public.issues (latitude, longitude);
create index if not exists issues_created_at_idx on public.issues (created_at desc);

-- ============================================================
-- 3단계: 사진 기능 + 공감 리액션 (아래 SQL을 Supabase SQL Editor에서 실행)
-- ============================================================

-- 이미지 URL 컬럼 추가
alter table public.issues add column if not exists image_url text;

-- 리액션(공감) 카운트 컬럼 추가
alter table public.issues add column if not exists reaction_count integer default 0;

-- Supabase Storage 버킷 생성 (이미지 저장용)
insert into storage.buckets (id, name, public)
values ('issue-images', 'issue-images', true)
on conflict (id) do nothing;

-- 누구나 이미지를 업로드할 수 있도록 허용
create policy "누구나 이미지를 업로드할 수 있습니다"
  on storage.objects for insert
  with check (bucket_id = 'issue-images');

-- 누구나 이미지를 볼 수 있도록 허용
create policy "누구나 이미지를 볼 수 있습니다"
  on storage.objects for select
  using (bucket_id = 'issue-images');

-- ============================================================
-- 4단계: 카테고리 시스템 + 조회수 (아래 SQL을 Supabase SQL Editor에서 실행)
-- ============================================================

-- 카테고리 컬럼 추가 (기본값: '일상')
alter table public.issues add column if not exists category text default '일상';

-- 조회수 컬럼 추가 (기본값: 0)
alter table public.issues add column if not exists views integer default 0;

-- 카테고리별 검색 성능을 위한 인덱스
create index if not exists issues_category_idx on public.issues (category);

-- 인기 탭 조회 성능을 위한 복합 인덱스
create index if not exists issues_popular_idx on public.issues (created_at desc, views desc);
