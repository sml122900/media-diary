-- 큐레이션 TMDB ID 오류 수정 스크립트
-- 실행: psql $DATABASE_URL < backend/scripts/fix-curation-ids.sql
-- 생성: 2026-05-14 전수 검증 결과 기반

-- awards.json: 아카데미 작품상 리스트
UPDATE curation_items SET tmdb_id = 581734
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'academy-best-picture')
    AND tmdb_id = 748783; -- 노매드랜드 (wrong: 748783 → correct: 581734)

UPDATE curation_items SET tmdb_id = 1064213
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'academy-best-picture')
    AND tmdb_id = 1084736; -- 아노라 (wrong: 1084736 → correct: 1064213)

-- awards.json: 칸 황금종려상 리스트
UPDATE curation_items SET tmdb_id = 1064213
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'cannes-palme-dor')
    AND tmdb_id = 1084736; -- 아노라

-- awards-extended.json: 베니스 황금사자상 리스트
UPDATE curation_items SET tmdb_id = 581734
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'venice-golden-lion')
    AND tmdb_id = 748783; -- 노매드랜드

-- foreign-directors.json: 크리스토퍼 놀란
UPDATE curation_items SET tmdb_id = 11660
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'christopher-nolan')
    AND tmdb_id = 11677; -- 팔로잉

UPDATE curation_items SET tmdb_id = 320
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'christopher-nolan')
    AND tmdb_id = 6972; -- 인썸니아

UPDATE curation_items SET tmdb_id = 1124
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'christopher-nolan')
    AND tmdb_id = 1267; -- 프레스티지

-- foreign-directors-extended.json: 스티븐 스필버그
UPDATE curation_items SET tmdb_id = 640
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'steven-spielberg')
    AND tmdb_id = 5765; -- 캐치 미 이프 유 캔

UPDATE curation_items SET tmdb_id = 612
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'steven-spielberg')
    AND tmdb_id = 9522; -- 뮌헨

UPDATE curation_items SET tmdb_id = 72976
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'steven-spielberg')
    AND tmdb_id = 96721; -- 링컨

-- foreign-directors-extended.json: 마틴 스코세이지
UPDATE curation_items SET tmdb_id = 1578
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'martin-scorsese')
    AND tmdb_id = 1373; -- 성난 황소

UPDATE curation_items SET tmdb_id = 44826
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'martin-scorsese')
    AND tmdb_id = 83666; -- 휴고

-- foreign-directors-extended.json: 쿠엔틴 타란티노
UPDATE curation_items SET tmdb_id = 184
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'quentin-tarantino')
    AND tmdb_id = 2397; -- 재키 브라운

-- foreign-directors-extended.json: 코엔 형제
UPDATE curation_items SET tmdb_id = 134
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'coen-brothers')
    AND tmdb_id = 16154; -- 오 형제여 어디 있는가?

UPDATE curation_items SET tmdb_id = 4944
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'coen-brothers')
    AND tmdb_id = 12618; -- 번 애프터 리딩

UPDATE curation_items SET tmdb_id = 44264
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'coen-brothers')
    AND tmdb_id = 45243; -- 트루 그릿

UPDATE curation_items SET tmdb_id = 86829
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'coen-brothers')
    AND tmdb_id = 142012; -- 인사이드 르윈 데이비스

-- foreign-directors-extended.json: 데이비드 핀처
UPDATE curation_items SET tmdb_id = 1949
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'david-fincher')
    AND tmdb_id = 10918; -- 조디악

UPDATE curation_items SET tmdb_id = 614560
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'david-fincher')
    AND tmdb_id = 694919; -- 맨크

-- foreign-directors-extended.json: 리들리 스콧
UPDATE curation_items SET tmdb_id = 1495
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'ridley-scott')
    AND tmdb_id = 1542; -- 킹덤 오브 헤븐

UPDATE curation_items SET tmdb_id = 617653
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'ridley-scott')
    AND tmdb_id = 522437; -- 라스트 듀얼

-- foreign-directors-extended.json: 데이미언 셔젤
UPDATE curation_items SET tmdb_id = 369972
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'damien-chazelle')
    AND tmdb_id = 399379; -- 퍼스트 맨

-- foreign-directors-extended.json: 웨스 앤더슨
UPDATE curation_items SET tmdb_id = 9428
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'wes-anderson')
    AND tmdb_id = 9587; -- 로열 테넌바움

UPDATE curation_items SET tmdb_id = 421
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'wes-anderson')
    AND tmdb_id = 14; -- 스티브 지소와의 해저생활

UPDATE curation_items SET tmdb_id = 4538
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'wes-anderson')
    AND tmdb_id = 11328; -- 다즐링 주식회사

UPDATE curation_items SET tmdb_id = 10315
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'wes-anderson')
    AND tmdb_id = 10090; -- 판타스틱 Mr. 폭스

UPDATE curation_items SET tmdb_id = 81413
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'wes-anderson')
    AND tmdb_id = 72279; -- 문라이즈 킹덤

-- foreign-directors-extended.json: 제임스 카메론
UPDATE curation_items SET tmdb_id = 36955
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'james-cameron')
    AND tmdb_id = 9260; -- 트루 라이즈

-- korean-directors.json: 봉준호
UPDATE curation_items SET tmdb_id = 11423
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'bong-joon-ho')
    AND tmdb_id = 19552; -- 살인의 추억

UPDATE curation_items SET tmdb_id = 387426
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'bong-joon-ho')
    AND tmdb_id = 429351; -- 옥자

-- korean-directors.json: 박찬욱
UPDATE curation_items SET tmdb_id = 4550
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'park-chan-wook')
    AND tmdb_id = 3072; -- 친절한 금자씨

UPDATE curation_items SET tmdb_id = 290098
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'park-chan-wook')
    AND tmdb_id = 357390; -- 아가씨

-- franchises.json: MCU (순환 swap — 순서 중요)
-- 284052: Doctor Strange, 284053: Thor Ragnarok, 284054: Black Panther
-- 현재 DB: DS=284053, Thor=284054, BP=284052 (각각 1씩 밀려있음)
UPDATE curation_items SET tmdb_id = 999999
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'marvel-mcu')
    AND tmdb_id = 284052; -- 블랙 팬서 임시값으로 이동

UPDATE curation_items SET tmdb_id = 284052
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'marvel-mcu')
    AND tmdb_id = 284053; -- 닥터 스트레인지 수정

UPDATE curation_items SET tmdb_id = 284053
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'marvel-mcu')
    AND tmdb_id = 284054; -- 토르 라그나로크 수정

UPDATE curation_items SET tmdb_id = 284054
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'marvel-mcu')
    AND tmdb_id = 999999; -- 블랙 팬서 임시값에서 정상값으로

-- franchises-series.json: 인디아나 존스
UPDATE curation_items SET tmdb_id = 335977
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'indiana-jones')
    AND tmdb_id = 285; -- 운명의 다이얼

-- franchises-series.json: 엽문
UPDATE curation_items SET tmdb_id = 14756
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'ip-man-series')
    AND tmdb_id = 24494; -- 엽문

-- decade-classics.json
UPDATE curation_items SET tmdb_id = 1578
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = '80s-classics')
    AND tmdb_id = 1373; -- 성난 황소

UPDATE curation_items SET tmdb_id = 11423
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = '2000s-classics')
    AND tmdb_id = 19552; -- 살인의 추억

UPDATE curation_items SET tmdb_id = 6977
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = '2000s-classics')
    AND tmdb_id = 9529; -- 노인을 위한 나라는 없다

-- world-cinema.json: 프랑스 영화
UPDATE curation_items SET tmdb_id = 129575
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'french-cinema')
    AND tmdb_id = 152584; -- 가장 따뜻한 색, 블루

UPDATE curation_items SET tmdb_id = 293110
  WHERE list_id = (SELECT id FROM curation_lists WHERE slug = 'french-cinema')
    AND tmdb_id = 314402; -- 디판

-- DB에서 530915로 잘못 업데이트된 기생충 ID 복구 (6개 리스트)
-- Stage 8.3 배치 업데이트 버그로 496243 → 530915로 오염된 경우
UPDATE curation_items SET tmdb_id = 496243
  WHERE tmdb_id = 530915
    AND title = '기생충'; -- 1917(530915)로 잘못 들어간 기생충 전체 복구
