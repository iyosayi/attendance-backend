import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User';
import logger from '../src/utils/logger';

// Load environment variables
dotenv.config();

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    
    logger.info('Connected to MongoDB');

    // Admin user data
    const adminData = {
      username: 'adminnyc',
      email: 'admin@camp.com',
      password: 'admin123',
      fullName: 'System Administrator',
      role: 'admin',
      isActive: true,
    };

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminData.email });
    
    if (existingAdmin) {
      logger.warn(`Admin user with email ${adminData.email} already exists`);
      console.log('\n⚠️  Admin user already exists!');
      console.log('Email:', adminData.email);
      console.log('Username:', existingAdmin.username);
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create(adminData);
    
    logger.info('Admin user created successfully', { 
      userId: admin._id, 
      email: admin.email 
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email:    ', admin.email);
    console.log('Username: ', admin.username);
    console.log('Password: ', adminData.password);
    console.log('Role:     ', admin.role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error creating admin user:', error);
    console.error('\n❌ Error creating admin user:', error);
    process.exit(1);
  }
};

// Run the script
createAdmin();
