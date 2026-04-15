import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const ACCESS_TOKEN_TTL = '24h';
const REFRESH_TOKEN_TTL = '30d';

function getSecrets() {
  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!jwtSecret || !refreshSecret) {
    throw new Error('JWT secrets are not configured');
  }

  return { jwtSecret, refreshSecret };
}

function sanitizeUser(user) {
  return {
    id: user._id,
    email: user.email,
    role: user.role,
    planTier: user.planTier,
  };
}

function signAccessToken(user) {
  const { jwtSecret } = getSecrets();
  return jwt.sign({ sub: user._id, role: user.role }, jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
}

function signRefreshToken(user) {
  const { refreshSecret } = getSecrets();
  return jwt.sign({ sub: user._id }, refreshSecret, { expiresIn: REFRESH_TOKEN_TTL });
}

export async function registerUser({ email, password, role = 'employee' }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !password || password.length < 8) {
    const error = new Error('Email and password (min 8 chars) are required');
    error.statusCode = 400;
    throw error;
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    const error = new Error('Email already registered');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    email: normalizedEmail,
    passwordHash,
    role: role === 'admin' ? 'admin' : 'employee',
  });

  return {
    user: sanitizeUser(user),
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

export async function loginUser({ email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(password || '', user.passwordHash);
  if (!isMatch) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  return {
    user: sanitizeUser(user),
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

export async function refreshAccessToken(refreshToken) {
  const { refreshSecret } = getSecrets();

  let payload;
  try {
    payload = jwt.verify(refreshToken, refreshSecret);
  } catch (_error) {
    const error = new Error('Invalid refresh token');
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    const error = new Error('Invalid refresh token');
    error.statusCode = 401;
    throw error;
  }

  return {
    accessToken: signAccessToken(user),
    user: sanitizeUser(user),
  };
}

export function toPublicUser(user) {
  return sanitizeUser(user);
}
