

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: true, 
  credentials: true,
}));
app.use(express.json());

// MongoDB 
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.8n6fjbk.mongodb.net/?appName=cluster0`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

// Middleware
const verifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send({ message: 'Unauthorized access' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; 
    next();
  } catch (err) {
    return res.status(401).send({ message: 'Invalid token' });
  }
};


async function run() {
  try {
    await client.connect();
    const db = client.db('cozy-rooms');

    const roomsCollection = db.collection('rooms-collection');
    const bookingCollection = db.collection('BookingData-collection');
    const reviewCollection = db.collection('review-collection');
    const offerCollection = db.collection('specialOffers');

    console.log('MongoDB connected');

    // Rooms 
    app.get('/allRooms', async (req, res) => {
      const rooms = await roomsCollection.find({}).toArray();
      res.send(rooms);
    });

    app.get('/allRooms/:id', async (req, res) => {
      const room = await roomsCollection.findOne({ _id: new ObjectId(req.params.id) });
      res.send(room);
    });

    // Bookings
    
    app.post('/bookedRooms/:id', verifyJWT, async (req, res) => {
      const { email, Booked_For } = req.body;
      if (email !== req.user.email) return res.status(403).send({ message: "Forbidden" });

      const booking = {
        roomId: new ObjectId(req.params.id),
        email,
        Booked_For,
        createdAt: new Date(),
      };
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    // Get bookings
    app.get('/bookedRooms', verifyJWT, async (req, res) => {
      const email = req.user.email;

      const bookings = await bookingCollection.aggregate([
        { $match: { email } },
        {
          $lookup: {
            from: 'rooms-collection',
            localField: 'roomId',
            foreignField: '_id',
            as: 'room',
          }
        },
        { $unwind: '$room' },
        {
          $project: {
            _id: 1,
            Booked_For: 1,
            title: '$room.title',
            Image: '$room.Image',
            price: '$room.price',
          }
        }
      ]).toArray();

      res.send(bookings);
    });

    // Delete booking 
    app.delete('/bookedRooms/:id', verifyJWT, async (req, res) => {
      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(req.params.id),
        email: req.user.email
      });
      res.send(result);
    });

    // Update booking date 
    app.patch('/bookedRooms/:id', verifyJWT, async (req, res) => {
      const { newDate } = req.body;
      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(req.params.id), email: req.user.email },
        { $set: { Booked_For: newDate } }
      );
      res.send(result);
    });

    //Reviews 
    app.post('/reviews', verifyJWT, async (req, res) => {
      const review = {
        userName: req.body.userName,
        roomId: new ObjectId(req.body.roomId),
        title: req.body.title,
        rating: parseInt(req.body.rating),
        description: req.body.description,
        date: new Date(),
      };
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    app.get('/reviews/:title', async (req, res) => {
      const reviews = await reviewCollection.find({ title: req.params.title }).toArray();
      res.send({ total: reviews.length, reviews });
    });

    app.get('/clientReviews', async (req, res) => {
      const clientReviews = await reviewCollection.aggregate([
        { $sample: { size: 6 } },
        { $sort: { date: -1 } }
      ]).toArray();
      res.send(clientReviews);
    });

    //Top Rooms
    app.get('/topRooms', async (req, res) => {
      const reviewCounts = await reviewCollection.aggregate([
        { $group: { _id: '$title', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 6 }
      ]).toArray();

      const ascendingRoom = reviewCounts.map(item => item._id);
      const topRooms = await Promise.all(
        ascendingRoom.map(async (title) => roomsCollection.findOne({ title }))
      );

      res.json(topRooms.slice(0, 6));
    });

    //Special Offers
    app.get('/specialOffers', async (req, res) => {
      const today = new Date().toISOString();
      const offers = await offerCollection.find({
        $or: [
          { validUntil: { $exists: false } },
          { validUntil: { $gte: today } }
        ]
      }).toArray();
      res.json(offers);
    });

   
    app.get('/', (req, res) => res.send('Cozy Rooms API is alive'));

    
    app.listen(port, () => console.log(`Server running on port ${port}`));

  } catch (err) {
    console.error(err);
  }
}

run();
