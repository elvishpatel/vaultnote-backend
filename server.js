const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// DB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schema
const noteSchema = new mongoose.Schema({
  title: String,
  encryptedText: String,
  tags: [String],
  createdAt: { type: Date, default: Date.now }
});

const Note = mongoose.model('Note', noteSchema);

// Encryption Helpers
const algorithm = 'aes-256-cbc';
const key = crypto.createHash('sha256').update(String(process.env.SECRET_KEY)).digest('base64').substr(0, 32);
const iv = crypto.randomBytes(16);

function encrypt(text) {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(data) {
  let parts = data.split(':');
  let iv = Buffer.from(parts[0], 'hex');
  let encryptedText = parts[1];
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8') + decipher.final('utf8');
  return decrypted;
}

// Routes
app.post('/add', async (req, res) => {
  const { title, text, tags } = req.body;
  const encryptedText = encrypt(text);
  const note = new Note({ title, encryptedText, tags });
  await note.save();
  res.json({ success: true });
});

app.get('/notes', async (req, res) => {
  const notes = await Note.find().sort({ createdAt: -1 });
  const decryptedNotes = notes.map(n => ({
    title: n.title,
    text: decrypt(n.encryptedText),
    tags: n.tags,
    createdAt: n.createdAt
  }));
  res.json(decryptedNotes);
});

// DELETE route
app.delete('/delete/:id', async (req, res) => {
  await Note.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// UPDATE route
app.put('/update/:id', async (req, res) => {
  const { title, text, tags } = req.body;
  const encryptedText = encrypt(text);
  await Note.findByIdAndUpdate(req.params.id, { title, encryptedText, tags });
  res.json({ success: true });
});


app.listen(3000, () => console.log("VaultNote backend running on port 3000"));
