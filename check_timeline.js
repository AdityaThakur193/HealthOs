const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://adityath2305_db_user:SvGHr07FAWmJT9ZO@cluster0.0vbiofu.mongodb.net/';
async function check() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('test');
  const today = new Date(); today.setHours(0,0,0,0);
  const events = await db.collection('timelineevents').find({ timestamp: { $gte: today } }).sort({ timestamp: -1 }).toArray();
  console.log('Total today:', events.length);
  events.forEach(e => {
    const p = {...e.payload}; delete p.imagePreview; delete p.foods;
    console.log(e.type, '| source:', e.source, '| userId:', String(e.userId));
    console.log('  payload:', JSON.stringify(p));
  });

  // Check what the profile userId looks like
  const profile = await db.collection('userprofiles').findOne({ email: 'adityath2305@gmail.com' });
  console.log('\nProfile _id:', profile?._id?.toString());
  console.log('Profile email:', profile?.email);

  await client.close();
}
check().catch(console.error);
