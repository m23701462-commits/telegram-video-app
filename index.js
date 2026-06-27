const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Bot Start Command
bot.start((ctx) => {
  ctx.reply('வரவேற்கிறோம்! பிரீமியம் நேரலையைக் காண கீழே உள்ள பட்டனை அழுத்தவும்:', {
    reply_markup: {
      keyboard: [[{ text: "📺 Open Video App", web_app: { url: `https://${process.env.REPLIT_DEV_DOMAIN}` } }]],
      resize_keyboard: true
    }
  });
});

// Admin Route Password Check
app.get('/admin', (req, res) => {
  if(req.query.password === process.env.ADMIN_PASSWORD) {
     res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  } else {
     res.send("<h1>அணுகல் மறுக்கப்பட்டது! தவறான பாஸ்வேர்ட்.</h1>");
  }
});

// API: Create Host
app.post('/api/admin/create-host', async (req, res) => {
  const { name, profile_pic, cost_per_video } = req.body;
  const { data, error } = await supabase.from('hosts').insert([{ name, profile_pic, cost_per_video }]).select();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "Host Created Successfully!", host: data });
});

// API: Get Hosts & Videos for Frontend
app.get('/api/get-stream-data', async (req, res) => {
  const { data: videos } = await supabase.from('videos').select('*, hosts(*)').limit(1).single();
  res.json(videos || {});
});

app.get('/api/admin/get-hosts', async (req, res) => {
  const { data } = await supabase.from('hosts').select('*');
  res.json(data || []);
});

// API: Add Video
app.post('/api/admin/add-video', async (req, res) => {
  const { host_id, video_url, title } = req.body;
  const { error } = await supabase.from('videos').insert([{ host_id, video_url, title }]);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "Video Added Successfully!" });
});

// API: Check Payment Access
app.post('/api/check-access', async (req, res) => {
  const { userId, videoId } = req.body;
  const { data } = await supabase.from('video_access').select('paid').eq('user_id', userId).eq('video_id', videoId).single();
  res.json({ hasAccess: data ? data.paid : false });
});

// API: Create Cashfree Payment Link
app.post('/api/pay-video', async (req, res) => {
  const { amount, customerId, videoId } = req.body;
  try {
    const response = await axios.post('https://cashfree.com', {
      order_amount: amount,
      order_currency: "INR",
      customer_details: { customer_id: customerId, customer_phone: "9999999999" },
      order_meta: { return_url: `https://${process.env.REPLIT_DEV_DOMAIN}/payment-success?video_id=${videoId}&user_id=${customerId}` }
    }, {
      headers: {
        'x-client-id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY,
        'x-api-version': '2022-09-01'
      }
    });
    res.json({ payment_link: response.data.payment_link });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Payment Success Callback
app.get('/payment-success', async (req, res) => {
  const { video_id, user_id } = req.query;
  await supabase.from('video_access').insert([{ user_id: user_id, video_id: video_id, paid: true }]);
  res.send("<h1>கட்டணம் வெற்றி! டெலிகிராம் ஆப்பிற்குத் திரும்பவும்.</h1>");
});

bot.launch();
app.listen(3000, () => console.log('Server is running on port 3000'));
