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


    app.listen(port, () => {
      console.log(`Cozy Rooms server running on port ${port}`);
    });
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);
