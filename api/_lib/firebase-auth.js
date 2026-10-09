const { ApiError } = require('./http');
const projectId = () => process.env.FIREBASE_AUTH_PROJECT_ID || 'donascontrol-1f5df';
function looksLikeFirebase(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
    return payload.iss === `https://securetoken.google.com/${projectId()}`;
  } catch (_) { return false; }
}
async function verifyFirebaseToken(token) {
  if (typeof token !== 'string' || token.length > 16000) throw new ApiError(401, 'INVALID_SESSION', 'La sesión Firebase no es válida.');
  const { getApps, initializeApp } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const name = 'donas-staff-identity';
  const app = getApps().find(item => item.name === name) || initializeApp({projectId: projectId()}, name);
  try {
    // Signature, expiry, issuer and audience are verified by the official Admin SDK.
    // No service-account key is needed for verification against Google's public keys.
    return await getAuth(app).verifyIdToken(token);
  } catch (error) {
    if (['auth/internal-error','auth/network-request-failed'].includes(error.code)) {
      throw new ApiError(503, 'AUTH_UNAVAILABLE', 'No se pudo comprobar la sesión. Intenta de nuevo.');
    }
    throw new ApiError(401, 'INVALID_SESSION', 'La sesión Firebase no es válida o expiró.');
  }
}
module.exports = { looksLikeFirebase, verifyFirebaseToken };
