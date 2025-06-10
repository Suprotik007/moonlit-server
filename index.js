const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
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

async function run() {
  try {
    await client.connect();
    const db = client.db('cozy-rooms');
    const roomsCollection = db.collection('rooms-collection');
    const bookingDataCollection = db.collection('BookingData-collection');

    console.log('Connected to MongoDB!');
 
    //featuredRooms
    app.get('/topRooms', async (req, res) => {
      const topRooms = await roomsCollection
      .find({})
      .limit(6)
      .toArray();
      res.json(topRooms);
    });

    //allRooms
    app.get('/allRooms', async (req, res) => {
      const allRooms = await roomsCollection
      .find({})
      .toArray();
      res.json(allRooms);
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
    app.get('/bookedRooms',async(req,res)=>{
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
// const { roomId, userName, rating, description } = req.body;
    
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

// total review

app.get('/reviews/:title', async (req, res) => {
  const roomTitle = req.params.title;
  console.log("Fetching reviews for roomId:", roomTitle)
  const totalReviews = await reviewCollection.countDocuments({ title: roomTitle});
  res.send({ total: totalReviews });
});





    app.listen(port, () => {
      console.log(`Cozy Rooms server running on port ${port}`);
    });
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);
