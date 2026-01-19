
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;


app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());

// JWT

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Invalid token' });
    }
    req.user = decoded;
    next();
  });
};

// db connection

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.8n6fjbk.mongodb.net/?appName=cluster0`;



const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db('cozy-rooms');
    const roomsCollection = db.collection('rooms-collection');
    const bookingCollection = db.collection('BookingData-collection');
    const reviewCollection = db.collection('review-collection');
    const offerCollection = db.collection('specialOffers');

    console.log('MongoDB connected');

  //  Auth

    app.post('/jwt', (req, res) => {
      const user = req.body; // { email }
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: '7d',
      });
      res.send({ token });
    });

    // Rooms

    app.get('/allRooms', async (req, res) => {
      const rooms = await roomsCollection.find({}).toArray();
      res.send(rooms);
    });

    app.get('/allRooms/:id', async (req, res) => {
      const room = await roomsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(room);
    });

    //  BOOKINGS

    app.post('/bookedRooms/:id', async (req, res) => {
      const booking = {
        roomId: new ObjectId(req.params.id),
        email: req.body.email,
        Booked_For: req.body.Booked_For,
        createdAt: new Date(),
      };

      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

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
          },
        },
        { $unwind: '$room' },
        {
          $project: {
            _id: 1,
            Booked_For: 1,
            title: '$room.title',
            Image: '$room.Image',
            price: '$room.price',
          },
        },
      ]).toArray();

      res.send(bookings);
    });

    app.delete('/bookedRooms/:id', verifyJWT, async (req, res) => {
      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    app.patch('/bookedRooms/:id', verifyJWT, async (req, res) => {
      const { newDate } = req.body;

      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { Booked_For: newDate } }
      );

      res.send(result);
    });

    /*  REVIEWS*/

    app.post('/reviews', async (req, res) => {
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
      const reviews = await reviewCollection.find({
        title: req.params.title,
      }).toArray();

      res.send({
        total: reviews.length,
        reviews,
      });
    });

    // clientReviews
    app.get('/clientReviews', async (req, res) => {
      const clientReviews = await reviewCollection.aggregate([
        { $sample: { size: 6 } },
        { $sort: { date: -1 } }
      ]).toArray();
      res.send(clientReviews);
    });

    // topRooms
    app.get('/topRooms', async (req, res) => {
      const reviewCounts = await reviewCollection.aggregate([
        {
          $group: {
            _id: '$title',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1, _id: 1 }
        },
        {
          $limit: 6
        }
      ]).toArray();

      const ascendingRoom = reviewCounts.map(item => item._id);
      const topRooms = await Promise.all(
        ascendingRoom.map(async (title) => {
          return await roomsCollection.findOne({ title: title });
        })
      );
      res.json(topRooms.slice(0, 6));
    });

// Offers
    app.get('/specialOffers', async (req, res) => {
      const today = new Date().toISOString();
      const offers = await offerCollection.find({
        $or: [
          { validUntil: { $exists: false } },
          { validUntil: { $gte: today } },
        ],
      }).toArray();

      res.send(offers);
    });


// updateDate
app.patch('/bookedRooms/:id',async(req,res)=>{
const id=req.params.id
const { newDate } = req.body; 

 const filter = { _id: new ObjectId(id) };
const updatedDoc={
  $set: { Booked_For: newDate }
}
const result=await bookingDataCollection.updateOne(filter,updatedDoc)
res.send(result)
// console.log(result);

})

// offers
app.get('/specialOffers',async(req,res)=>{
  const today=new Date()
  const offers=await offerCollection.find({
    $or: [
        { validUntil: { $exists: false } },
        { validUntil: { $gte: today.toISOString() } }
      ]
  }).toArray()
  res.json(offers)
})

// Chatbot
const { OpenAI } = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const roomsCollection = client.db("cozy-rooms").collection("rooms-collection");

    let contextData = "";
    if (/available|room|price|book|vacancy/i.test(message)) {
      const rooms = await roomsCollection
        .find({})
        .project({ title: 1, price: 1, _id: 0 })
        .limit(5)
        .toArray();
      contextData = `Here are some of our rooms:\n${rooms
        .map((r) => `• ${r.title} — $${r.price}`)
        .join("\n")}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Luna, an AI hotel booking assistant for 'Cozy Rooms'. Answer user questions about room availability, prices, reviews, and booking. Be friendly, concise, and natural.",
        },
        {
          role: "user",
          content: message,
        },
        ...(contextData
          ? [{ role: "system", content: `Context info: ${contextData}` }]
          : []),
      ],
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });

  } catch (err) {
    console.error("Chatbot error:", err);

    // Handle OpenAI quota errors
    if (err.code === "insufficient_quota" || err.status === 429) {
      return res.status(429).json({
        reply: "Sorry, Luna is temporarily out of tokens 🥲. Please try again later!"
      });
    }

    // Other errors
    res.status(500).json({ reply: "Sorry, Luna had trouble answering that." });
  }
});



    app.get('/', (req, res) => {
      res.send('Cozy Rooms API is alive');
    });


    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error(err);
  }
}

run();
