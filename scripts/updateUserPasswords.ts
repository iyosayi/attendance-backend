import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../src/models/User';
import logger from '../src/utils/logger';

dotenv.config();

type CliArgs = {
  domain?: string;
  password?: string;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const [key, inlineValue] = token.split('=');
    const nextValue = inlineValue ?? argv[i + 1];

    if (key === '--domain') {
      args.domain = inlineValue ?? nextValue;
      if (!inlineValue) i++;
      continue;
    }

    if (key === '--password') {
      args.password = inlineValue ?? nextValue;
      if (!inlineValue) i++;
      continue;
    }
  }

  return args;
}

function printUsage(): void {
  // Intentionally do not echo passwords in examples beyond placeholder
  console.log('\nUsage:');
  console.log('  npm run update:passwords -- --domain helplinenation.org --password password123');
  console.log('  npm run update:passwords -- --domain helplinenation.org --password=password123');
  console.log('\nNotes:');
  console.log('  - Updates all users with email ending in @<domain>');
  console.log('  - Uses MONGODB_URI from env (or defaults to localhost like other scripts)');
  console.log('');
}

function normalizeDomain(domain: string): string {
  let d = domain.trim().toLowerCase();
  if (d.startsWith('@')) d = d.slice(1);
  return d;
}

async function main() {
  const { domain, password } = parseArgs(process.argv.slice(2));

  if (!domain || !password) {
    console.error('❌ Missing required arguments: --domain and --password are required.');
    printUsage();
    process.exit(1);
  }

  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain || normalizedDomain.includes(' ') || normalizedDomain.includes('/')) {
    console.error('❌ Invalid --domain. Expected something like "helplinenation.org".');
    process.exit(1);
  }

  if (password.trim().length < 8) {
    console.error('❌ Invalid --password. Password must be at least 8 characters.');
    process.exit(1);
  }

  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
  await mongoose.connect(mongoURI);
  logger.info('Connected to MongoDB');

  try {
    const emailRegex = new RegExp(`@${normalizedDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const filter = { email: { $regex: emailRegex } };

    const matched = await User.countDocuments(filter);
    console.log(`\n📌 Domain: ${normalizedDomain}`);
    console.log(`👥 Users matched: ${matched}`);

    if (matched === 0) {
      console.log('\n⚠️  No users matched. No changes made.\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    // IMPORTANT: updateMany bypasses mongoose pre-save hooks, so we must hash here.
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await User.updateMany(filter, { $set: { password: hashedPassword } });

    // Mongoose v8 returns { matchedCount, modifiedCount }
    const modifiedCount = (result as any).modifiedCount ?? 0;
    const matchedCount = (result as any).matchedCount ?? matched;

    console.log('\n✅ Password update complete');
    console.log(`   Matched:  ${matchedCount}`);
    console.log(`   Modified: ${modifiedCount}\n`);

    logger.info('Bulk password update by domain completed', {
      domain: normalizedDomain,
      matched: matchedCount,
      modified: modifiedCount,
    });
  } catch (error) {
    logger.error('Error updating passwords by domain:', error);
    console.error('\n❌ Error updating passwords by domain:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  logger.error('Fatal error updating passwords by domain:', error);
  console.error('\n❌ Fatal error updating passwords by domain:', error);
  process.exit(1);
});



