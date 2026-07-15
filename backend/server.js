require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const seed = require('./seed');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'it-voting-secret-key-2026-secure';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Disk Storage Configuration (Saves photos locally with unique names)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Serve candidate uploads statically so the frontend can read them
app.use('/uploads', express.static(uploadsDir));

/* ==========================================================================
   EMAIL DISPATCH CONFIGURATION (Resend API Platform)
   ========================================================================== */

const IS_TEST_ENV = process.env.NODE_ENV === 'test';

// Pipedream Webhook array for rotating/failover traffic
const PIPEDREAM_URLS = [
  process.env.PIPEDREAM_WEBHOOK_URL || process.env.PIPEDREAM_URL_1,
  process.env.PIPEDREAM_URL_2,
  process.env.PIPEDREAM_URL_3,
  process.env.PIPEDREAM_URL_4
].filter(Boolean);

let currentWebhookIndex = 0;

// Resend Email API setup (With Dual-Account Failover Support)
const RESEND_API_KEY_PRIMARY = process.env.RESEND_API_KEY_PRIMARY || process.env.RESEND_API_KEY; // Backward compatible fallback
const RESEND_API_KEY_SECONDARY = process.env.RESEND_API_KEY_SECONDARY;

const resendPrimary = RESEND_API_KEY_PRIMARY ? new Resend(RESEND_API_KEY_PRIMARY) : null;
const resendSecondary = RESEND_API_KEY_SECONDARY ? new Resend(RESEND_API_KEY_SECONDARY) : null;

// Tracker state to handle active Resend key (Sticky failover)
let useSecondaryResend = false;

// Log operational mail state
if (IS_TEST_ENV) {
  console.log('📬 Mail Mode: Test Mode active. Simulated OTP logs enabled.');
} else if (PIPEDREAM_URLS.length > 0) {
  console.log(`📬 Mail Mode: HTTP Pipedream Webhooks active. (${PIPEDREAM_URLS.length} accounts configured for rotating load balancing).`);
} else if (resendPrimary) {
  if (resendSecondary) {
    console.log('📬 Mail Mode: Dual Resend API active with automatic failover.');
    console.log('   Primary API Key:   Configured');
    console.log('   Secondary API Key: Configured');
  } else {
    console.log('📬 Mail Mode: Cloud Resend API active (Single Key).');
  }
} else {
  console.error('❌ CRITICAL CONFIG WARNING: Pipedream Webhooks or Resend API Key is missing! Email dispatching will fail in production.');
}

app.use(cors());
app.use(express.json());

// Auto initialize and seed database on startup
(async () => {
  try {
    await db.initDb();
    await seed();
    console.log('JSON Database loaded and ready.');
  } catch (err) {
    console.error('Failed to initialize database on startup:', err);
  }
})();

// Helper middleware to authenticate JWT for voters
const authenticateVoterToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    if (user.role === 'admin') return res.status(403).json({ error: 'Admins cannot perform voter actions.' });
    req.user = user;
    next();
  });
};

// Helper middleware to authenticate JWT for admins
const authenticateAdminToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Admin token required.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err || user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }
    req.user = user;
    next();
  });
};

/* ==========================================================================
   AUTHENTICATION ENDPOINTS
   ========================================================================== */

// 1. Step 1 Login: Verify credentials (Roll No, Password) & Request OTP
app.post('/api/auth/login-step1', async (req, res) => {
  const { studentId, password } = req.body;

  if (!studentId || !password) {
    return res.status(400).json({ error: 'Roll Number and Password are required.' });
  }

  try {
    const student = await db.get('students', { id: studentId });

    if (!student) {
      return res.status(404).json({ error: 'Student not found in IT Department registry.' });
    }

    if (student.is_blocked === 1) {
      return res.status(403).json({
        error: 'Account blocked due to multiple failed login attempts. Please contact the IT Department Administrator to unlock your account.'
      });
    }

    if (student.has_voted === 1) {
      return res.status(400).json({ error: 'You have already cast your vote. Double voting is restricted.' });
    }

    let match = false;
    const isBcryptHash = student.password && (student.password.startsWith('$2a$') || student.password.startsWith('$2b$'));

    if (isBcryptHash) {
      match = await bcrypt.compare(password, student.password);
    } else {
      // Direct comparison with plain text password (imported from raw spreadsheet)
      match = password === student.password;

      if (match) {
        // Automatically hash the plain text password for future logins
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.update(
          'students',
          { id: studentId },
          { 
            password: hashedPassword,
            failed_attempts: 0,
            is_blocked: 0,
            has_voted: student.has_voted || 0
          }
        );
      }
    }

    if (!match) {
      const newAttempts = (student.failed_attempts || 0) + 1;
      const isBlocked = newAttempts >= 3;
      
      await db.update(
        'students', 
        { id: studentId }, 
        { failed_attempts: newAttempts, is_blocked: isBlocked ? 1 : 0 }
      );

      if (isBlocked) {
        return res.status(403).json({
          error: 'Account blocked due to multiple failed login attempts. Please contact the IT Department Administrator to unlock your account.'
        });
      } else {
        return res.status(401).json({
          error: `Invalid login credentials. Failed attempts: ${newAttempts}/3.`
        });
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 5 * 60 * 1000;

    await db.update(
      'students', 
      { id: studentId }, 
      { failed_attempts: 0, otp, otp_expiry: expiry }
    );

    const emailHtml = `
      <div style="font-family: sans-serif; padding: 24px; max-width: 500px; margin: 0 auto; background: #0c1224; color: #f8fafc; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
        <h2 style="color: #3b82f6; margin-bottom: 8px; font-size: 20px; text-align: center;">IT Department Elections 2026</h2>
        <p style="color: #94a3b8; font-size: 15px;">Hello <strong>${student.name}</strong>,</p>
        <p style="color: #94a3b8; font-size: 15px; margin-bottom: 24px;">Your 2FA verification code to log into the Online Voting portal is:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; background: rgba(59, 130, 246, 0.1); border: 1px solid #3b82f6; padding: 12px 28px; border-radius: 8px; font-size: 26px; font-weight: bold; color: #60a5fa; letter-spacing: 5px;">
            ${otp}
          </span>
        </div>
        <p style="color: #64748b; font-size: 13px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 16px; margin-top: 0; text-align: center;">This code is valid for 5 minutes. Do not share this OTP with anyone.</p>
      </div>
    `;

    let emailSent = false;
    let sendError = null;

    // A. TEST ENVIRONMENT MOCK BYPASS
    if (IS_TEST_ENV) {
      console.log(`\n==========================================`);
      console.log(`[TEST MOCK EMAIL SENT TO: ${student.email}]`);
      console.log(`Your 2FA Voting OTP Code is: ${otp}`);
      console.log(`==========================================\n`);
      emailSent = true;
    } 
    // B. PIPEDREAM WEBHOOK DISPATCH (Rotating / Failover for 400+ students)
    else if (PIPEDREAM_URLS.length > 0) {
      let attempts = 0;
      while (!emailSent && attempts < PIPEDREAM_URLS.length) {
        const activeUrl = PIPEDREAM_URLS[currentWebhookIndex];
        try {
          const response = await fetch(activeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: student.email,
              subject: 'IT Office Bearers Election - 2FA OTP Code',
              studentName: student.name,
              otp: otp
            })
          });
          
          if (response.ok) {
            console.log(`[PIPEDREAM #${currentWebhookIndex + 1}] OTP email successfully dispatched to ${student.email}`);
            emailSent = true;
          } else {
            const errMsg = await response.text();
            throw new Error(errMsg || `Status ${response.status}`);
          }
        } catch (err) {
          console.error(`[PIPEDREAM #${currentWebhookIndex + 1}] Failed to send webhook:`, err.message);
          sendError = err.message;
          
          // Switch to the next webhook link in rotation
          currentWebhookIndex = (currentWebhookIndex + 1) % PIPEDREAM_URLS.length;
          attempts++;
        }
      }
    }
    // C. PRODUCTION EMAIL DELIVERY VIA RESEND
    else if (resendPrimary) {
      // 1. Try sending with the current active Resend client (Primary by default)
      if (!useSecondaryResend) {
        try {
          await resendPrimary.emails.send({
            from: 'IT Dept Elections <onboarding@resend.dev>',
            to: student.email,
            subject: 'IT Office Bearers Election - 2FA OTP Code',
            html: emailHtml
          });
          console.log(`[RESEND PRIMARY] OTP email successfully dispatched to ${student.email}`);
          emailSent = true;
        } catch (emailErr) {
          console.error('[RESEND PRIMARY] Failed to send email (possibly limit reached):', emailErr.message);
          sendError = emailErr.message;
          if (resendSecondary) {
            console.log('[RESEND FAILOVER] Activating Secondary Resend API Key...');
            useSecondaryResend = true; // Swap sticky mode to secondary
          }
        }
      }

      // 2. Try sending with Secondary if Primary failed (or if we are already in secondary mode)
      if (!emailSent && resendSecondary) {
        try {
          await resendSecondary.emails.send({
            from: 'IT Dept Elections <onboarding@resend.dev>',
            to: student.email,
            subject: 'IT Office Bearers Election - 2FA OTP Code',
            html: emailHtml
          });
          console.log(`[RESEND SECONDARY] OTP email successfully dispatched to ${student.email}`);
          emailSent = true;
        } catch (emailErr) {
          console.error('[RESEND SECONDARY] Failed to send email:', emailErr.message);
          sendError = emailErr.message;
          // If secondary also fails, swap back to primary for future retries
          useSecondaryResend = false;
        }
      }
    }

    // Block authentication if mail could not be dispatched in production
    if (!emailSent && !IS_TEST_ENV) {
      return res.status(500).json({ 
        error: `Failed to dispatch OTP email: ${sendError || 'Email service not configured'}. Please contact administrator.` 
      });
    }

    res.json({
      message: 'Password verified. OTP code has been generated.',
      // Only return OTP in response if in automated test mode
      demoOtp: IS_TEST_ENV ? otp : null
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 2. Step 2 Login: Verify 6-digit OTP code & Issue Token
app.post('/api/auth/login-step2', async (req, res) => {
  const { studentId, otp } = req.body;

  if (!studentId || !otp) {
    return res.status(400).json({ error: 'Student ID and OTP are required.' });
  }

  try {
    const student = await db.get('students', { id: studentId });

    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    if (student.is_blocked === 1) {
      return res.status(403).json({
        error: 'Account blocked due to multiple failed login attempts. Please contact the IT Department Administrator to unlock your account.'
      });
    }

    if (student.has_voted === 1) {
      return res.status(400).json({ error: 'You have already voted.' });
    }

    const isOtpExpired = !student.otp_expiry || Date.now() > student.otp_expiry;
    const isOtpInvalid = !student.otp || student.otp !== otp;

    if (isOtpInvalid || isOtpExpired) {
      const newAttempts = (student.failed_attempts || 0) + 1;
      const isBlocked = newAttempts >= 3;

      await db.update(
        'students',
        { id: studentId },
        { failed_attempts: newAttempts, is_blocked: isBlocked ? 1 : 0 }
      );

      if (isBlocked) {
        return res.status(403).json({
          error: 'Account blocked due to multiple failed login attempts. Please contact the IT Department Administrator to unlock your account.'
        });
      } else {
        const errorMsg = isOtpExpired 
          ? 'OTP has expired. Please log in again.' 
          : `Invalid OTP code. Failed attempts: ${newAttempts}/3.`;
        return res.status(400).json({ error: errorMsg });
      }
    }

    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    await db.update(
      'students', 
      { id: studentId }, 
      { otp: null, otp_expiry: null, failed_attempts: 0, login_time: timestamp }
    );

    const token = jwt.sign(
      { id: student.id, name: student.name, email: student.email, role: 'voter' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Two-Factor Authentication successful.',
      token,
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        hasVoted: student.has_voted === 1
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 3. Voter Logout Audit
app.post('/api/auth/logout', authenticateVoterToken, async (req, res) => {
  const studentId = req.user.id;
  try {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    await db.update('students', { id: studentId }, { logout_time: timestamp });
    res.json({ message: 'Voter logged out successfully and session closed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record logout session.' });
  }
});

// 3. Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  try {
    const hashRow = await db.get('settings', { key: 'admin_password' });
    if (!hashRow) {
      return res.status(500).json({ error: 'Admin settings not initialized.' });
    }

    const match = await bcrypt.compare(password, hashRow.value);
    if (!match) {
      return res.status(401).json({ error: 'Invalid admin password.' });
    }

    const token = jwt.sign(
      { role: 'admin' },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      message: 'Admin authenticated successfully.',
      token
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ==========================================================================
   VOTER ENDPOINTS (Voter token required)
   ========================================================================== */

// Get Candidates
app.get('/api/candidates', authenticateVoterToken, async (req, res) => {
  try {
    const candidates = await db.all('candidates');
    const grouped = candidates.reduce((acc, candidate) => {
      if (!acc[candidate.position]) {
        acc[candidate.position] = [];
      }
      acc[candidate.position].push(candidate);
      return acc;
    }, {});
    res.json(grouped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve candidates.' });
  }
});

// Cast Vote
app.post('/api/vote', authenticateVoterToken, async (req, res) => {
  const studentId = req.user.id;
  const { selections } = req.body;

  if (!selections || Object.keys(selections).length === 0) {
    return res.status(400).json({ error: 'Ballot is empty. Please select candidates.' });
  }

  try {
    const student = await db.get('students', { id: studentId });
    if (!student) {
      return res.status(404).json({ error: 'Voter record not found.' });
    }

    if (student.has_voted === 1) {
      return res.status(400).json({ error: 'You have already voted. Submission denied.' });
    }

    // Validate candidates exist
    const candidates = await db.all('candidates');
    const candidateIds = Object.values(selections).map(id => Number(id));
    const validCandidates = candidates.filter(c => candidateIds.includes(c.id));

    if (validCandidates.length !== candidateIds.length) {
      return res.status(400).json({ error: 'One or more selected candidates are invalid.' });
    }

    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });

    // Record votes
    for (const [position, candId] of Object.entries(selections)) {
      await db.insert('votes', {
        student_id: studentId,
        position,
        candidate_id: Number(candId)
      });
    }

    await db.update('students', { id: studentId }, { has_voted: 1, vote_time: timestamp });

    res.json({ message: 'Your ballot has been securely cast and recorded.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record vote.' });
  }
});

// Get voter results (Only displays if released)
app.get('/api/results', async (req, res) => {
  try {
    const releasedRow = await db.get('settings', { key: 'results_released' });
    const released = releasedRow && releasedRow.value === 'true';

    if (!released) {
      return res.json({ released: false, message: 'Election results have not been released by the admin yet.' });
    }

    const candidates = await db.all('candidates');
    const votes = await db.all('votes');

    const voteTallies = candidates.map(c => {
      const count = votes.filter(v => v.candidate_id === c.id).length;
      return {
        id: c.id,
        name: c.name,
        position: c.position,
        year_class: c.year_class,
        photo_url: c.photo_url,
        vote_count: count
      };
    });

    const groupedResults = voteTallies.reduce((acc, candidate) => {
      if (!acc[candidate.position]) {
        acc[candidate.position] = [];
      }
      acc[candidate.position].push(candidate);
      return acc;
    }, {});

    for (const pos in groupedResults) {
      groupedResults[pos].sort((a, b) => b.vote_count - a.vote_count);
    }

    const winners = {};
    for (const [position, posCandidates] of Object.entries(groupedResults)) {
      const maxVotes = Math.max(...posCandidates.map(c => c.vote_count));
      winners[position] = posCandidates.filter(c => c.vote_count === maxVotes);
    }

    const students = await db.all('students');
    const totalStudentsCount = students.length;
    const votedStudentsCount = students.filter(s => s.has_voted === 1).length;
    const notVotedCount = totalStudentsCount - votedStudentsCount;

    res.json({
      released: true,
      results: groupedResults,
      winners,
      stats: {
        totalVoters: totalStudentsCount,
        votedCount: votedStudentsCount,
        notVotedCount: notVotedCount,
        turnoutPercentage: totalStudentsCount > 0 
          ? ((votedStudentsCount / totalStudentsCount) * 100).toFixed(1) 
          : 0,
        electionStatus: released ? 'Concluded / Results Released' : 'Active / Voting in Progress'
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve election results.' });
  }
});

// Check status of logged-in voter
app.get('/api/auth/status', authenticateVoterToken, async (req, res) => {
  try {
    const student = await db.get('students', { id: req.user.id });
    res.json({
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      hasVoted: student.has_voted === 1,
      isBlocked: student.is_blocked === 1
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check voter status.' });
  }
});


/* ==========================================================================
   ADMIN CONTROL ENDPOINTS (Admin token required)
   ========================================================================== */

// 1. Get Live Stats, Candidates and Blocked Voters
app.get('/api/admin/stats', authenticateAdminToken, async (req, res) => {
  try {
    const students = await db.all('students');
    const totalStudentsCount = students.length;
    const votedStudentsCount = students.filter(s => s.has_voted === 1).length;
    const notVotedCount = totalStudentsCount - votedStudentsCount;
    const blockedVoters = students
      .filter(s => s.is_blocked === 1)
      .map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        failed_attempts: s.failed_attempts
      }));
    
    const candidates = await db.all('candidates');
    const votes = await db.all('votes');

    const tallies = candidates.map(c => {
      const count = votes.filter(v => v.candidate_id === c.id).length;
      return {
        id: c.id,
        name: c.name,
        position: c.position,
        year_class: c.year_class,
        photo_url: c.photo_url,
        vote_count: count
      };
    });

    tallies.sort((a, b) => {
      if (a.position !== b.position) return a.position.localeCompare(b.position);
      return b.vote_count - a.vote_count;
    });

    const releasedRow = await db.get('settings', { key: 'results_released' });
    const isReleased = releasedRow && releasedRow.value === 'true';

    // 1. Map session audits
    const voterAudits = students.map(s => ({
      id: s.id,
      name: s.name,
      email: s.email,
      login_time: s.login_time || 'N/A',
      vote_time: s.vote_time || 'N/A',
      logout_time: s.logout_time || 'N/A',
      has_voted: s.has_voted === 1
    }));

    // 2. Map detailed ballots (who voted for whom)
    const ballots = votes.map(v => {
      const student = students.find(s => s.id === v.student_id);
      const candidate = candidates.find(c => c.id === v.candidate_id);
      return {
        studentId: v.student_id,
        studentName: student ? student.name : 'Unknown Student',
        position: v.position,
        candidateName: candidate ? candidate.name : 'Unknown Candidate'
      };
    });

    // 3. Map live winners
    const grouped = tallies.reduce((acc, c) => {
      if (!acc[c.position]) acc[c.position] = [];
      acc[c.position].push(c);
      return acc;
    }, {});
    const liveLeaders = {};
    for (const [pos, cands] of Object.entries(grouped)) {
      const maxVotes = Math.max(...cands.map(c => c.vote_count), 0);
      const leaders = cands.filter(c => c.vote_count === maxVotes && maxVotes > 0);
      liveLeaders[pos] = leaders.length > 0 ? leaders[0] : null; // Show top leading candidate
    }

    res.json({
      totalVoters: totalStudentsCount,
      votedCount: votedStudentsCount,
      notVotedCount: notVotedCount,
      turnoutPercentage: totalStudentsCount > 0 
        ? ((votedStudentsCount / totalStudentsCount) * 100).toFixed(1) 
        : 0,
      tallies,
      resultsReleased: isReleased,
      blockedVoters,
      voterAudits,
      ballots,
      liveLeaders,
      electionStatus: isReleased ? 'Concluded / Results Released' : 'Active / Voting in Progress'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard metrics.' });
  }
});

// 2. Add New Candidate
app.post('/api/admin/candidates', authenticateAdminToken, upload.single('photo'), async (req, res) => {
  const { name, position, year_class } = req.body;

  if (!name || !position || !year_class) {
    return res.status(400).json({ error: 'Name, position, and year/class are required.' });
  }

  let photo_url = '';
  if (req.file) {
    photo_url = `/uploads/${req.file.filename}`;
  } else {
    photo_url = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
  }

  try {
    const result = await db.insert('candidates', {
      name,
      position,
      year_class,
      photo_url
    });

    res.status(201).json({
      message: 'Candidate added successfully.',
      candidate: result
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add candidate.' });
  }
});

// 3. Delete Candidate
app.delete('/api/admin/candidates/:id', authenticateAdminToken, async (req, res) => {
  const candidateId = Number(req.params.id);

  try {
    const candidate = await db.get('candidates', { id: candidateId });
    if (candidate && candidate.photo_url.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, candidate.photo_url);
      fs.unlink(filePath, (err) => {
        if (err) console.error('Failed to delete photo file:', err.message);
      });
    }

    await db.delete('votes', { candidate_id: candidateId });
    const result = await db.delete('candidates', { id: candidateId });

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Candidate not found.' });
    }

    res.json({ message: 'Candidate removed from ballot.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete candidate.' });
  }
});

// 4. Toggle Results Release
app.post('/api/admin/toggle-results', authenticateAdminToken, async (req, res) => {
  try {
    const releasedRow = await db.get('settings', { key: 'results_released' });
    const currentStatus = releasedRow && releasedRow.value === 'true';
    const newStatus = !currentStatus;

    await db.update('settings', { key: 'results_released' }, { value: newStatus.toString() });
    
    res.json({
      message: `Results have been ${newStatus ? 'RELEASED' : 'REVOKED'}.`,
      resultsReleased: newStatus
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle results release status.' });
  }
});

// 5. Unblock Blocked Student Voter
app.post('/api/admin/unblock-student', authenticateAdminToken, async (req, res) => {
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: 'Student ID is required.' });
  }

  try {
    const student = await db.get('students', { id: studentId });
    if (!student) {
      return res.status(404).json({ error: 'Student record not found.' });
    }

    await db.update('students', { id: studentId }, { is_blocked: 0, failed_attempts: 0 });

    res.json({ message: `Student account ${studentId} successfully unblocked.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to unblock student.' });
  }
});

// 6. Reset Election (Delete votes and reset voter statuses)
app.post('/api/admin/reset-election', authenticateAdminToken, async (req, res) => {
  try {
    const candidates = await db.all('candidates');
    for (const cand of candidates) {
      if (cand.photo_url.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, cand.photo_url);
        fs.unlink(filePath, (err) => {
          if (err) console.error('Failed to delete file:', err.message);
        });
      }
    }

    await db.delete('votes', {});
    await db.update(
      'students', 
      {}, 
      { 
        has_voted: 0, 
        otp: null, 
        otp_expiry: null, 
        failed_attempts: 0, 
        is_blocked: 0,
        login_time: null,
        vote_time: null,
        logout_time: null
      }
    );
    await db.update('settings', { key: 'results_released' }, { value: 'false' });

    res.json({ message: 'Election successfully reset. All votes, uploads, and blocks cleared.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset election.' });
  }
});

// 7. Clear All Candidates and Votes
app.post('/api/admin/clear-candidates', authenticateAdminToken, async (req, res) => {
  try {
    const candidates = await db.all('candidates');
    for (const cand of candidates) {
      if (cand.photo_url.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, cand.photo_url);
        fs.unlink(filePath, (err) => {
          if (err) console.error('Failed to delete file:', err.message);
        });
      }
    }
    await db.delete('votes', {});
    await db.delete('candidates', {});
    res.json({ message: 'All candidates and votes cleared successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear candidates.' });
  }
});

// Serve Frontend static files in production (Render monolith deployment)
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  console.log(`Serving compiled frontend assets from: ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Start the Server
app.listen(PORT, () => {
  console.log(`IT Online Voting Server running on port ${PORT}`);
});
