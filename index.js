const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin:  '*', 
  credentials: false,
}));
app.use(express.json());

// MongoDB 
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.8n6fjbk.mongodb.net/?appName=cluster0`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
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

 // Chatbot API 
const { OpenAI } = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const roomsCollection = client.db("cozy-rooms").collection("rooms-collection");

    
    if (process.env.USE_FALLBACK_CHAT === 'true') {
      
      const reply = getFallbackResponse(message);
      return res.json({ reply });
    }

    let contextData = "";
    if (/available|room|price|book|vacancy|types|list|show/i.test(message)) {
      const rooms = await roomsCollection
        .find({})
        .project({ title: 1, price: 1, facilities: 1, size: 1, _id: 0 })
        .limit(5)
        .toArray();
      contextData = `Available rooms: ${rooms
        .map((r) => `• ${r.title} — $${r.price} — ${r.size} — ${r.facilities?.join(', ') || 'No facilities listed'}`)
        .join("\n")}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Luna, an AI hotel booking assistant for 'Cozy Rooms'. Answer user questions about room availability, prices, reviews, and booking. Be friendly, concise, and natural. Keep responses under 100 words.",
        },
        {
          role: "user",
          content: message,
        },
        ...(contextData
          ? [{ role: "system", content: `Context info: ${contextData}` }]
          : []),
      ],
      max_tokens: 150, 
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });

  } catch (err) {
    console.error("Chatbot error:", err.message);

    
    const fallbackReply = getFallbackResponse(req.body?.message || "");
    
    res.json({ reply: fallbackReply });
  }
});

function getFallbackResponse(userMessage) {
  const lowerMsg = userMessage.toLowerCase();
  
  if (/hi|hello|hey|greetings/i.test(lowerMsg)) {
    return "Hi there! I'm Luna 🌙 — your Cozy Rooms assistant. How can I help you today?";
  }
  
  if (/available|rooms|types|list|show|options/i.test(lowerMsg)) {
    return "We have several cozy rooms available! Currently we offer: Economy Room ($50/night), Standard Room ($80/night), Deluxe Room ($120/night), and Suite ($180/night). Would you like details on any specific room?";
  }
  
  if (/price|cost|how much|rate/i.test(lowerMsg)) {
    return "Our room prices range from $50 to $200 per night. The Economy Room starts at $50, Standard at $80, Deluxe at $120, and our luxurious Suite is $180. All prices are per night.";
  }
  
  if (/book|reserve|reservation|booking/i.test(lowerMsg)) {
    return "To book a room, please go to our website, select your desired room, and choose your dates. You can also contact us directly at bookings@cozyrooms.com or call (555) 123-4567.";
  }
  
  if (/facilities|amenities|features|what's included/i.test(lowerMsg)) {
    return "All our rooms include free Wi-Fi, air conditioning, comfortable bedding, and daily housekeeping. Some rooms also have minibars, work desks, and beautiful views!";
  }
  
  if (/cancel|cancellation|refund|policy/i.test(lowerMsg)) {
    return "You can cancel your booking up to 3 days before your stay for a full refund. Late cancellations may incur a fee. Please check our cancellation policy for details.";
  }
  
  if (/contact|email|phone|call|reach/i.test(lowerMsg)) {
    return "You can contact us at bookings@cozyrooms.com or call (555) 123-4567. Our team is available 24/7 to assist you!";
  }
  
  // Default response for unknown queries
  return "Thanks for your message! I'm currently experiencing high demand. For immediate assistance, please visit our website or contact our team directly at bookings@cozyrooms.com. How else can I help?";
}
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
    


    app.get('/allRooms/:id', async (req, res) => {
      const room = await roomsCollection.findOne({ _id: new ObjectId(req.params.id) });
      res.send(room);
    });

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

 
     // bookedRooms
    app.post('/bookedRooms/:id', async (req, res) => {
      const roomId = req.params.id;
      const booking = {
        roomId: roomId,
        ...req.body
      };
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    // Get bookings 
    app.get('/bookedRooms', async (req, res) => {
      const { email } = req.query;
      const user=req.query.email
      const filterUser=user ? {email: user}:{}
      const totalBookings=await bookingCollection
      .find(filterUser)
      .toArray()
      res.send(totalBookings)

      if (!email) {
        return res.status(400).send({ message: 'Email parameter is required' });
      }

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

   

    //bookChecking
    app.get('/bookedRooms/:id', async (req, res) => {
      const roomId = req.params.id;
      const existingBooking = await bookingCollection.findOne({ roomId: roomId });
      res.send({ isBooked: !!existingBooking });

    });

    // Delete booking 
    app.delete('/bookedRooms/:id', async (req, res) => {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).send({ message: 'Email is required in request body' });
      }

      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(req.params.id),
        email: email
      });
      res.send(result);
    });

    // Update booking date 
    app.patch('/bookedRooms/:id', async (req, res) => {
      const { newDate, email } = req.body;
      
      if (!email) {
        return res.status(400).send({ message: 'Email is required' });
      }

      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(req.params.id), email: email },
        { $set: { Booked_For: newDate } }
      );
      res.send(result);
    });

    // Reviews 
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


    // get review
app.get('/reviews/:title', async (req, res) => {
  const roomTitle = req.params.title;
  const totalReviews = await reviewCollection.countDocuments({ title: req.params.title});
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

    // Top Rooms
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

    // Special Offers
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


    // root
    app.get('/', (req, res) => res.send('Cozy Rooms API is alive'));
    app.listen(port, () => console.log(`Server running on port ${port}`));

  } catch (err) {
    console.error(err);
  }
}

run();