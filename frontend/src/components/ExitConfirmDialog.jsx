/**
 * @file ExitConfirmDialog.jsx
 * 앱 종료 확인 다이얼로그 (Android 하드웨어 뒤로가기, Phase 11)
 * 네이티브 confirm()은 버튼 문구가 CANCEL/OK 영문으로 고정돼 있어 대체한다.
 * 백드롭 클릭으로 닫히는 구조는 프로젝트의 다른 오버레이와 동일하게 맞췄다
 * (useAndroidBackButton이 최상단 백드롭을 click()해서 닫기 때문에 필수)
 */

/**
 * @param {object} props
 * @param {() => void} props.onCancel - 취소 (다이얼로그만 닫음)
 * @param {() => void} props.onExit   - 종료 확정
 */
export default function ExitConfirmDialog({ onCancel, onExit }) {
  return (
    <div
      className="exit-overlay"
      onClick={e => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-dialog-title"
    >
      <div className="exit-box">
        <p className="exit-title" id="exit-dialog-title">앱을 종료할까요?</p>
        <p className="exit-msg">기록한 내용은 저장되어 있어요.</p>
        <div className="exit-actions">
          <button className="btn" onClick={onCancel} autoFocus>취소</button>
          <button className="btn btn-primary" onClick={onExit}>종료</button>
        </div>
      </div>
    </div>
  );
}
