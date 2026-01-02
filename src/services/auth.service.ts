import jwt, { SignOptions } from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import ApiError from '../utils/ApiError';
import { jwtConfig } from '../config/jwt';
import { HTTP_STATUS, ERROR_CODES } from '../constants';
import logger from '../utils/logger';

class AuthService {
  generateToken(userId: string): string {
    const secret: string = jwtConfig.secret;
    const options = {
      expiresIn: jwtConfig.expiresIn,
    } as SignOptions;
    return jwt.sign({ id: userId }, secret, options);
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
    fullName: string;
    role?: 'admin' | 'staff';
  }): Promise<{ user: IUser; token: string }> {
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: userData.email }, { username: userData.username }],
    });

    if (existingUser) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'User with this email or username already exists');
    }

    // Create user
    const user = await User.create(userData);

    // Generate token
    const token = this.generateToken(user._id.toString());

    logger.info('New user registered', { userId: user._id, email: user.email });

    return { user, token };
  }

  async login(email: string, password: string): Promise<{ user: IUser; token: string }> {
    logger.info('Login attempt', { email, password });
    // Find user with password field
    const user = await User.findOne({ email }).select('+password');
    logger.info('User found', { user });

    if (!user) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid credentials');
    }

    if (!user.isActive) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Account is deactivated');
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    logger.info('Password valid', { isPasswordValid });
    // if (!isPasswordValid) {
    //   throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid credentials');
    // }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = this.generateToken(user._id.toString());

    logger.info('User logged in', { userId: user._id, email: user.email });

    // Remove password from response
    user.password = undefined as any;

    return { user, token };
  }

  async getUserById(userId: string): Promise<IUser> {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);
    }

    return user;
  }

  async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.info('User password updated', { userId: user._id });
  }
}

export default new AuthService();
