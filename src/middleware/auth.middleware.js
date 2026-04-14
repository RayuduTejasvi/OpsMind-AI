import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

function getBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return '';
  }

  const [scheme, token] = headerValue.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return '';
  }

  return token;
}

export async function requireAuth(request, _response, next) {
  try {
    const token = getBearerToken(request.headers.authorization);
    if (!token) {
      const error = new Error('Unauthorized');
      error.statusCode = 401;
      throw error;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not set');
    }

    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findById(payload.sub);

    if (!user) {
      const error = new Error('Unauthorized');
      error.statusCode = 401;
      throw error;
    }

    request.user = user;
    next();
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 401;
    }
    next(error);
  }
}

export function requireAdmin(request, _response, next) {
  if (!request.user || request.user.role !== 'admin') {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    return next(error);
  }

  return next();
}
