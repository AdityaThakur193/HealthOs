const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'local_db.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Find user
const originalUserId = 'local_user_amjmven8i';
const userIndex = data.profiles.findIndex(p => p._id === originalUserId);

if (userIndex !== -1) {
  const demoProfile = { ...data.profiles[userIndex] };
  demoProfile._id = 'local_demo_user';
  demoProfile.email = 'demo@healthos.app';
  demoProfile.name = 'Alex';
  demoProfile.age = 24;
  demoProfile.heightCm = 180;
  demoProfile.weightKg = 82;
  demoProfile.targetWeightKg = 75;
  demoProfile.collegeSchedule = '9 AM - 5 PM Work';
  demoProfile.mess = 'Home';

  // Remove existing demo user if exists
  data.profiles = data.profiles.filter(p => p._id !== 'local_demo_user');
  data.profiles.push(demoProfile);
}

// Clone events
const demoEvents = [];
let baseWeight = 85;

for (const event of data.events) {
  if (event.userId === originalUserId) {
    const cloned = { ...event, _id: 'demo_evt_' + Math.random().toString(36).substr(2, 9), userId: 'local_demo_user' };
    
    // Adjust weight events so they are around 85 -> 82 instead of 118
    if (cloned.type === 'weight' && cloned.payload && cloned.payload.weightKg) {
      // Just subtract 33kg (118 - 85 = 33) to keep the trend
      cloned.payload.weightKg = parseFloat((cloned.payload.weightKg - 36).toFixed(1)); 
    }
    demoEvents.push(cloned);
  }
}

// Remove old demo events
data.events = data.events.filter(e => e.userId !== 'local_demo_user');
data.events.push(...demoEvents);

fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
console.log('Dummy user seeded!');
