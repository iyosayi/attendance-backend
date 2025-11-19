import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User';
import logger from '../src/utils/logger';

// Load environment variables
dotenv.config();

// Parse command-line arguments
const parseArgs = () => {
  const args: { [key: string]: string } = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i]?.replace(/^--/, '');
    const value = process.argv[i + 1];
    if (key && value) {
      args[key] = value;
    }
  }
  return args;
};

const createStaff = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    
    logger.info('Connected to MongoDB');

    // Parse command-line arguments
    const args = parseArgs();

    // Validate required fields
    if (!args.username || !args.email || !args.password || !args.fullName) {
      console.error('\n❌ Error: Missing required fields');
      console.log('\nUsage: npm run seed:staff -- --username <username> --email <email> --password <password> --fullName "<full name>"');
      console.log('\nExample:');
      console.log('  npm run seed:staff -- --username staff1 --email staff1@camp.com --password staff123 --fullName "John Doe"');
      process.exit(1);
    }

    // Staff user data
    const staffData = {
      username: args.username,
      email: args.email,
      password: args.password,
      fullName: args.fullName,
      role: 'staff' as const,
      isActive: true,
    };

    // Check if staff user already exists
    const existingStaff = await User.findOne({
      $or: [{ email: staffData.email }, { username: staffData.username }],
    });
    
    if (existingStaff) {
      logger.warn(`Staff user with email ${staffData.email} or username ${staffData.username} already exists`);
      console.log('\n⚠️  Staff user already exists!');
      console.log('Email:   ', existingStaff.email);
      console.log('Username:', existingStaff.username);
      process.exit(0);
    }

    // Create staff user
    const staff = await User.create(staffData);
    
    logger.info('Staff user created successfully', { 
      userId: staff._id, 
      email: staff.email,
      username: staff.username
    });

    console.log('\n✅ Staff user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email:    ', staff.email);
    console.log('Username: ', staff.username);
    console.log('Full Name:', staff.fullName);
    console.log('Password: ', staffData.password);
    console.log('Role:     ', staff.role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Error creating staff user:', error);
    console.error('\n❌ Error creating staff user:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the script
createStaff();

