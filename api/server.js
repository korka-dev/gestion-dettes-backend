const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Client Schema
const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  deposit: { type: Number, default: 0 },
  totalDebt: { type: Number, default: 0 },
  debts: [{
    amount: { type: Number, required: true },
    productName: { type: String, required: true }, 
    date: { type: Date, default: Date.now },
    paid: { type: Boolean, default: false }
  }]
});

const Client = mongoose.model('Client', clientSchema);

// API Routes
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await Client.find();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const initialDebt = Number(req.body.initialDebt) || 0;
    
    const client = new Client({
      name: req.body.name,
      phone: req.body.phone,
      deposit: req.body.deposit || 0,
      totalDebt: initialDebt,
      debts: initialDebt ? [{
        amount: initialDebt,
        productName: req.body.initialProductName || 'Produit initial',
        date: new Date()
      }] : []
    });
    
    const newClient = await client.save();
    res.status(201).json(newClient);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Ajouter une dette
app.post('/api/clients/:clientId/debts', async (req, res) => {
  try {
    const client = await Client.findById(req.params.clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    const amount = Number(req.body.amount);
    
    client.debts.push({
      amount: amount,
      productName: req.body.productName,
      date: new Date()
    });
    
    // Incrémenter le totalDebt
    client.totalDebt += amount;
    
    const updatedClient = await client.save();
    res.json(updatedClient);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Payer une dette
app.put('/api/clients/:clientId/debts/:debtId/pay', async (req, res) => {
  try {
    const client = await Client.findById(req.params.clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const debt = client.debts.id(req.params.debtId);
    if (!debt) {
      return res.status(404).json({ message: 'Dette not found' });
    }

    if (!debt.paid) {
      debt.paid = true;

      // Recalculer totalDebt en fonction des dettes impayées restantes
      client.totalDebt = client.debts.reduce((total, d) => {
        return !d.paid ? total + d.amount : total;
      }, 0);
    }

    const updatedClient = await client.save();
    res.json(updatedClient);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
