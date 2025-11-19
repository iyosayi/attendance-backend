import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import bcrypt from 'bcrypt';
import User from '../src/models/User';
import logger from '../src/utils/logger';

// Load environment variables
dotenv.config();

interface CsvRow {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: string;
  [key: string]: string;
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidRole = (role: string): boolean => {
  return role.toLowerCase() === 'admin' || role.toLowerCase() === 'staff';
};

const bulkCreateUsers = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);

    logger.info('Connected to MongoDB');
    console.log('\n✅ Connected to MongoDB\n');

    // Get CSV file path from command line argument or use default
    const csvFileName = process.argv[2] || 'users.csv';
    const csvPath = path.join(__dirname, '..', csvFileName);

    // Check if CSV file exists
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ Error: CSV file not found at ${csvPath}`);
      console.log('\nUsage: npm run bulk:users [csv-file-path]');
      console.log('\nExample:');
      console.log('  npm run bulk:users users.csv');
      console.log('  npm run bulk:users data/staff.csv');
      console.log('\nCSV format (required columns):');
      console.log('  username,email,password,fullName,role');
      console.log('\nExample CSV content:');
      console.log('  username,email,password,fullName,role');
      console.log('  admin1,admin1@camp.com,admin123,Admin One,admin');
      console.log('  staff1,staff1@camp.com,staff123,Staff One,staff');
      process.exit(1);
    }

    // Read and parse CSV
    const rows: CsvRow[] = [];

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve())
        .on('error', (error) => reject(error));
    });

    console.log(`📄 Found ${rows.length} rows in CSV\n`);

    if (rows.length === 0) {
      console.log('⚠️  No data found in CSV file');
      process.exit(0);
    }

    // Process and validate data
    const usersToInsert: any[] = [];
    const errors: any[] = [];
    const duplicates: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because CSV has header and arrays are 0-indexed

      // Skip empty rows
      if (!row.username && !row.email && !row.fullName) {
        continue;
      }

      // Trim fields
      const username = row.username?.trim().toLowerCase() || '';
      const email = row.email?.trim().toLowerCase() || '';
      const password = row.password?.trim() || '';
      const fullName = row.fullName?.trim() || '';
      const role = row.role?.trim().toLowerCase() || 'staff';

      // Validate required fields
      if (!username || !email || !password || !fullName) {
        errors.push({
          row: rowNumber,
          reason: 'Missing required fields (username, email, password, or fullName)',
          data: { username, email, fullName },
        });
        continue;
      }

      // Validate email format
      if (!isValidEmail(email)) {
        errors.push({
          row: rowNumber,
          reason: 'Invalid email format',
          data: { username, email, fullName },
        });
        continue;
      }

      // Validate password length
      if (password.length < 8) {
        errors.push({
          row: rowNumber,
          reason: 'Password must be at least 8 characters long',
          data: { username, email, fullName },
        });
        continue;
      }

      // Validate role
      if (!isValidRole(role)) {
        errors.push({
          row: rowNumber,
          reason: `Invalid role: ${role}. Must be 'admin' or 'staff'`,
          data: { username, email, fullName, role },
        });
        continue;
      }

      // Check for duplicates within the CSV itself
      if (usersToInsert.some(u => 
        u.username.toLowerCase() === username || u.email.toLowerCase() === email
      )) {
        duplicates.push(`Row ${rowNumber}: ${username} (${email}) - duplicate in CSV`);
        continue;
      }

      // Build user object (password will be hashed before insert)
      const user = {
        username,
        email,
        password, // Will be hashed before insert
        fullName,
        role: role as 'admin' | 'staff',
        isActive: true,
      };

      usersToInsert.push(user);
    }

    // Display summary before import
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Import Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total rows in CSV:       ${rows.length}`);
    console.log(`Valid users to import:   ${usersToInsert.length}`);
    console.log(`Duplicates skipped:      ${duplicates.length}`);
    console.log(`Errors/Invalid rows:     ${errors.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (errors.length > 0) {
      console.log('❌ Errors found:');
      errors.slice(0, 10).forEach(err => {
        console.log(`   Row ${err.row}: ${err.reason}`);
        console.log(`      Data: ${JSON.stringify(err.data)}`);
      });
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors\n`);
      }
      console.log('');
    }

    if (duplicates.length > 0) {
      console.log('⚠️  Duplicates skipped (within CSV):');
      duplicates.slice(0, 10).forEach(dup => {
        console.log(`   ${dup}`);
      });
      if (duplicates.length > 10) {
        console.log(`   ... and ${duplicates.length - 10} more duplicates\n`);
      }
      console.log('');
    }

    if (usersToInsert.length === 0) {
      console.log('⚠️  No valid users to import');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Check for existing users in database
    const existingUsers = await User.find({
      $or: [
        { email: { $in: usersToInsert.map(u => u.email) } },
        { username: { $in: usersToInsert.map(u => u.username) } },
      ],
    });

    const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));
    const existingUsernames = new Set(existingUsers.map(u => u.username.toLowerCase()));

    // Filter out users that already exist
    const usersToCreate = usersToInsert.filter(user => {
      const emailExists = existingEmails.has(user.email.toLowerCase());
      const usernameExists = existingUsernames.has(user.username.toLowerCase());
      
      if (emailExists || usernameExists) {
        const reason = emailExists && usernameExists 
          ? 'email and username' 
          : emailExists 
          ? 'email' 
          : 'username';
        duplicates.push(`${user.username} (${user.email}) - ${reason} already exists in database`);
        return false;
      }
      return true;
    });

    if (usersToCreate.length === 0) {
      console.log('⚠️  All users already exist in the database');
      if (duplicates.length > 0) {
        console.log('\n⚠️  Existing users:');
        duplicates.forEach(dup => {
          console.log(`   ${dup}`);
        });
      }
      await mongoose.disconnect();
      process.exit(0);
    }

    // Hash passwords before inserting (insertMany bypasses pre-save hooks)
    console.log(`🔐 Hashing passwords...\n`);
    for (const user of usersToCreate) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
    }

    // Batch insert users
    console.log(`🚀 Creating ${usersToCreate.length} users...\n`);

    const batchSize = 50;
    let created = 0;
    let insertErrors: any[] = [];

    for (let i = 0; i < usersToCreate.length; i += batchSize) {
      const batch = usersToCreate.slice(i, i + batchSize);
      
      try {
        await User.insertMany(batch, { ordered: false });
        created += batch.length;
      } catch (error: any) {
        // Handle bulk write errors (duplicate emails, validation errors, etc.)
        if (error.writeErrors) {
          for (const writeError of error.writeErrors) {
            const failedUser = batch[writeError.index];
            const errorCode = writeError.err?.code || writeError.code;
            
            // Extract error message
            let errorMsg = '';
            if (writeError.err?.errmsg) {
              errorMsg = writeError.err.errmsg;
            } else if (writeError.errmsg) {
              errorMsg = writeError.errmsg;
            } else if (writeError.err?.message) {
              errorMsg = writeError.err.message;
            } else if (writeError.message) {
              errorMsg = writeError.message;
            } else {
              errorMsg = JSON.stringify(writeError.err || writeError);
            }
            
            if (errorCode === 11000) {
              // Duplicate key error
              duplicates.push(`${failedUser.username} (${failedUser.email}) - duplicate key error`);
            } else {
              insertErrors.push({
                user: `${failedUser.username} (${failedUser.email})`,
                error: errorMsg,
                code: errorCode,
              });
            }
          }
          // Count successfully inserted records
          created += batch.length - error.writeErrors.length;
        } else if (error.errors) {
          // Mongoose validation errors
          const validationErrors = Object.keys(error.errors).map(key => {
            return `${key}: ${error.errors[key].message}`;
          }).join('; ');
          insertErrors.push({
            batch: `Batch starting at index ${i}`,
            error: `Validation error: ${validationErrors}`,
          });
        } else {
          // Other errors
          insertErrors.push({
            batch: `Batch starting at index ${i}`,
            error: error.message || JSON.stringify(error),
          });
        }
      }

      const progress = ((created / usersToCreate.length) * 100).toFixed(1);
      process.stdout.write(`\r   Progress: ${created}/${usersToCreate.length} (${progress}%)`);
    }

    console.log('\n\n✅ Import completed!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Final Statistics');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Count by role
    const adminsCreated = usersToCreate.filter(u => u.role === 'admin').length;
    const staffCreated = usersToCreate.filter(u => u.role === 'staff').length;
    
    console.log(`Users created:           ${created}`);
    console.log(`  - Admins:              ${adminsCreated}`);
    console.log(`  - Staff:               ${staffCreated}`);
    console.log(`Duplicates skipped:      ${duplicates.length}`);
    console.log(`Validation errors:       ${errors.length}`);
    console.log(`Insert errors:           ${insertErrors.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (duplicates.length > 0 && duplicates.length <= 20) {
      console.log('⚠️  Duplicates/existing users:');
      duplicates.forEach(dup => {
        console.log(`   ${dup}`);
      });
      console.log('');
    } else if (duplicates.length > 20) {
      console.log('⚠️  Duplicates/existing users (showing first 20):');
      duplicates.slice(0, 20).forEach(dup => {
        console.log(`   ${dup}`);
      });
      console.log(`   ... and ${duplicates.length - 20} more\n`);
    }

    if (insertErrors.length > 0) {
      console.log('❌ Insert errors:');
      insertErrors.slice(0, 10).forEach(err => {
        const errorDetails = err.code ? `[Code: ${err.code}] ` : '';
        console.log(`   ${err.user || err.batch}: ${errorDetails}${err.error}`);
      });
      if (insertErrors.length > 10) {
        console.log(`   ... and ${insertErrors.length - 10} more errors\n`);
      }
      console.log('');
    }

    logger.info('Bulk user creation completed', {
      created,
      adminsCreated,
      staffCreated,
      duplicates: duplicates.length,
      validationErrors: errors.length,
      insertErrors: insertErrors.length,
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Error creating users:', error);
    console.error('\n❌ Error creating users:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the script
bulkCreateUsers();

