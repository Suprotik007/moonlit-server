const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');




const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin:['http://localhost:5174'],
  credentials:true,
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('cozy-rooms are roaming');
});

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.8n6fjbk.mongodb.net/?retryWrites=true&w=majority&appName=cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// jwt
const verifyJWT = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).send('Unauthorized');
  }
  
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).send('Unauthorized');
  }
}

async function run() {
  try {
    // await client.connect();
    const db = client.db('cozy-rooms');
    const roomsCollection = db.collection('rooms-collection');
    const bookingDataCollection = db.collection('BookingData-collection');
const offerCollection=db.collection('specialOffers')
    console.log('Connected to MongoDB!');


 
    //featuredRooms
     app.get('/topRooms', async (req, res) => {
  const reviewCounts = await reviewCollection.aggregate([
  {
  $group: {
  _id: '$title',
  count: { $sum: 1 }
  }
  },
  {
  $sort: { count: -1 ,_id:1} 
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
  res.json(topRooms.slice(0,6));
  });
 
    //allRooms
    app.get('/allRooms', async (req, res) => {
      const priceRanges = {
  All: null, 
  Cozy: { min: 50, max: 99 },
  Luxury: { min: 100, max: 149 },
  Premium: { min: 150, max: 200 }
};
const category = req.query.category || 'All';
  const range = priceRanges[category];

  let pipeline = [];

  if (range) {
    pipeline.push(
      {
        $addFields: {
          numericPrice: {
            $toDouble: {
              $substr: ["$price", 0, { $subtract: [{ $strLenCP: "$price" }, 1] }] 
            }
          }
        }
      },
      {
        $match: {
          numericPrice: { $gte: range.min, $lte: range.max }
        }
      }
    );
  }
      const rooms = range ? await roomsCollection.aggregate(pipeline).toArray() : await roomsCollection.find({}).toArray();
    res.json(rooms);
    });
    
    //roomDetails
    app.get('/allRooms/:id', async (req, res) => {
      const id = req.params.id;
      const roomDetails = await roomsCollection.findOne({ _id: new ObjectId(id) });
      res.json(roomDetails);
    });

    // bookedRooms
    app.post('/bookedRooms/:id', async (req, res) => {
      const roomId = req.params.id;
      const booking = {
        roomId: roomId,
        ...req.body
      };
      const result = await bookingDataCollection.insertOne(booking);
      res.send(result);
    });

    //bookChecking
    app.get('/bookedRooms/:id', async (req, res) => {
      const roomId = req.params.id;
      const existingBooking = await bookingDataCollection.findOne({ roomId: roomId });
      res.send({ isBooked: !!existingBooking });
    });
    
// bookingData filtering
    app.get('/bookedRooms',verifyJWT,async(req,res)=>{
      const user=req.query.email
      const filterUser=user ? {email: user}:{}
      const bookings=await bookingDataCollection
      .find(filterUser)
      .toArray()
      res.send(bookings)
    })

// cancelBooking
app.delete('/bookedRooms/:id',async(req,res)=>{
  const id=req.params.id
  const query={_id: new ObjectId(id)}
  const result=await bookingDataCollection.deleteOne(query)
  res.send(result)
})

// review
const reviewCollection=client.db('cozy-rooms').collection('review-collection');
app.post('/reviews',async(req,res)=>{
 
  const user=req.query.name
  const review={
    userName: req.body.userName,
    roomId:req.body.roomId,
    //  roomId: new ObjectId(roomId),
    title:req.body.title,
      rating: parseInt(req.body.rating),
      description: req.body.description,
      date: req.body.date || new Date().toISOString(),
  }
  const result=await reviewCollection.insertOne(review)
  res.send(result)
})

// get review
app.get('/reviews/:title', async (req, res) => {
  const roomTitle = req.params.title;
  // console.log("Fetching reviews for roomId:", roomTitle)
  const totalReviews = await reviewCollection.countDocuments({ title: roomTitle});
   const reviews = await reviewCollection.find({ title: roomTitle }).toArray();
  res.send({ total: totalReviews,reviews:reviews });
});

// clientReviews
app.get('/clientReviews', async (req, res) => {
  
    const clientReviews = await reviewCollection.aggregate([
      { $sample: { size: 6 } },  
      { $sort: { date: -1 } }   
    ]).toArray();

    res.send(clientReviews);
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

// ---------- AI Chatbot Integration ----------
const { OpenAI } = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/chat", async (req, res) => {
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



    app.listen(port, () => {
      console.log(`Cozy Rooms server running on port ${port}`);
    });
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);
