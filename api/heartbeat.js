import { readUsers, writeUsers, ensureUser, nowSec } from '../utils/helpers.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });
    
    const users = readUsers();
    ensureUser(users, address);
    
    users[address].lastActivity = nowSec();
    writeUsers(users);
    
    res.json({ ok: true, lastActivity: users[address].lastActivity });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'heartbeat failed' });
  }
}