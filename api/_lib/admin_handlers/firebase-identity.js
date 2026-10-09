const { createHash } = require('node:crypto');
const { requireStaff } = require('../auth');
const { verifyFirebaseToken } = require('../firebase-auth');
const { ApiError, withApi } = require('../http');
const { enforceRateLimit } = require('../rate-limit');
const { rpc } = require('../supabase');
const { uuid } = require('../validation');
module.exports = withApi(['GET','POST'], async (req, {parseJsonBody}) => {
  const staff = await requireStaff(req);
  await enforceRateLimit(req, 'firebase_identity', 30, 60, staff.id);
  if (req.method === 'GET') return {role:staff.role,deviceId:staff.deviceId || null};
  const body = parseJsonBody(req);
  const deviceId = uuid(body.deviceId, 'deviceId');
  if (staff.deviceId && staff.deviceId !== deviceId) throw new ApiError(403,'DEVICE_OWNERSHIP_REQUIRED','Autoriza este dispositivo antes de vincular la cuenta.');
  const identity = await verifyFirebaseToken(body.firebaseIdToken);
  if (!identity.email_verified) throw new ApiError(403,'EMAIL_VERIFICATION_REQUIRED','Verifica tu correo antes de vincular la cuenta administrativa.');
  const bearer = String(req.headers.authorization).replace(/^Bearer\s+/i, '');
  const data = await rpc('api_bind_firebase_device', {
    p_auth_user_id:staff.id,p_device_public_id:deviceId,p_firebase_uid:identity.uid,p_role:staff.role,
    p_credential_hash:bearer.startsWith('drd.') ? createHash('sha256').update(bearer).digest('hex') : null
  });
  return {...data, firebaseUid:identity.uid, role:staff.role};
});
