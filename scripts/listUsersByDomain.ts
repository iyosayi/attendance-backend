import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import User from '../src/models/User';
import logger from '../src/utils/logger';

dotenv.config();

type CliArgs = {
  domain?: string;
  out?: string;
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

    if (key === '--out') {
      args.out = inlineValue ?? nextValue;
      if (!inlineValue) i++;
      continue;
    }
  }

  return args;
}

function printUsage(): void {
  console.log('\nUsage:');
  console.log('  npm run list:users -- --domain helplinenation.org');
  console.log('  npm run list:users -- --domain helplinenation.org --out helplinenation-users.csv');
  console.log('\nOutput: CSV with header: email,username');
  console.log('');
}

function normalizeDomain(domain: string): string {
  let d = domain.trim().toLowerCase();
  if (d.startsWith('@')) d = d.slice(1);
  return d;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const { domain, out } = parseArgs(process.argv.slice(2));

  if (!domain) {
    console.error('❌ Missing required argument: --domain is required.');
    printUsage();
    process.exit(1);
  }

  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain || normalizedDomain.includes(' ') || normalizedDomain.includes('/')) {
    console.error('❌ Invalid --domain. Expected something like "helplinenation.org".');
    process.exit(1);
  }

  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
  await mongoose.connect(mongoURI);
  logger.info('Connected to MongoDB');

  try {
    const emailRegex = new RegExp(`@${escapeRegex(normalizedDomain)}$`, 'i');

    const users = await User.find({ email: { $regex: emailRegex } })
      .select('email username')
      .sort({ email: 1 })
      .lean();

    const lines: string[] = ['email,username'];
    for (const u of users) {
      // Avoid commas breaking CSV; minimal quoting.
      const email = String(u.email ?? '').replace(/"/g, '""');
      const username = String(u.username ?? '').replace(/"/g, '""');
      lines.push(`"${email}","${username}"`);
    }

    const csv = lines.join('\n') + '\n';

    if (out) {
      fs.writeFileSync(out, csv, 'utf8');
      console.log(`\n✅ Wrote ${users.length} users to ${out}\n`);
    } else {
      console.log(csv);
      console.log(`\n✅ Total users: ${users.length}\n`);
    }

    logger.info('Listed users by domain', { domain: normalizedDomain, count: users.length, out });
  } catch (error) {
    logger.error('Error listing users by domain:', error);
    console.error('\n❌ Error listing users by domain:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  logger.error('Fatal error listing users by domain:', error);
  console.error('\n❌ Fatal error listing users by domain:', error);
  process.exit(1);
});




