/**
 * @file tokenCheck.js
 * AI 기능 호출 전 토큰 잔액 확인 및 성공 후 차감 미들웨어 (Phase 9.2)
 */

const pool = require('../db');

/**
 * AI 기능 사용 전 토큰 잔액 확인 미들웨어 팩토리
 * 잔액 부족 시 402 반환. 통과 시 req.tokenInfo에 정보 저장.
 * @param {number} requiredTokens 필요한 토큰 수
 * @param {string} feature 기능 식별자 ('chat' | 'screenshot' | 'search' | 'report')
 */
function requireTokens(requiredTokens, feature) {
  return async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT token_balance FROM users WHERE id = $1',
        [req.user.id]
      );
      const balance = rows[0]?.token_balance ?? 0;

      if (balance < requiredTokens) {
        return res.status(402).json({
          success: false,
          error: 'INSUFFICIENT_TOKENS',
          message: '토큰이 부족합니다',
          required: requiredTokens,
          balance,
          shortBy: requiredTokens - balance,
        });
      }

      // AI 호출 성공 후 deductTokens에서 실제 차감
      req.tokenInfo = { required: requiredTokens, feature, balance };
      next();
    } catch (err) {
      console.error('tokenCheck 오류:', err.message);
      res.status(500).json({ success: false, message: '토큰 확인 중 오류가 발생했습니다.' });
    }
  };
}

/**
 * AI 호출 성공 후 토큰 차감 + 사용 로그 기록
 * 실패 시 throw — 호출 측에서 .catch()로 처리 권장 (사용자 응답 차단 방지)
 * @param {number} userId
 * @param {{ required: number, feature: string }} tokenInfo
 * @param {{ input_tokens?: number, output_tokens?: number, cost_usd?: number, metadata?: object }} claudeUsage
 */
async function deductTokens(userId, tokenInfo, claudeUsage = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE users SET token_balance = token_balance - $1 WHERE id = $2',
      [tokenInfo.required, userId]
    );

    await client.query(
      `INSERT INTO token_usage_log
         (user_id, feature, tokens_used, claude_input_tokens, claude_output_tokens, claude_cost_usd, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        tokenInfo.feature,
        tokenInfo.required,
        claudeUsage.input_tokens ?? null,
        claudeUsage.output_tokens ?? null,
        claudeUsage.cost_usd ?? null,
        claudeUsage.metadata ? JSON.stringify(claudeUsage.metadata) : '{}',
      ]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { requireTokens, deductTokens };
