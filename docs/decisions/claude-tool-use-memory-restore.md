# 기술 결정 — Claude API Tool Use로 기억 복원 구조화

## Problem (상황/문제)

> 사용자가 "90년대 SF 영화 좋아했어요"처럼 자유롭게 말했을 때
> Claude가 텍스트로 응답하면 작품 제목을 JSON으로 파싱해야 한다.
> 파싱 실패 시 전체 기능이 무너지는 취약한 구조였다.

## Action (결정 및 근거)

> Claude API의 `tool_choice: { type: "any" }`로 도구 호출을 강제했다.

```js
const SUGGEST_TOOL = {
  name: 'suggest_works',
  input_schema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      works:   { type: 'array', items: { ... } }
    },
    required: ['message', 'works']
  }
};

await claude.messages.create({
  tools: [SUGGEST_TOOL],
  tool_choice: { type: 'any' },  // 반드시 도구 호출
  ...
});
```

Claude가 도구를 호출하면:
1. `content` 블록에서 `type: 'tool_use'` 추출
2. `input.works` 배열을 그대로 사용 (JSON 파싱 불필요)
3. 각 작품을 TMDB 검색으로 보강 (tmdb_id, poster_path)

포기한 대안:
- 텍스트 응답 파싱 → 정규식/JSON.parse 실패 위험
- 별도 TMDB 검색 도구 제공 → Claude가 실제로 검색하지 않는 경우 발생

## Result (결과)

> 구조화된 작품 배열이 항상 보장된다.
> 텍스트 파싱 오류 없이 TMDB 보강 단계로 바로 진행 가능.
> original_title 필드를 도구 스키마에 포함해 TMDB 매칭 정확도도 향상됐다.
