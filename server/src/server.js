const { env } = require('./config/env');
const { connectDb } = require('./config/db');
const { createApp } = require('./app');
const { getStorage } = require('./services/storage');
const User = require('./models/User');
const { hashPassword } = require('./utils/crypto');

async function autoSeedIfEmpty() {
  try {
    const seedAccounts = [
      {
        name: 'System Administrator',
        email: env.seed.adminEmail,
        password: env.seed.adminPassword,
        role: 'admin',
        employeeId: 'ADM-001',
        department: 'IT',
      },
      {
        name: 'Alex Employee',
        email: env.seed.employeeEmail,
        password: env.seed.employeePassword,
        role: 'employee',
        employeeId: 'EMP-001',
        department: 'Operations',
      },
      {
        name: 'Mohit Admin',
        email: 'mohit@company.com',
        password: '123456789',
        role: 'admin',
        employeeId: 'ADM-002',
        department: 'IT',
      },
      {
        name: 'Casey Brooks',
        email: 'casey@company.com',
        password: 'Employee123!@#',
        role: 'employee',
        employeeId: 'EMP-007',
        department: 'Operations',
      },
      {
        name: 'Jordan Colleague',
        email: 'jordan@company.com',
        password: 'Employee123!@#',
        role: 'employee',
        employeeId: 'EMP-002',
        department: 'Finance',
      },
      {
        name: 'Priya Sharma',
        email: 'priya@company.com',
        password: 'Employee123!@#',
        role: 'employee',
        employeeId: 'EMP-003',
        department: 'Human Resources',
      },
    ];

    for (const acc of seedAccounts) {
      const exists = await User.findOne({ email: acc.email });
      if (!exists) {
        const passwordHash = await hashPassword(acc.password);
        await User.create({
          name: acc.name,
          email: acc.email,
          passwordHash,
          role: acc.role,
          employeeId: acc.employeeId,
          department: acc.department,
          isActive: true,
        });
        console.log(`Auto-seeded seed account: ${acc.email} (${acc.role})`);
      }
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
