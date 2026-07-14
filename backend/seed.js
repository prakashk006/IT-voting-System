const db = require('./db');
const bcrypt = require('bcryptjs');

const getPasswordForStudent = (name, dob) => {
  const namePart = name.substring(0, 2).toUpperCase();
  const dobPart = dob.replace(/\//g, ''); // Removes slashes from "15/08/2005" to get "15082005"
  return namePart + dobPart;
};

const seed = async () => {
  try {
    console.log('Initializing database tables...');
    await db.initDb();

    console.log('Checking database status...');
    
    // 1. Seed Admin Settings
    const adminCheck = await db.get('settings', { key: 'admin_password' });
    if (!adminCheck) {
      console.log('Seeding admin credentials...');
      const adminPassword = 'admin'; // Hashed in database
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await db.insert('settings', { key: 'admin_password', value: hashedPassword });
      await db.insert('settings', { key: 'results_released', value: 'false' });
      console.log('Admin credentials seeded (default password: "admin").');
    }

    // 2. Seed Sample Students with DOBs & Hashed Passwords
    const allStudents = await db.all('students');
    if (allStudents.length === 0) {
      console.log('Seeding sample IT students with passwords...');
      const sampleStudentsRaw = [
        { id: 'IT202601', name: 'Aakash R', email: 'aakash@it.edu', dob: '15/08/2005' },
        { id: 'IT202602', name: 'Bhavana S', email: 'bhavana@it.edu', dob: '22/10/2006' },
        { id: 'IT202603', name: 'Chandru M', email: 'chandru@it.edu', dob: '05/12/2005' },
        { id: 'IT202604', name: 'Deepa K', email: 'deepa@it.edu', dob: '19/04/2006' },
        { id: 'IT202605', name: 'Eshwar P', email: 'eshwar@it.edu', dob: '30/09/2005' }
      ];

      for (const studentRaw of sampleStudentsRaw) {
        const plainPassword = getPasswordForStudent(studentRaw.name, studentRaw.dob);
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        await db.insert('students', {
          id: studentRaw.id,
          name: studentRaw.name,
          email: studentRaw.email,
          dob: studentRaw.dob,
          password: hashedPassword,
          failed_attempts: 0,
          is_blocked: 0,
          has_voted: 0,
          otp: null,
          otp_expiry: null
        });
        
        console.log(`Seeded student ${studentRaw.name} (Password: ${plainPassword})`);
      }
      console.log(`${sampleStudentsRaw.length} sample students seeded.`);
    }

    // 3. Seed Sample Candidates
    const allCandidates = await db.all('candidates');
    if (allCandidates.length === 0) {
      console.log('Seeding sample candidates...');
      const sampleCandidates = [
        {
          name: 'Aravind Swamy',
          position: 'President',
          year_class: '4th Year IT-A',
          photo_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=aravind'
        },
        {
          name: 'Meera Jasmine',
          position: 'President',
          year_class: '4th Year IT-B',
          photo_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=meera'
        },
        {
          name: 'Sanjay Dutt',
          position: 'Vice-President',
          year_class: '3rd Year IT-A',
          photo_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=sanjay'
        },
        {
          name: 'Sneha Reddy',
          position: 'Vice-President',
          year_class: '3rd Year IT-B',
          photo_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=sneha'
        },
        {
          name: 'Rahul Dravid',
          position: 'Secretary',
          year_class: '3rd Year IT-A',
          photo_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=rahul'
        },
        {
          name: 'Divya Spandana',
          position: 'Secretary',
          year_class: '3rd Year IT-B',
          photo_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=divya'
        },
        {
          name: 'Vijay Joseph',
          position: 'Joint Secretary',
          year_class: '2nd Year IT-A',
          photo_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=vijay'
        },
        {
          name: 'Harini Iyer',
          position: 'Joint Secretary',
          year_class: '2nd Year IT-B',
          photo_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=harini'
        }
      ];

      for (const cand of sampleCandidates) {
        await db.insert('candidates', cand);
      }
      console.log(`${sampleCandidates.length} sample candidates seeded.`);
    }

    console.log('Database seeding successfully finished!');
  } catch (error) {
    console.error('Seeding database failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seed();
}

module.exports = seed;
