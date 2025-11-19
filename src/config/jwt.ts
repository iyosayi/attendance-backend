export const jwtConfig = {
  secret: (process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production') as string,
  expiresIn: (process.env.JWT_EXPIRE || '24h') as string,
  refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRE || '7d') as string,
};

export default jwtConfig;
