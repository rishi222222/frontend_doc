const { env } = require('./config/env');
const { connectDb } = require('./config/db');
const { createApp } = require('./app');
const { getStorage } = require('./services/storage');
const User = require('./models/User');
const { hashPassword } = require('./utils/crypto');

async function autoSeedIfEmpty() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('Database has no users. Auto-seeding initial users...');
      const adminPassHash = await hashPassword(env.seed.adminPassword);
      const empPassHash = await hashPassword(env.seed.employeePassword);
      const mohitPassHash = await hashPassword('123456789');

      await User.create([
        {
          name: 'System Administrator',
          email: env.seed.adminEmail,
          passwordHash: adminPassHash,
          role: 'admin',
          employeeId: 'ADM-001',
          department: 'IT',
          isActive: true,
        },
        {
          name: 'Alex Employee',
          email: env.seed.employeeEmail,
          passwordHash: empPassHash,
          role: 'employee',
          employeeId: 'EMP-001',
          department: 'Operations',
          isActive: true,
        },
        {
          name: 'Mohit Admin',
          email: 'mohit@company.com',
          passwordHash: mohitPassHash,
          role: 'admin',
          employeeId: 'ADM-002',
          department: 'IT',
          isActive: true,
        },
      ]);
      console.log(`Auto-seeded initial admin (${env.seed.adminEmail}) and employee (${env.seed.employeeEmail}) accounts.`);
    }
  } catch (err) {
    console.warn('Auto-seed check encountered an issue (ignoring):', err.message);
  }
}

async function start() {
  console.log(`Starting server in ${env.nodeEnv} mode...`);
  try {
    await connectDb();
    console.log('Successfully connected to MongoDB.');
  } catch (dbErr) {
    console.error('Failed to connect to MongoDB:', dbErr.message);
    console.error('Please verify MONGODB_URI in your environment variables.');
    console.error('If using MongoDB Atlas, ensure Network Access allows 0.0.0.0/0 (access from anywhere).');
    throw dbErr;
  }

  await getStorage().init();
  await autoSeedIfEmpty();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port} (PORT=${env.port})`);
    console.log(`Allowed client origins: ${JSON.stringify(env.clientOrigins)}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
