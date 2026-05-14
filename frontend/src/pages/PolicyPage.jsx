/**
 * @file PolicyPage.jsx
 * 이용약관 / 환불 정책 / 개인정보처리방침 통합 페이지 (Phase 9.5)
 * 경로: /policy/terms | /policy/refund | /policy/privacy
 */

import { useParams, useNavigate } from 'react-router-dom';

const POLICIES = {
  terms: {
    title: '이용약관',
    sections: [
      {
        heading: '제1조 (목적)',
        body: '이 약관은 미디어 다이어리(이하 "서비스")의 이용 조건 및 절차, 서비스 제공자와 이용자의 권리·의무 및 책임사항을 규정하는 것을 목적으로 합니다.',
      },
      {
        heading: '제2조 (서비스 이용)',
        body: '서비스는 회원가입 후 이용 가능하며, 영화·드라마·애니메이션 감상 기록 관리 및 AI 기반 부가 기능을 제공합니다. AI 기능은 토큰을 소모하며, 토큰은 유상으로 충전할 수 있습니다.',
      },
      {
        heading: '제3조 (토큰 및 결제)',
        body: '신규 가입 시 50토큰이 무료 지급됩니다. 추가 토큰은 유료로 충전할 수 있으며, 충전된 토큰은 AI 기능(채팅·스크린샷 인식·자연어 검색·리포트 생성) 이용 시 차감됩니다. 토큰은 환불 정책에 따라 부분 환불이 가능합니다.',
      },
      {
        heading: '제4조 (금지 행위)',
        body: '이용자는 서비스를 통해 타인의 권리를 침해하거나, 불법적인 목적으로 서비스를 이용하거나, 서비스의 정상적인 운영을 방해하는 행위를 해서는 안 됩니다.',
      },
      {
        heading: '제5조 (서비스 변경 및 중단)',
        body: '운영자는 서비스의 품질 향상을 위해 서비스 내용을 변경하거나 일시 중단할 수 있습니다. 유료 서비스 중단 시 잔여 토큰에 대해서는 환불 정책에 따라 처리합니다.',
      },
      {
        heading: '제6조 (면책사항)',
        body: '운영자는 천재지변, 불가항력적 사유, 이용자의 귀책으로 인한 서비스 장애에 대해 책임지지 않습니다. AI 기능의 결과물은 참고용이며, 그 정확성을 보장하지 않습니다.',
      },
      {
        heading: '제7조 (준거법)',
        body: '이 약관은 대한민국 법률에 따라 규율되며, 서비스 이용과 관련한 분쟁은 운영자의 주소지를 관할하는 법원을 제1심 법원으로 합니다.',
      },
    ],
  },

  refund: {
    title: '환불 정책',
    sections: [
      {
        heading: '환불 가능 조건',
        body: '결제 후 7일 이내, 미사용 토큰이 남아 있는 경우 환불을 신청할 수 있습니다. 단, 이미 사용된 토큰은 환불 대상에서 제외됩니다.',
      },
      {
        heading: '환불 금액 계산',
        body: '환불 금액 = 결제 금액 × (미사용 토큰 / 총 충전 토큰)\n예시: 3,000원에 350토큰 충전 후 100토큰 사용 시 → 3,000원 × (250/350) ≈ 2,142원 환불',
      },
      {
        heading: '환불 신청 방법',
        body: '이메일(sml122900@gmail.com)로 아래 정보를 포함해 문의해주세요.\n• 가입 이메일 주소\n• 결제일\n• 환불 사유',
      },
      {
        heading: '환불 처리 기간',
        body: '환불 신청 접수 후 영업일 기준 3~5일 이내에 원결제 수단으로 환불됩니다. 카드사 정책에 따라 실제 취소 반영까지 추가 시간이 소요될 수 있습니다.',
      },
      {
        heading: '환불 불가 항목',
        body: '다음의 경우 환불이 제한될 수 있습니다.\n• 결제 후 7일 초과\n• 토큰을 전부 사용한 경우\n• 이용 약관 위반으로 서비스가 제한된 경우',
      },
    ],
  },

  privacy: {
    title: '개인정보처리방침',
    sections: [
      {
        heading: '수집하는 개인정보',
        body: '서비스 이용 과정에서 다음 정보가 수집됩니다.\n• 필수: 이메일 주소, 비밀번호(암호화 저장)\n• 서비스 이용 중 생성: 감상 기록, 별점·리뷰, AI 대화 내역\n• 결제 시: 주문 ID (결제 수단 정보는 토스페이먼츠에서 직접 처리, 서버에 저장되지 않음)',
      },
      {
        heading: '개인정보 이용 목적',
        body: '수집된 정보는 아래 목적으로만 이용됩니다.\n• 회원 인증 및 서비스 제공\n• AI 기능 개인화 (감상 기록 기반 추천)\n• 결제 및 토큰 관리\n• 서비스 개선을 위한 통계 분석 (개인 식별 불가 형태)',
      },
      {
        heading: '개인정보 보관 기간',
        body: '• 회원 탈퇴 시: 즉시 삭제 (CASCADE 삭제)\n• 결제 이력: 세법에 따라 5년간 보관 후 삭제\n• AI 대화 내역: 이용자 요청 또는 탈퇴 시 삭제',
      },
      {
        heading: '개인정보 제3자 제공',
        body: '이용자의 개인정보는 아래 경우 외에 제3자에게 제공되지 않습니다.\n• 토스페이먼츠: 결제 처리를 위한 주문 정보 (법적 근거: 계약 이행)\n• 법령에 의한 요구가 있을 경우',
      },
      {
        heading: '이용자의 권리',
        body: '이용자는 언제든지 자신의 개인정보를 조회·수정하거나, 서비스 내 회원 탈퇴를 통해 삭제를 요청할 수 있습니다. 문의: sml122900@gmail.com',
      },
      {
        heading: '개인정보처리방침 변경',
        body: '이 방침은 법령 변경 또는 서비스 정책 변경 시 업데이트될 수 있으며, 변경 사항은 서비스 내 공지를 통해 안내됩니다.',
      },
    ],
  },
};

export default function PolicyPage() {
  const { type } = useParams();
  const navigate = useNavigate();
  const policy = POLICIES[type];

  if (!policy) {
    return (
      <div className="policy-page">
        <p>존재하지 않는 정책 페이지입니다.</p>
        <button className="btn" onClick={() => navigate('/')}>홈으로</button>
      </div>
    );
  }

  return (
    <div className="policy-page">
      <div className="policy-header">
        <button className="btn" onClick={() => navigate(-1)}>← 뒤로</button>
        <h2>{policy.title}</h2>
      </div>

      <div className="policy-body">
        {policy.sections.map((s, i) => (
          <div key={i} className="policy-section">
            <h3>{s.heading}</h3>
            <p style={{ whiteSpace: 'pre-line' }}>{s.body}</p>
          </div>
        ))}

        <p className="policy-updated">최종 수정일: 2026년 5월 14일</p>
      </div>
    </div>
  );
}
